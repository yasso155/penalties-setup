/* Penalties Setup - shared access control (used by index.html via cloud.js and by settings.html).
   Roles (stored in Realtime Database at users/{uid}/role):
     admin   everything, including Settings and Users
     editor  builds files, exports, imports IDs (shared penalty table)
     viewer  builds files and exports; cannot import IDs or change shared data
     disabled  signed-in but blocked
   A signed-in person without a users/{uid} record is "pending" until an admin approves them. */
import {signInWithEmailAndPassword,sendPasswordResetEmail,signOut}
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {ref,get,set} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

/* The first admin: this account claims the admin role automatically when no users exist yet.
   Must match the same email in database.rules.json. */
export const BOOTSTRAP_ADMIN_EMAIL='yseddig15@gmail.com';
export const ROLES=['admin','editor','viewer'];
const LOCAL_KEYS=['penalties-builder-v1','penalties-existing-v3'];

/* Returns 'admin' | 'editor' | 'viewer' | 'disabled' | 'pending' */
export async function resolveRole(db,user){
  const rs=await get(ref(db,'users/'+user.uid));
  if(rs.exists()){const r=rs.val().role;return ROLES.includes(r)?r:'disabled';}
  if((user.email||'').toLowerCase()===BOOTSTRAP_ADMIN_EMAIL){
    try{
      await set(ref(db,'users/'+user.uid),{email:user.email,role:'admin',createdAt:Date.now(),createdBy:'bootstrap'});
      return 'admin';
    }catch(e){/* users already exist: fall through to pending */}
  }
  try{await set(ref(db,'pending/'+user.uid),{email:user.email||'',requestedAt:Date.now()});}catch(e){}
  return 'pending';
}

export function applyRole(role){document.body.dataset.role=role||'';}

/* Each person has their own session: local copies belong to one account only. Returns true when the page must reload. */
export function enforceLocalOwner(uid){
  try{
    const k='penalties-owner',o=localStorage.getItem(k);
    if(o!==uid){
      localStorage.setItem(k,uid);
      if(o!==null){LOCAL_KEYS.forEach(x=>localStorage.removeItem(x));return true;}
    }
  }catch(e){}
  return false;
}

export async function fullSignOut(auth){
  try{LOCAL_KEYS.forEach(x=>localStorage.removeItem(x));}catch(e){}
  try{await signOut(auth);}catch(e){}
  location.reload();
}

export function mountLogin(auth,{title='Penalties Setup',subtitle=''}={}){
  const css=document.createElement('style');
  css.textContent=`#login{position:fixed;inset:0;z-index:3000;background:var(--bg,#eef1f6);display:flex;align-items:center;justify-content:center;padding:16px;direction:ltr}
  #login[hidden]{display:none}
  .lg-card{width:min(380px,100%);background:var(--surface,#fff);border:1px solid var(--line,#d8dde6);border-radius:12px;padding:24px;display:flex;flex-direction:column;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.08);text-align:left}
  .lg-card h2{margin:0;font-size:20px}.lg-card p{margin:0 0 4px;color:var(--muted,#667);line-height:1.5}
  .lg-card label{display:flex;flex-direction:column;gap:4px;font-size:13px}
  .lg-card input{padding:9px 12px;border:1px solid var(--line,#d8dde6);border-radius:6px;font:inherit}
  .lg-card button{padding:9px 14px;border-radius:6px;border:1px solid var(--line,#d8dde6);background:var(--surface,#fff);font:inherit;font-weight:600;cursor:pointer}
  .lg-card button.primary{background:var(--primary,#0969da);border-color:transparent;color:#fff}
  .lg-card .lg-link{border:0;background:none;color:var(--primary,#0969da);font-weight:500;padding:2px 0;align-self:flex-start;cursor:pointer}
  #lg-err{color:var(--bad,#b3261e);font-size:13px;min-height:1em}
  #lg-ok{color:var(--ok,#1a7f37);font-size:13px}
  #who{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted,#667)}
  #who button{padding:2px 8px;font-size:12px}
  body[data-role="viewer"] #ex-btn,body[data-role="viewer"] #ex-clear{display:none!important}
  body:not([data-role="admin"]) a.settings-nav-btn{display:none!important}`;
  document.head.appendChild(css);
  const ov=document.createElement('div');ov.id='login';ov.hidden=true;document.body.appendChild(ov);

  function showLogin(){
    ov.innerHTML=`<form class="lg-card" autocomplete="on">
      <h2>Sign in</h2><p>${title}${subtitle?' · '+subtitle:''}</p>
      <label>Email<input id="lg-email" type="email" autocomplete="username" required></label>
      <label>Password<input id="lg-pass" type="password" autocomplete="current-password" required></label>
      <div id="lg-err" role="alert"></div><div id="lg-ok"></div>
      <button class="primary" type="submit">Sign in</button>
      <button class="lg-link" type="button" id="lg-forgot">Forgot password / set password</button></form>`;
    ov.hidden=false;
    const err=ov.querySelector('#lg-err'),ok=ov.querySelector('#lg-ok');
    ov.querySelector('form').addEventListener('submit',async e=>{
      e.preventDefault();err.textContent='';ok.textContent='';
      try{await signInWithEmailAndPassword(auth,ov.querySelector('#lg-email').value.trim(),ov.querySelector('#lg-pass').value);}
      catch(x){err.textContent='Wrong email or password.';}
    });
    ov.querySelector('#lg-forgot').addEventListener('click',async()=>{
      err.textContent='';ok.textContent='';
      const em=ov.querySelector('#lg-email').value.trim();
      if(!em){err.textContent='Enter your email first.';return;}
      try{await sendPasswordResetEmail(auth,em);}catch(x){}
      ok.textContent='If this email has an account, a link to set a new password was sent.';
    });
  }
  function showBlocked(email,state){
    const msg={
      pending:'Your account is waiting for approval. Ask an admin to give you access, then sign in again.',
      disabled:'Your account has been disabled. Contact an admin.',
      noadmin:'This page is for admins only.',
      error:'Could not check your access. If you just set this up, publish the new database rules in Firebase (Realtime Database > Rules), then sign in again.'
    }[state]||'No access.';
    ov.innerHTML=`<div class="lg-card"><h2>No access</h2><p>${email?email+' — ':''}${msg}</p>
      ${state==='noadmin'?'<button type="button" id="lg-back" class="primary">Back to app</button>':''}
      <button type="button" id="lg-out">Sign out</button></div>`;
    ov.hidden=false;
    ov.querySelector('#lg-out').addEventListener('click',()=>fullSignOut(auth));
    const b=ov.querySelector('#lg-back');if(b)b.addEventListener('click',()=>{location.href='index.html';});
  }
  return {showLogin,showBlocked,hide(){ov.hidden=true;ov.innerHTML='';}};
}
