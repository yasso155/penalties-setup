/* Penalties Setup - Firebase layer (Auth + Firestore). Loaded only on standalone hosting.
   Shared:  existing/chunk-N  (penalty IDs and current values, 500 rows per doc), settings/main (SDG rates)
   Private: drafts/{uid}      (the user's own selections and file batch) */
import {firebaseConfig} from './firebase-config.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,collection,getDocs,deleteDoc,onSnapshot,writeBatch}
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

if(!firebaseConfig.apiKey||!firebaseConfig.projectId){console.info('Firebase not configured: running in local mode.');}
else start();

function start(){
  const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
  const $=id=>document.getElementById(id);
  let P=null,uid=null,unsubs=[];
  const CHUNK=500;

  /* ---------- login overlay ---------- */
  const ov=document.createElement('div');
  ov.id='login';
  ov.innerHTML=`<form class="lg-card" autocomplete="on">
    <h2>Sign in</h2><p>Penalties Setup</p>
    <label>Email<input id="lg-email" type="email" autocomplete="username" required></label>
    <label>Password<input id="lg-pass" type="password" autocomplete="current-password" required></label>
    <div id="lg-err" role="alert"></div>
    <button class="primary" type="submit">Sign in</button></form>`;
  const css=document.createElement('style');
  css.textContent=`#login{position:fixed;inset:0;z-index:100;background:var(--bg,#eef1f6);display:flex;align-items:center;justify-content:center;padding:16px}
  #login[hidden]{display:none}
  .lg-card{width:min(360px,100%);background:var(--surface,#fff);border:1px solid var(--line,#d8dde6);border-radius:12px;padding:24px;display:flex;flex-direction:column;gap:12px}
  .lg-card h2{margin:0;font-size:20px}.lg-card p{margin:0 0 4px;color:var(--muted,#667)}
  .lg-card label{display:flex;flex-direction:column;gap:4px;font-size:13px}
  #lg-err{color:var(--bad,#b3261e);font-size:13px;min-height:1em}
  #who{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted,#667)}
  #who button{padding:2px 8px;font-size:12px}`;
  document.head.appendChild(css);document.body.appendChild(ov);
  ov.querySelector('form').addEventListener('submit',async e=>{
    e.preventDefault();$('lg-err').textContent='';
    try{await signInWithEmailAndPassword(auth,$('lg-email').value.trim(),$('lg-pass').value);}
    catch(err){$('lg-err').textContent='Wrong email or password.';}
  });
  const who=document.createElement('div');who.id='who';who.hidden=true;
  who.innerHTML='<span id="who-mail"></span><button type="button" id="who-out">Sign out</button>';
  document.querySelector('.top').appendChild(who);
  $('who-out').addEventListener('click',()=>signOut(auth));

  /* ---------- helpers ---------- */
  const exRef=()=>collection(db,'existing');
  const toPairs=m=>[...m].map(([k,v])=>[k,[v.id,v.modAmt,v.modMode,v.refAmt,v.refMode]]);
  const fromPairs=p=>new Map(p.map(([k,v])=>[k,{id:v[0],modAmt:v[1],modMode:v[2],refAmt:v[3],refMode:v[4]}]));
  let applying=false,lastExistingSig='';

  async function readExisting(){
    const snap=await getDocs(exRef());return mergeSnap(snap);
  }
  function mergeSnap(snap){
    const docs=[];snap.forEach(d=>docs.push([d.id,d.data()]));
    docs.sort((a,b)=>a[0].localeCompare(b[0],'en',{numeric:true}));
    const pairs=[];let name='';
    for(const [,d] of docs){if(Array.isArray(d.pairs))pairs.push(...d.pairs);if(d.name)name=d.name;}
    return {pairs,name};
  }
  function applyExisting({pairs,name}){
    applying=true;
    P.state.existing=fromPairs(pairs);P.state.existingName=name||'';P.state.imported=pairs.length>0;
    lastExistingSig=pairs.length+'|'+name;
    try{localStorage.removeItem('penalties-existing-v3');}catch(e){}
    P.refresh();applying=false;
  }

  /* ---------- load after login ---------- */
  async function loadAll(){
    // shared settings
    try{const s=await getDoc(doc(db,'settings','main'));if(s.exists()){const d=s.data();
      if(d.sdgOut>0)P.state.sdgOut=d.sdgOut;if(d.sdgIn>0)P.state.sdgIn=d.sdgIn;}}catch(e){console.warn(e);}
    // private draft
    try{const s=await getDoc(doc(db,'drafts',uid));if(s.exists()){const d=s.data();
      if(Array.isArray(d.fares))P.state.fares=new Set(d.fares);
      if(Array.isArray(d.legs))P.state.legs=new Set(d.legs);
      if(d.pen&&d.pen.Before&&d.pen.After)P.state.pen=d.pen;
      if(d.cur)P.state.cur=d.cur;
      if(typeof d.noshowOn==='boolean')P.state.noshowOn=d.noshowOn;
      if(d.startId)P.state.startId=String(d.startId);
      if(typeof d.batchJson==='string'){try{P.state.batch=JSON.parse(d.batchJson);}catch(e){}}
      P.ensureNoShow();}}catch(e){console.warn(e);}
    // shared existing penalties
    let ex={pairs:[],name:''};
    try{ex=await readExisting();}catch(e){console.warn(e);}
    if(ex.pairs.length)applyExisting(ex);
    else if(P.state.imported&&P.state.existing.size){await pushExisting();}   // first time: upload what this browser has
    ['Before','After','NoShow'].forEach(b=>P.drawPen(b));
    P.refresh();
    listen();
  }

  /* ---------- realtime: other users' imports and rate changes ---------- */
  function listen(){
    unsubs.push(onSnapshot(exRef(),snap=>{
      if(snap.metadata.hasPendingWrites)return;
      const ex=mergeSnap(snap),sig=ex.pairs.length+'|'+ex.name;
      if(ex.pairs.length&&sig!==lastExistingSig)applyExisting(ex);
    }));
    unsubs.push(onSnapshot(doc(db,'settings','main'),s=>{
      if(!s.exists()||s.metadata.hasPendingWrites)return;const d=s.data();
      if(d.sdgOut>0&&d.sdgOut!==P.state.sdgOut||d.sdgIn>0&&d.sdgIn!==P.state.sdgIn){
        applying=true;if(d.sdgOut>0)P.state.sdgOut=d.sdgOut;if(d.sdgIn>0)P.state.sdgIn=d.sdgIn;P.refresh();applying=false;}
    }));
  }

  /* ---------- writes (debounced) ---------- */
  let tDraft=null,tEx=null,lastSettings='';
  async function pushDraft(){
    const s=P.state;
    try{
      await setDoc(doc(db,'drafts',uid),{fares:[...s.fares],legs:[...s.legs],pen:s.pen,cur:s.cur,noshowOn:s.noshowOn,
        startId:s.startId,batchJson:JSON.stringify(s.batch),updated:Date.now()});
      const sig=s.sdgOut+'|'+s.sdgIn;
      if(sig!==lastSettings&&s.sdgOut>0&&s.sdgIn>0){lastSettings=sig;await setDoc(doc(db,'settings','main'),{sdgOut:s.sdgOut,sdgIn:s.sdgIn,updated:Date.now()},{merge:true});}
    }catch(e){console.warn('draft save failed',e);}
  }
  async function pushExisting(){
    const s=P.state,pairs=toPairs(s.existing);
    try{
      const old=await getDocs(exRef()),keep=new Set(),batch=writeBatch(db);
      for(let i=0;i*CHUNK<pairs.length;i++){
        const id='chunk-'+String(i).padStart(3,'0');keep.add(id);
        batch.set(doc(db,'existing',id),{pairs:pairs.slice(i*CHUNK,(i+1)*CHUNK),name:i===0?s.existingName:'',updated:Date.now()});
      }
      old.forEach(d=>{if(!keep.has(d.id))batch.delete(d.ref);});
      await batch.commit();
      lastExistingSig=pairs.length+'|'+s.existingName;
    }catch(e){console.warn('existing save failed',e);}
  }
  window.PenHooks={
    onSave(){if(!uid||applying)return;clearTimeout(tDraft);tDraft=setTimeout(pushDraft,1200);},
    onExisting(){if(!uid||applying)return;clearTimeout(tEx);tEx=setTimeout(pushExisting,800);}
  };

  /* ---------- auth state ---------- */
  function boot(){
    onAuthStateChanged(auth,async user=>{
      unsubs.forEach(u=>u());unsubs=[];
      if(!user){uid=null;ov.hidden=false;who.hidden=true;return;}
      uid=user.uid;ov.hidden=true;who.hidden=false;$('who-mail').textContent=user.email||'';
      await loadAll();
    });
  }
  if(window.PenApp){P=window.PenApp;boot();}
  else document.addEventListener('penapp-ready',()=>{P=window.PenApp;boot();},{once:true});
}
