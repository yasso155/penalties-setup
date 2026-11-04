/* Penalties Setup - Firebase layer (Auth + Realtime Database). Loaded only on standalone hosting.
   Shared:  existing/chunk-NNN/json (penalty IDs and current values, 500 rows per chunk, stored as JSON text),
            existing/meta (name), settings (SDG rates)
   Private: drafts/{uid}/json (the user's own selections and file batch)
   Reference: reference/{fare|leg|pax|cur} (editable lookup tables - replaces hardcoded REF) */
import {firebaseConfig} from './firebase-config.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {getDatabase,ref,get,set,update,onValue}
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

if(!firebaseConfig.apiKey||!firebaseConfig.databaseURL){console.info('Firebase not configured: running in local mode.');}
else start();

function start(){
  const SKIP_AUTH = true; // Set to false to require Email/Password login
  const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app);
  const $=id=>document.getElementById(id);
  let P=null,uid=null,unsubs=[];
  const CHUNK=500;

  /* ---------- login overlay ---------- */
  const ov=document.createElement('div');
  ov.id='login';
  if(SKIP_AUTH)ov.hidden=true;
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
  const R=p=>ref(db,p);
  const toPairs=m=>[...m].map(([k,v])=>[k,[v.id,v.modAmt,v.modMode,v.refAmt,v.refMode]]);
  const fromPairs=p=>new Map(p.map(([k,v])=>[k,{id:v[0],modAmt:v[1],modMode:v[2],refAmt:v[3],refMode:v[4]}]));
  let applying=false,lastExistingSig='';

  function parseExisting(val){
    const pairs=[];let name='';
    if(val){
      const ids=Object.keys(val).filter(k=>k.startsWith('chunk-')).sort();
      for(const k of ids){try{pairs.push(...JSON.parse(val[k].json));}catch(e){}}
      if(val.meta&&val.meta.name)name=val.meta.name;
    }
    return {pairs,name};
  }
  function applyExisting({pairs,name}){
    applying=true;
    P.state.existing=fromPairs(pairs);P.state.existingName=name||'';P.state.imported=pairs.length>0;
    lastExistingSig=pairs.length+'|'+name;
    try{localStorage.removeItem('penalties-existing-v3');}catch(e){}
    P.refresh();applying=false;
  }
  const readVal=async p=>{const s=await get(R(p));return s.exists()?s.val():null;};

  /* ---------- reference: load from Firebase and update REF in the app ---------- */
  /**
   * Converts the Firebase reference/{fare|leg|pax} object format:
   *   { "KEY": { label: "...", code: N }, ... }
   * back to the array format the app expects:
   *   [["label", code], ...]
   * sorted by code (ascending) to keep the same order as the original REF.
   */
  function refObjToArray(obj){
    if(!obj)return null;
    return Object.values(obj)
      .sort((a,b)=>a.code-b.code)
      .map(({label,code})=>[label,code]);
  }

  async function loadReference(){
    try{
      const refData=await readVal('reference');
      if(!refData){console.info('No reference data in Firebase, using built-in REF.');return;}

      // Patch window.REF (or P.REF depending on how app exposes it)
      const appRef = window.REF || (P && P.REF);
      if(!appRef){console.warn('REF not found on window or P — skipping reference update.');return;}

      const fareArr = refObjToArray(refData.fare);
      const legArr  = refObjToArray(refData.leg);
      const paxArr  = refObjToArray(refData.pax);

      let changed = false;
      if(fareArr&&fareArr.length){appRef.fare=fareArr;changed=true;}
      if(legArr&&legArr.length){appRef.leg=legArr;changed=true;}
      if(paxArr&&paxArr.length){appRef.pax=paxArr;changed=true;}

      // Enabled currencies from Firebase
      if(refData.cur&&Array.isArray(refData.cur.enabled)&&window.ENABLED_CURRENCIES!==undefined){
        window.ENABLED_CURRENCIES=refData.cur.enabled;changed=true;
      }
      // Quick fares from Firebase
      if(refData.cur&&Array.isArray(refData.cur.quick_fares)&&window.QUICK_FARES!==undefined){
        {const known=new Set((fareArr||appRef.fare||[]).map(x=>x[0]));const q=refData.cur.quick_fares.filter(x=>known.has(x[1]));if(q.length){window.QUICK_FARES=q;changed=true;}}   // ignore labels that are not real fare names
      }
      // Agreement penalties from Firebase
      if(refData.agreement&&Array.isArray(refData.agreement)&&typeof window.updateAgreement==='function'){
        window.updateAgreement(refData.agreement);
      }

      if(changed){
        // Rebuild the CODE lookup maps after updating REF
        if(typeof window.rebuildCode==='function')window.rebuildCode();
        console.info(`Reference loaded from Firebase: ${fareArr?.length||0} fares, ${legArr?.length||0} legs, ${paxArr?.length||0} pax types.`);
      }
    }catch(e){console.warn('loadReference failed, using built-in REF:',e);}
  }

  /* ---------- load after login ---------- */
  async function loadAll(){
    // Load reference data first (non-blocking: app works with built-in REF if this fails)
    await loadReference();

    try{const d=await readVal('settings');if(d){
      if(d.sdgOut>0)P.state.sdgOut=d.sdgOut;if(d.sdgIn>0)P.state.sdgIn=d.sdgIn;}}catch(e){console.warn(e);}
    try{const o=await readVal('drafts/'+uid);if(o&&o.json){const d=JSON.parse(o.json);
      if(Array.isArray(d.fares)){P.state.fares.clear();d.fares.map(x=>P.fixFare?P.fixFare(x):x).forEach(x=>P.state.fares.add(x));}   // mutate in place: the pickers hold this Set
      if(Array.isArray(d.legs)){P.state.legs.clear();d.legs.forEach(x=>P.state.legs.add(x));}
      if(d.pen&&d.pen.Before&&d.pen.After)P.state.pen=d.pen;
      if(d.cur)P.state.cur=d.cur;
      if(typeof d.noshowOn==='boolean')P.state.noshowOn=d.noshowOn;
      if(d.startId)P.state.startId=String(d.startId);
      if(Array.isArray(d.batch))P.state.batch=d.batch;
      P.ensureNoShow();}}catch(e){console.warn(e);}
    let ex={pairs:[],name:''};
    try{ex=parseExisting(await readVal('existing'));}catch(e){console.warn(e);}
    if(ex.pairs.length)applyExisting(ex);
    else if(P.state.imported&&P.state.existing.size){await pushExisting();}   // first time: upload what this browser has
    ['Before','After','NoShow'].forEach(b=>P.drawPen(b));
    if(P.redrawPickers)P.redrawPickers();
    P.refresh();
    listen();
  }

  /* ---------- realtime: other users' imports and rate changes ---------- */
  function listen(){
    unsubs.push(onValue(R('existing'),s=>{
      const ex=parseExisting(s.exists()?s.val():null),sig=ex.pairs.length+'|'+ex.name;
      if(ex.pairs.length&&sig!==lastExistingSig)applyExisting(ex);
    }));
    unsubs.push(onValue(R('settings'),s=>{
      if(!s.exists())return;const d=s.val();
      if((d.sdgOut>0&&d.sdgOut!==P.state.sdgOut)||(d.sdgIn>0&&d.sdgIn!==P.state.sdgIn)){
        applying=true;if(d.sdgOut>0)P.state.sdgOut=d.sdgOut;if(d.sdgIn>0)P.state.sdgIn=d.sdgIn;P.refresh();applying=false;}
    }));
    // Live reference updates (e.g. admin adds new leg/fare from console)
    unsubs.push(onValue(R('reference'),async s=>{
      if(!s.exists())return;
      await loadReference();
      P.refresh();
    }));
  }

  /* ---------- writes (debounced) ---------- */
  let tDraft=null,tEx=null,lastSettings='';
  async function pushDraft(){
    const s=P.state;
    try{
      await set(R('drafts/'+uid),{json:JSON.stringify({fares:[...s.fares],legs:[...s.legs],pen:s.pen,cur:s.cur,noshowOn:s.noshowOn,
        startId:s.startId,batch:s.batch}),updated:Date.now()});
      const sig=s.sdgOut+'|'+s.sdgIn;
      if(sig!==lastSettings&&s.sdgOut>0&&s.sdgIn>0){lastSettings=sig;await update(R('settings'),{sdgOut:s.sdgOut,sdgIn:s.sdgIn,updated:Date.now()});}
    }catch(e){console.warn('draft save failed',e);}
  }
  async function pushExisting(){
    const s=P.state,pairs=toPairs(s.existing),CH=500,obj={meta:{name:s.existingName||'',updated:Date.now()}};
    for(let i=0;i*CH<pairs.length;i++)obj['chunk-'+String(i).padStart(3,'0')]={json:JSON.stringify(pairs.slice(i*CH,(i+1)*CH))};
    try{
      lastExistingSig=pairs.length+'|'+(s.existingName||'');
      await set(R('existing'),obj);   // replaces the whole shared table in one write
    }catch(e){console.warn('existing save failed',e);}
  }
  window.PenHooks={
    onSave(){if(!uid||applying)return;clearTimeout(tDraft);tDraft=setTimeout(pushDraft,1200);},
    onExisting(){if(!uid||applying)return;clearTimeout(tEx);tEx=setTimeout(pushExisting,800);}
  };

  /* ---------- auth state ---------- */
  function boot(){
    if(SKIP_AUTH){
      uid='shared';
      ov.hidden=true;
      who.hidden=true;
      loadAll();
      return;
    }
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
