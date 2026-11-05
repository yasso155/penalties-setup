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
  css.textContent=`#login{position:fixed;inset:0;z-index:3000;background:var(--bg,#EDF0F5);display:flex;align-items:center;justify-content:center;padding:16px;direction:ltr;font-family:var(--f-body,"IBM Plex Sans Arabic","Segoe UI",system-ui,sans-serif);color:var(--ink,#14202E)}
  #login[hidden]{display:none}
  .lg-card{width:min(400px,100%);background:var(--surface,#fff);border:1px solid var(--line,#D3DAE4);border-radius:14px;padding:28px;display:flex;flex-direction:column;gap:14px;box-shadow:0 1px 2px rgba(20,32,46,.05),0 16px 40px rgba(20,32,46,.08);text-align:left}
  .lg-logo{height:44px;width:auto;align-self:flex-start;margin-bottom:6px}
  .lg-card h2{margin:0;font-size:22px;font-weight:600;letter-spacing:-.01em}
  .lg-card p{margin:0;color:var(--muted,#5A6778);line-height:1.55;font-size:14px}
  .lg-card label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:500}
  .lg-card input{padding:10px 12px;min-height:42px;border:1px solid var(--line,#D3DAE4);border-radius:8px;font:inherit;font-weight:400;background:var(--surface-2,#F5F7FA);color:inherit;width:100%}
  .lg-card input:focus-visible{outline:2px solid var(--accent,#1F5FBF);outline-offset:1px;background:var(--surface,#fff)}
  .lg-pass{position:relative;display:block}.lg-pass input{padding-right:64px}
  .lg-card .lg-pass button{position:absolute;right:5px;top:5px;bottom:5px;min-height:0;height:auto;padding:0 10px;border:0;background:none;color:var(--accent,#1F5FBF);font-size:13px;font-weight:500}
  .lg-card button{padding:10px 14px;min-height:42px;border-radius:8px;border:1px solid var(--line,#D3DAE4);background:var(--surface-2,#F5F7FA);color:inherit;font:inherit;font-weight:600;cursor:pointer}
  .lg-card button:focus-visible{outline:2px solid var(--accent,#1F5FBF);outline-offset:1px}
  .lg-card button.primary{background:var(--accent,#1F5FBF);border-color:transparent;color:var(--accent-ink,#fff)}
  .lg-card button.primary:disabled{opacity:.6;cursor:wait}
  .lg-card .lg-link{border:0;background:none;color:var(--accent,#1F5FBF);font-weight:500;padding:2px 0;min-height:0;align-self:flex-start}
  #lg-err:not(:empty){color:var(--bad,#B3261E);background:var(--ref-soft,#FBE3E1);border-radius:8px;padding:8px 10px;font-size:13px}
  #lg-ok:not(:empty){color:var(--good,#1D7A4B);font-size:13px}
  .lg-acts{display:flex;gap:10px;flex-wrap:wrap}.lg-acts button{flex:1}
  #who{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted,#5A6778);padding:3px 4px 3px 12px;border:1px solid var(--line,#D3DAE4);border-radius:999px;background:var(--surface,#fff)}
  #who button{padding:3px 10px;min-height:28px;font-size:12.5px;border-radius:999px}
  #who .role{font-size:12px;padding:1px 8px;border-radius:999px;background:var(--accent-soft,#E3ECFA);color:var(--accent,#1F5FBF);font-weight:600;text-transform:capitalize}
  body[data-role="viewer"] #ex-btn,body[data-role="viewer"] #ex-clear{display:none!important}
  body:not([data-role="admin"]) a.settings-nav-btn{display:none!important}
  @media (prefers-reduced-motion:no-preference){.lg-card{animation:lgIn .25s ease-out}@keyframes lgIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}}`;
  document.head.appendChild(css);
  const ov=document.createElement('div');ov.id='login';ov.hidden=true;document.body.appendChild(ov);
  /* Pick the logo that reads on the page background (light logo on light pages, dark-mode logo on dark pages). */
  const logo=()=>{
    const m=(getComputedStyle(ov).backgroundColor.match(/\d+/g)||[255,255,255]).map(Number);
    const dark=(m[0]*299+m[1]*587+m[2]*114)/1000<128;
    return `<img class="lg-logo" src="source/logos/yaser-lockup-horizontal-color-${dark?'ondark':'onlight'}.svg" alt="Yaser Aljaali">`;
  };

  function showLogin(){
    ov.innerHTML=`<form class="lg-card" autocomplete="on">
      ${logo()}
      <div><h2>Sign in</h2><p>${title}${subtitle?' · '+subtitle:''}</p></div>
      <label>Email<input id="lg-email" type="email" autocomplete="username" required autofocus></label>
      <label>Password<span class="lg-pass"><input id="lg-pass" type="password" autocomplete="current-password" required><button type="button" id="lg-show" aria-pressed="false">Show</button></span></label>
      <div id="lg-err" role="alert"></div><div id="lg-ok" role="status"></div>
      <button class="primary" type="submit" id="lg-go">Sign in</button>
      <button class="lg-link" type="button" id="lg-forgot">Forgot password or first sign-in</button></form>`;
    ov.hidden=false;
    const err=ov.querySelector('#lg-err'),ok=ov.querySelector('#lg-ok');
    const go=ov.querySelector('#lg-go'),pw=ov.querySelector('#lg-pass'),sh=ov.querySelector('#lg-show');
    sh.addEventListener('click',()=>{const on=pw.type==='password';pw.type=on?'text':'password';sh.textContent=on?'Hide':'Show';sh.setAttribute('aria-pressed',String(on));});
    ov.querySelector('form').addEventListener('submit',async e=>{
      e.preventDefault();err.textContent='';ok.textContent='';go.disabled=true;go.textContent='Signing in...';
      try{await signInWithEmailAndPassword(auth,ov.querySelector('#lg-email').value.trim(),pw.value);}
      catch(x){err.textContent='Wrong email or password. Check them and try again.';go.disabled=false;go.textContent='Sign in';}
    });
    ov.querySelector('#lg-forgot').addEventListener('click',async()=>{
      err.textContent='';ok.textContent='';
      const em=ov.querySelector('#lg-email').value.trim();
      if(!em){err.textContent='Enter your email first, then select this link again.';return;}
      try{await sendPasswordResetEmail(auth,em);}catch(x){}
      ok.textContent='If this email has an account, we sent a link to set a new password.';
    });
  }
  function showBlocked(email,state){
    const msg={
      pending:'Your account is waiting for approval. Ask an admin to give you access, then sign in again.',
      disabled:'Your account has been disabled. Contact an admin.',
      noadmin:'This page is for admins only.',
      error:'Could not check your access. If you just set this up, publish the new database rules in Firebase (Realtime Database > Rules), then sign in again.'
    }[state]||'No access.';
    ov.innerHTML=`<div class="lg-card">${logo()}<div><h2>${state==='error'?'Could not check access':'No access'}</h2><p>${email?'<b>'+email+'</b><br>':''}${msg}</p></div>
      <div class="lg-acts">${state==='noadmin'?'<button type="button" id="lg-back" class="primary">Back to app</button>':''}<button type="button" id="lg-out">Sign out</button></div></div>`;
    ov.hidden=false;
    ov.querySelector('#lg-out').addEventListener('click',()=>fullSignOut(auth));
    const b=ov.querySelector('#lg-back');if(b)b.addEventListener('click',()=>{location.href='index.html';});
  }
  return {showLogin,showBlocked,hide(){ov.hidden=true;ov.innerHTML='';}};
}
