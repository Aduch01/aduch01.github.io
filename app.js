/* Le Tableau — version hébergée (GitHub Pages + Firebase)
   Tout le monde lit sans compte. Seul le propriétaire (OWNER_UID) publie. */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getFirestore,collection,doc,setDoc,deleteDoc,onSnapshot} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {firebaseConfig,OWNER_UID,PLACE} from './config.js?v=13';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COLORS=['#ffd84d','#ff9eb8','#8fd0ff','#f1f1ea','#ffb37a'];
const D={notes:[],ann:[],photos:[],wx:null};
const R={notes:[],ann:[],photos:[]};   // publié depuis la conversation (data.json)
let HID=new Set();                       // éléments de data.json masqués depuis la tablette
const all=k=>{const m=new Map();for(const x of R[k])if(!HID.has(x.id))m.set(x.id,x);for(const x of D[k])m.set(x.id,x);return[...m.values()]};
const S={canW:false,user:null,day:0,kind:'tache',filt:'all',col:COLORS[0],edit:null,pi:0};

/* ---------- Firebase ---------- */
const FB_OK=!!firebaseConfig.apiKey&&!firebaseConfig.apiKey.startsWith('A_');
const fb=FB_OK?initializeApp(firebaseConfig):null;
const db=FB_OK?getFirestore(fb):null,auth=FB_OK?getAuth(fb):null;
if(!FB_OK){document.getElementById('login').hidden=true}
const COL={notes:'notes',ann:'annonces',photos:'photos'};
function status(t){$('#status').textContent=t}
let firstData=false;
setTimeout(()=>{if(!firstData)status(FB_OK?'Données injoignables pour l\'instant':'Base de données pas encore branchée')},FB_OK?10000:0);
if(FB_OK)for(const k of Object.keys(COL)){
 onSnapshot(collection(db,COL[k]),snap=>{
  D[k]=snap.docs.map(d=>({...d.data(),id:d.id}));firstData=true;
  if(!S.canW)status('');rerender();
 },()=>status('Synchronisation interrompue'));
}
async function put(k,o){const {id,src,...data}=o;
 const i=D[k].findIndex(x=>x.id===id);i<0?D[k].push(o):D[k][i]=o;rerender();
 try{await setDoc(doc(db,COL[k],id),data);status('Publié')}catch(e){status('Échec : '+(e.code||'erreur'))}}
async function drop(k,id){const o=all(k).find(x=>x.id===id);D[k]=D[k].filter(x=>x.id!==id);
 const fromR=R[k].some(x=>x.id===id);if(fromR)HID.add(id);rerender();
 try{await deleteDoc(doc(db,COL[k],id));if(fromR)await setDoc(doc(db,'masques','liste'),{ids:[...HID]});status('Supprimé')}catch(e){status('Échec : '+(e.code||'erreur'))}return o}
if(FB_OK)onSnapshot(doc(db,'masques','liste'),s=>{HID=new Set(s.exists()?s.data().ids||[]:[]);rerender()},()=>{});
async function loadR(){try{const r=await fetch('data.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;const j=await r.json();
 for(const k of ['notes','ann','photos'])R[k]=Array.isArray(j[k])?j[k].map(x=>({...x,src:'claude'})):[];rerender()}catch(e){}}
loadR();setInterval(loadR,60*1000);

/* ---------- connexion du propriétaire ---------- */
$('#login').addEventListener('click',async()=>{
 if(S.user){await signOut(auth);return}
 const p=new GoogleAuthProvider();
 try{await signInWithPopup(auth,p)}catch(e){if(/popup/.test(e.code||''))await signInWithRedirect(auth,p);else status('Connexion impossible : '+(e.code||''))}});
if(FB_OK)onAuthStateChanged(auth,u=>{
 S.user=u;S.canW=!!u&&u.uid===OWNER_UID;
 $('#login').textContent=u?'Déconnexion':'Connexion';
 const box=$('#uid');
 if(u&&!S.canW){box.hidden=false;box.textContent='Connecté, mais pas propriétaire. Identifiant à envoyer à Claude : '+u.uid}else box.hidden=true;
 status(S.canW?'Mode publication : toi seul peux modifier':'');
 lockUI();rerender();if(typeof csApply==='function')csApply()});

/* ---------- horloge ---------- */
const fD=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
function tick(){const d=new Date();$('#clock').textContent=d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});$('#date').textContent=fD.format(d)}
tick();setInterval(tick,1000);

/* ---------- météo (Open-Meteo, mise à jour automatique) ---------- */
const WMO={0:'Ciel clair',1:'Plutôt clair',2:'Éclaircies',3:'Couvert',45:'Brouillard',48:'Brouillard givrant',51:'Bruine légère',53:'Bruine',55:'Bruine forte',56:'Bruine verglaçante',57:'Bruine verglaçante',61:'Pluie faible',63:'Pluie modérée',65:'Pluie forte',66:'Pluie verglaçante',67:'Pluie verglaçante',71:'Neige faible',73:'Neige modérée',75:'Neige forte',77:'Grains de neige',80:'Averses faibles',81:'Averses',82:'Averses violentes',85:'Averses de neige',86:'Fortes averses de neige',95:'Orage',96:'Orage avec grêle',99:'Orage avec forte grêle'};
const DIRS=['N','NE','E','SE','S','SO','O','NO'];
async function loadWx(){
 const u=`https://api.open-meteo.com/v1/forecast?latitude=${PLACE.lat}&longitude=${PLACE.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant,sunrise,sunset&timezone=Europe%2FParis&forecast_days=7`;
 try{const r=await fetch(u);if(!r.ok)throw 0;const j=await r.json(),d=j.daily;
  D.wx={ville:PLACE.name,maj:new Date().toISOString(),source:'Open-Meteo',actuelle:Math.round(j.current.temperature_2m),ressenti:Math.round(j.current.apparent_temperature),hum:j.current.relative_humidity_2m,condNow:WMO[j.current.weather_code]||'',
   jours:d.time.map((t,i)=>({date:t,cond:WMO[d.weather_code[i]]||'—',max:Math.round(d.temperature_2m_max[i]),min:Math.round(d.temperature_2m_min[i]),pluie:d.precipitation_probability_max[i]??0,mm:Math.round((d.precipitation_sum[i]||0)*10)/10,vent:Math.round(d.wind_speed_10m_max[i]),dir:DIRS[Math.round((d.wind_direction_10m_dominant[i]||0)/45)%8],lever:(d.sunrise[i]||'').slice(11),coucher:(d.sunset[i]||'').slice(11)}))};
 }catch(e){if(!D.wx)D.wx=null}
 renderWx()}
loadWx();setInterval(loadWx,30*60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&D.wx&&Date.now()-new Date(D.wx.maj)>30*60*1000)loadWx()});

function ico(c,night){c=(c||'').toLowerCase();
 const sun=(x=32,y=28,r=13)=>`<circle cx="${x}" cy="${y}" r="${r*1.9}" fill="url(#w-glow)"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#w-sun)" filter="url(#w-sh)"/>`;
 const moon=(x=30,y=26)=>`<path d="M${x+6} ${y-14}a14 14 0 1 0 10 22 11 11 0 0 1-10-22z" fill="url(#w-cloud)" filter="url(#w-sh)"/>`;
 const cloud=(dx=0,dy=0,k=1,f='w-cloud')=>`<path transform="translate(${dx} ${dy}) scale(${k})" d="M17 48h30a10 10 0 0 0 1.2-19.9A14 14 0 0 0 21.3 27 10.5 10.5 0 0 0 17 48z" fill="url(#${f})" filter="url(#w-sh)"/>`;
 const drops=[21,32,43].map((x,i)=>{const y=47+i%2*4;return `<path d="M${x} ${y}c-3 5-4.5 7.5-4.5 9.5a4.5 4.5 0 0 0 9 0c0-2-1.5-4.5-4.5-9.5z" fill="url(#w-drop)" filter="url(#w-sh)" transform="rotate(14 ${x} ${y+7})"/>`}).join('');
 let s;
 if(/neige|grain/.test(c))s=cloud(0,-6)+[20,32,44].map((x,i)=>`<circle cx="${x}" cy="${52+i%2*4}" r="3.2" fill="#fff" filter="url(#w-sh)"/>`).join('');
 else if(/orage/.test(c))s=cloud(0,-6,1,'w-cloud2')+'<path d="M33 44l-7 11h6l-3 9 11-14h-6l3-6z" fill="url(#w-bolt)" filter="url(#w-sh)"/>';
 else if(/pluie|averse|bruine/.test(c))s=cloud(0,-8,1,/forte|violent/.test(c)?'w-cloud2':'w-cloud')+drops;
 else if(/brume|brouillard/.test(c))s=cloud(0,-6,1,'w-cloud2')+'<g stroke="#dfe6f2" stroke-width="3.5" stroke-linecap="round" opacity=".85"><line x1="12" y1="50" x2="46" y2="50"/><line x1="20" y1="57" x2="54" y2="57"/></g>';
 else if(/clair|soleil/.test(c))s=night?moon(32,32):sun(32,32,14);
 else if(/éclairc|partiel/.test(c))s=(night?moon(24,22):sun(24,22,11))+cloud(6,6,.9);
 else s=cloud(-6,-8,.85,'w-cloud2')+cloud(4,2,.95);
 return `<svg viewBox="0 0 64 64" aria-hidden="true">${s}</svg>`}
function sky(c,night){c=(c||'').toLowerCase();
 if(/orage/.test(c))return 'storm';if(/neige|grain/.test(c))return 'snow';if(/pluie|averse|bruine/.test(c))return night?'night':'rain';
 if(/brume|brouillard/.test(c))return 'fog';if(night)return 'night';if(/clair|soleil|éclairc|partiel/.test(c))return 'sun';return 'cloud'}
function isNight(d){const t=new Date().toTimeString().slice(0,5);return !!(d&&d.lever&&d.coucher)&&(t<d.lever||t>d.coucher)}
const jour=d=>new Date(d+'T12:00').toLocaleDateString('fr-FR',{weekday:'short'}).replace('.','');
const jourL=d=>new Date(d+'T12:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
const fmtMaj=s=>{const d=new Date(s);return isNaN(d)?'—':d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})};

function renderWx(){
 const w=D.wx,H=$('#h-wx');
 if(!w||!w.jours?.length){H.innerHTML='<div class="empty">Météo indisponible pour le moment.</div>';$('#m-day').innerHTML=H.innerHTML;$('#m-week').innerHTML='';return}
 const J=w.jours,t=J[0];
 const days=J.map((d,i)=>`<button type="button" class="day${i===S.day?' sel':''}" data-day="${i}"><small>${i?esc(jour(d.date)):'Auj.'}</small>${ico(d.cond)}<b>${esc(d.max)}°</b><small>${esc(d.min)}°</small></button>`).join('');
 const nt=isNight(t);$('#wxcard').dataset.sky=sky(w.condNow||t.cond,nt);
 H.innerHTML=`<div class="wx-now">${ico(w.condNow||t.cond,nt)}<div><div class="big">${esc(w.actuelle)}°</div><div class="cond">${esc(w.condNow||t.cond)} · ${esc(w.ville)}</div><div class="wx-more">Ressenti ${esc(w.ressenti)}° · humidité ${esc(w.hum)} %</div></div></div><div class="days">${days}</div><div class="maj">Mise à jour automatique · ${esc(fmtMaj(w.maj))}</div>`;
 const d=J[S.day]||t;
 $('#m-title').textContent='Météo à '+w.ville;
 $('#m-day').dataset.sky=sky(d.cond,S.day===0&&nt);
 $('#m-day').innerHTML=`<h2>${esc(jourL(d.date))}</h2><div class="wx-now">${ico(d.cond,S.day===0&&nt)}<div><div class="big">${esc(d.max)}° <span style="font-size:.5em;color:var(--mut)">/ ${esc(d.min)}°</span></div><div class="cond">${esc(d.cond)}</div></div></div><div class="wx-detail"><div class="stat"><span>Risque de pluie</span><b>${esc(d.pluie)} %</b></div><div class="stat"><span>Cumul</span><b>${esc(d.mm)} mm</b></div><div class="stat"><span>Vent max</span><b>${esc(d.vent)} km/h ${esc(d.dir)}</b></div><div class="stat"><span>Soleil</span><b>${esc(d.lever)} – ${esc(d.coucher)}</b></div></div><div class="days">${days}</div>`;
 const lo=Math.min(...J.map(x=>x.min)),hi=Math.max(...J.map(x=>x.max)),sp=(hi-lo)||1;
 $('#m-week').innerHTML=J.map((x,i)=>`<button type="button" class="range" data-day="${i}" style="width:100%;text-align:left;border-radius:0"><span>${i?esc(jour(x.date)):'Auj.'} <b>${esc(x.min)}°</b></span><span><span class="track"><i style="left:${(x.min-lo)/sp*100}%;right:${100-(x.max-lo)/sp*100}%"></i></span><span class="rain" style="display:block;width:${Math.max(2,+x.pluie||0)}%"></span></span><span style="text-align:right"><b>${esc(x.max)}°</b> · ${esc(x.pluie)}%</span></button>`).join('');
 $('#m-maj').textContent='Barre colorée : écart min–max · trait bleu : risque de pluie. Source Open-Meteo, mise à jour toutes les 30 min (dernière à '+fmtMaj(w.maj)+').';
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-day]');if(!b)return;S.day=+b.dataset.day;if(location.hash!=='#meteo')location.hash='meteo';renderWx()});

/* ---------- notes ---------- */
$('#n-colors').innerHTML=COLORS.map(c=>`<button type="button" class="sw${c===S.col?' sel':''}" data-c="${c}" style="background:${c}" aria-label="Couleur"></button>`).join('');
$('#n-colors').addEventListener('click',e=>{const b=e.target.closest('[data-c]');if(!b)return;S.col=b.dataset.c;document.querySelectorAll('.sw').forEach(x=>x.classList.toggle('sel',x===b))});
const nc=c=>COLORS.includes(c)?c:COLORS[0];
function renderNotes(){
 const L=[...all('notes')].sort((x,y)=>(y.pin|0)-(x.pin|0)||(x.done|0)-(y.done|0)||y.t-x.t);
 $('#n-list').innerHTML=L.length?L.map((n,i)=>`<article class="note${n.done?' done':''}" style="--nc:${nc(n.c)}"><small>${n.pin?'Épinglée · ':''}${esc(new Date(n.t).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}))}</small><p>${esc(n.text)}</p>${S.canW?`<div class="row"><button type="button" data-n="done" data-id="${esc(n.id)}" aria-label="Fait">${n.done?'↺':'✓'}</button><button type="button" data-n="pin" data-id="${esc(n.id)}">${n.pin?'Désépingler':'Épingler'}</button><button type="button" data-n="edit" data-id="${esc(n.id)}">Modifier</button><button type="button" data-n="del" data-id="${esc(n.id)}" aria-label="Supprimer">✕</button></div>`:''}</article>`).join(''):'<div class="empty plate">Aucune note pour l\'instant.</div>';
 $('#h-notes').innerHTML=L.filter(n=>!n.done).slice(0,4).map(n=>`<li class="mline"><span class="dot" style="background:${nc(n.c)};color:${nc(n.c)}"></span><span>${esc(n.text.length>90?n.text.slice(0,90)+'…':n.text)}</span></li>`).join('')||'<li class="empty">Rien à signaler.</li>';
}
$('#n-add').addEventListener('click',()=>{const text=$('#n-text').value.trim();if(!text||!S.canW)return;
 if(S.edit){const n=all('notes').find(x=>x.id===S.edit);if(n)put('notes',{...n,text,c:S.col});S.edit=null;$('#n-add').textContent='Ajouter la note';$('#n-cancel').hidden=true}
 else put('notes',{id:'n'+Date.now().toString(36),text,c:S.col,done:false,pin:false,t:Date.now()});
 $('#n-text').value=''});
$('#n-cancel').addEventListener('click',()=>{S.edit=null;$('#n-text').value='';$('#n-add').textContent='Ajouter la note';$('#n-cancel').hidden=true});
$('#n-list').addEventListener('click',async e=>{const b=e.target.closest('[data-n]');if(!b||!S.canW)return;const n=all('notes').find(x=>x.id===b.dataset.id);if(!n)return;const a=b.dataset.n;
 if(a==='done')put('notes',{...n,done:!n.done});
 if(a==='pin')put('notes',{...n,pin:!n.pin});
 if(a==='edit'){S.edit=n.id;$('#n-text').value=n.text;S.col=nc(n.c);$('#n-add').textContent='Enregistrer';$('#n-cancel').hidden=false;$('#n-text').focus()}
 if(a==='del'){const o=await drop('notes',n.id);undo('Note supprimée',()=>put('notes',o))}});

/* ---------- annonces ---------- */
$('#a-kind').addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(!b)return;S.kind=b.dataset.k;$('#a-kind').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b))});
$('#a-filter').addEventListener('click',e=>{const b=e.target.closest('[data-f]');if(!b)return;S.filt=b.dataset.f;$('#a-filter').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));renderAnn()});
function renderAnn(){
 const L=[...all('ann')].filter(a=>a.k!=='rdv').sort((x,y)=>(x.done|0)-(y.done|0)||y.t-x.t),F=L.filter(a=>S.filt==='all'||a.k===S.filt);
 $('#a-list').innerHTML=F.length?F.map(a=>`<li class="item${a.done?' done':''}">${a.k==='tache'?`<button type="button" class="check${a.done?' on':''}" data-a="done" data-id="${esc(a.id)}" ${S.canW?'':'disabled'} aria-label="Fait">${a.done?'✓':''}</button>`:'<span class="tag n">Nouvelle</span>'}<div><h3>${esc(a.title)}</h3>${a.body?`<p>${esc(a.body)}</p>`:''}<div class="hint">${esc(new Date(a.t).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}${a.k==='tache'?' · tâche':''}</div></div>${S.canW?`<button type="button" class="ghost" data-a="del" data-id="${esc(a.id)}" aria-label="Supprimer">✕</button>`:'<span></span>'}</li>`).join(''):'<li class="empty plate">Rien de publié ici.</li>';
 $('#h-ann').innerHTML=L.filter(a=>!a.done).slice(0,3).map(a=>`<li class="mline"><span class="tag ${a.k==='tache'?'t':'n'}">${a.k==='tache'?'Tâche':'Nouvelle'}</span><span>${esc(a.title)}</span></li>`).join('')||'<li class="empty">Aucune tâche en cours.</li>';
}
$('#a-add').addEventListener('click',()=>{const title=$('#a-title').value.trim();if(!title||!S.canW)return;
 put('ann',{id:'a'+Date.now().toString(36),k:S.kind,title,body:$('#a-body').value.trim(),done:false,t:Date.now()});$('#a-title').value='';$('#a-body').value=''});
$('#a-list').addEventListener('click',async e=>{const b=e.target.closest('[data-a]');if(!b||!S.canW)return;const a=all('ann').find(x=>x.id===b.dataset.id);if(!a)return;
 if(b.dataset.a==='done')put('ann',{...a,done:!a.done});
 else{const o=await drop('ann',a.id);undo('Annonce supprimée',()=>put('ann',o))}});

/* ---------- photos (réduites puis stockées dans Firestore) ---------- */
const ok=u=>typeof u==='string'&&(u.startsWith('data:image/jpeg;base64,')||/^photos\/[\w.-]+\.(jpe?g|png|webp)$/i.test(u));
const ph=()=>all('photos').map(p=>({...p,img:p.img||p.file})).filter(p=>ok(p.img)).sort((x,y)=>y.t-x.t);
function renderPhotos(){
 const L=ph();
 $('#p-grid').innerHTML=L.length?L.map((p,i)=>`<button type="button" class="thumb" data-p="${i}"><img src="${p.img}" alt="${esc(p.cap||'Photo')}" loading="lazy"></button>`).join(''):'<div class="empty plate" style="grid-column:1/-1">Aucune photo pour l\'instant.</div>';
 $('#strip').innerHTML=L.map(p=>`<figure><img src="${p.img}" alt="${esc(p.cap||'Photo')}"><figcaption>${esc(p.cap||'')}</figcaption></figure>`).join('');
 slide(true)}
function slide(keep){const L=ph(),P=$('#h-pic');
 if(!L.length){P.innerHTML='<div class="empty">Pas encore de photo.</div>';$('#h-cap').textContent='';return}
 if(!keep)S.pi=(S.pi+1)%L.length;S.pi%=L.length;const p=L[S.pi];
 P.innerHTML=`<img src="${p.img}" alt="${esc(p.cap||'Photo')}">`;$('#h-cap').textContent=p.cap||''}
setInterval(()=>{if(!document.hidden)slide(false)},9000);
$('#p-grid').addEventListener('click',e=>{const b=e.target.closest('[data-p]');if(b)openV(+b.dataset.p)});
$('#h-pic').addEventListener('click',()=>{if(ph().length)openV(S.pi)});
const curV=()=>Math.round($('#strip').scrollLeft/Math.max(1,$('#strip').clientWidth));
function openV(i){$('#viewer').classList.add('on');$('#vdel').hidden=!S.canW;requestAnimationFrame(()=>$('#strip').children[i]?.scrollIntoView({inline:'center'}))}
function goV(d){const n=$('#strip').children.length;if(!n)return;$('#strip').children[Math.max(0,Math.min(n-1,curV()+d))].scrollIntoView({behavior:'smooth',inline:'center'})}
$('#vp').addEventListener('click',()=>goV(-1));$('#vn').addEventListener('click',()=>goV(1));$('#vx').addEventListener('click',()=>$('#viewer').classList.remove('on'));
$('#vdel').addEventListener('click',async()=>{const p=ph()[curV()];if(!p||!S.canW)return;$('#viewer').classList.remove('on');const o=await drop('photos',p.id);undo('Photo retirée',()=>put('photos',o))});
document.addEventListener('keydown',e=>{if(!$('#viewer').classList.contains('on'))return;if(e.key==='ArrowLeft')goV(-1);if(e.key==='ArrowRight')goV(1);if(e.key==='Escape')$('#viewer').classList.remove('on')});
async function readImg(file){
 try{return await createImageBitmap(file,{imageOrientation:'from-image'})}catch(e){}
 const url=URL.createObjectURL(file);
 try{const im=new Image();im.src=url;await im.decode();return im}finally{setTimeout(()=>URL.revokeObjectURL(url),5000)}}
async function shrink(file){
 const bmp=await readImg(file);
 let max=1600,q=.82,out='';
 for(let k=0;k<6;k++){const r=Math.min(1,max/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');
  c.width=Math.round(bmp.width*r);c.height=Math.round(bmp.height*r);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
  out=c.toDataURL('image/jpeg',q);if(out.length<900000)return out;max*=.8;q=Math.max(.6,q-.06)}
 return out}
$('#p-file').addEventListener('change',async e=>{const fs=[...e.target.files];e.target.value='';if(!fs.length||!S.canW)return;
 let n=0;for(const f of fs){$('#p-msg').textContent=`Préparation ${n+1}/${fs.length}…`;
  try{const img=await shrink(f);await put('photos',{id:'p'+Date.now().toString(36)+n,img,cap:$('#p-cap').value.trim(),t:Date.now()});n++}
  catch(err){$('#p-msg').textContent='Échec pour une photo : '+(err?.message||'format non lu');}}
 $('#p-cap').value='';if(n)$('#p-msg').textContent=n+' photo(s) publiée(s).'});


/* ---------- agenda (RDV stockés avec les annonces, type "rdv") ---------- */
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const TODAY=()=>iso(new Date());
S.cm=new Date();S.cm.setDate(1);S.cd=TODAY();S.rcol=COLORS[1];S.redit=null;
const rdvs=()=>all('ann').filter(a=>a.k==='rdv'&&/^\d{4}-\d{2}-\d{2}$/.test(a.date||'')).sort((x,y)=>(x.date+(x.heure||'')).localeCompare(y.date+(y.heure||'')));
function feries(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;
 const P=new Date(y,mo-1,da),add=n=>iso(new Date(y,mo-1,da+n));
 return {[y+'-01-01']:"Jour de l'an",[add(1)]:'Lundi de Pâques',[y+'-05-01']:'Fête du Travail',[y+'-05-08']:'Victoire 1945',[add(39)]:'Ascension',[add(50)]:'Lundi de Pentecôte',[y+'-07-14']:'Fête nationale',[y+'-08-15']:'Assomption',[y+'-11-01']:'Toussaint',[y+'-11-11']:'Armistice',[y+'-12-25']:'Noël'}}
$('#r-colors').innerHTML=COLORS.map(c=>`<button type="button" class="sw${c===S.rcol?' sel':''}" data-c="${c}" style="background:${c}" aria-label="Couleur"></button>`).join('');
$('#r-colors').addEventListener('click',e=>{const b=e.target.closest('[data-c]');if(!b)return;S.rcol=b.dataset.c;$('#r-colors').querySelectorAll('.sw').forEach(x=>x.classList.toggle('sel',x===b))});
function renderCal(){
 const y=S.cm.getFullYear(),m=S.cm.getMonth(),F={...feries(y),...feries(y+1),...feries(y-1)};
 $('#c-title').textContent=S.cm.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
 const start=new Date(y,m,1);start.setDate(1-((start.getDay()+6)%7));
 const last=new Date(y,m+1,0),cells=Math.ceil(((new Date(y,m,1).getDay()+6)%7+last.getDate())/7)*7;
 const byDay={};for(const r of rdvs())(byDay[r.date]??=[]).push(r);
 let h='';const td=TODAY();
 for(let i=0;i<cells;i++){const d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i),k=iso(d),ev=byDay[k]||[],wd=(d.getDay()+6)%7;
  h+=`<button type="button" class="cd${d.getMonth()!==m?' out':''}${wd>4?' we':''}${k===td?' today':''}${k===S.cd?' sel':''}" data-cd="${k}"><span class="n">${d.getDate()}</span>${F[k]?`<span class="hol">${esc(F[k])}</span>`:''}${ev.slice(0,3).map(r=>`<span class="ev" style="--nc:${nc(r.c)}">${r.heure?esc(r.heure)+' ':''}${esc(r.title)}</span>`).join('')}${ev.length>3?`<span class="more">+${ev.length-3} autre(s)</span>`:''}${ev.length?`<span class="dots">${ev.slice(0,3).map(r=>`<i style="--nc:${nc(r.c)}"></i>`).join('')}</span>`:''}</button>`}
 $('#cal').innerHTML=h;
 const dd=new Date(S.cd+'T12:00'),hol=F[S.cd];
 $('#c-day').textContent=dd.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})+(hol?' · '+hol:'');
 const L=byDay[S.cd]||[];
 $('#c-list').innerHTML=L.length?L.map(r=>`<li class="item rdv" style="--nc:${nc(r.c)}"><span class="h">${esc(r.heure||'Journée')}</span><div><h3>${esc(r.title)}</h3>${r.lieu?`<p>📍 ${esc(r.lieu)}</p>`:''}${r.body?`<p>${esc(r.body)}</p>`:''}</div>${S.canW?`<div class="row"><button type="button" data-r="edit" data-id="${esc(r.id)}">Modifier</button><button type="button" data-r="del" data-id="${esc(r.id)}" aria-label="Supprimer">✕</button></div>`:'<span></span>'}</li>`).join(''):'<li class="empty">Aucun rendez-vous ce jour-là.</li>';
 if(!S.redit)$('#r-date').value=S.cd;
 const up=rdvs().filter(r=>r.date>=td).slice(0,4);
 $('#h-rdv').innerHTML=up.length?up.map(r=>{const d=new Date(r.date+'T12:00');return `<li class="mline up" style="--nc:${nc(r.c)}"><span class="d">${r.date===td?"Auj.":esc(d.toLocaleDateString('fr-FR',{weekday:'short'}).replace('.',''))}<b>${d.getDate()}</b></span><span><b>${esc(r.title)}</b><br><small style="color:var(--mut)">${esc(r.heure||'Journée')}${r.lieu?' · '+esc(r.lieu):''}</small></span></li>`}).join(''):'<li class="empty">Aucun rendez-vous à venir.</li>';
}
$('#cal').addEventListener('click',e=>{const b=e.target.closest('[data-cd]');if(!b)return;S.cd=b.dataset.cd;const d=new Date(S.cd+'T12:00');if(d.getMonth()!==S.cm.getMonth()){S.cm=new Date(d.getFullYear(),d.getMonth(),1)}renderCal();if(innerWidth<1000)$('#c-day').scrollIntoView({behavior:'smooth',block:'start'})});
$('#c-prev').addEventListener('click',()=>{S.cm=new Date(S.cm.getFullYear(),S.cm.getMonth()-1,1);renderCal()});
$('#c-next').addEventListener('click',()=>{S.cm=new Date(S.cm.getFullYear(),S.cm.getMonth()+1,1);renderCal()});
$('#c-today').addEventListener('click',()=>{const d=new Date();S.cm=new Date(d.getFullYear(),d.getMonth(),1);S.cd=TODAY();renderCal()});
function resetR(){S.redit=null;['#r-title','#r-time','#r-lieu','#r-note'].forEach(x=>$(x).value='');$('#r-date').value=S.cd;$('#r-add').textContent='Ajouter le RDV';$('#r-cancel').hidden=true}
$('#r-add').addEventListener('click',()=>{const title=$('#r-title').value.trim(),date=$('#r-date').value;if(!title||!date||!S.canW)return;
 const base=S.redit?all('ann').find(x=>x.id===S.redit):null;
 put('ann',{...(base||{}),id:base?base.id:'r'+Date.now().toString(36),k:'rdv',title,date,heure:$('#r-time').value,lieu:$('#r-lieu').value.trim(),body:$('#r-note').value.trim(),c:S.rcol,done:false,t:base?.t||Date.now()});
 S.cd=date;const d=new Date(date+'T12:00');S.cm=new Date(d.getFullYear(),d.getMonth(),1);resetR();renderCal()});
$('#r-cancel').addEventListener('click',()=>{resetR();renderCal()});
$('#c-list').addEventListener('click',async e=>{const b=e.target.closest('[data-r]');if(!b||!S.canW)return;const r=all('ann').find(x=>x.id===b.dataset.id);if(!r)return;
 if(b.dataset.r==='edit'){S.redit=r.id;$('#r-title').value=r.title;$('#r-date').value=r.date;$('#r-time').value=r.heure||'';$('#r-lieu').value=r.lieu||'';$('#r-note').value=r.body||'';S.rcol=nc(r.c);
  $('#r-colors').querySelectorAll('.sw').forEach(x=>x.classList.toggle('sel',x.dataset.c===S.rcol));$('#r-add').textContent='Enregistrer';$('#r-cancel').hidden=false;$('#r-title').focus()}
 else{const o=await drop('ann',r.id);undo('Rendez-vous supprimé',()=>put('ann',o))}});
setInterval(()=>{if(!document.hidden&&$('#h-rdv'))renderCal()},5*60*1000);


/* ---------- utile : recettes (recettes.json, publiées depuis la conversation) ---------- */
let RC=[];const RS={};
async function loadRC(){try{const r=await fetch('recettes.json?t='+Date.now(),{cache:'no-store'});if(r.ok)RC=await r.json()}catch(e){}renderRC();route()}
const fmtQ=(q,u)=>{if(!q)return '';let v=q;if(u==='g'&&v>=1000){v=v/1000;u='kg'}
 const r=v>=10?Math.round(v):Math.round(v*4)/4;const s=Number.isInteger(r)?String(r):String(r).replace('.',',');return s+(u?' '+u:'')};
const unit=(r,n)=>{const u=Array.isArray(r.unite)?r.unite:['personne','personnes'];return n+' '+(n>1?u[1]:u[0])};
function renderRC(){
 $('#u-rc').textContent=RC.length+' recette'+(RC.length>1?'s':'');
 $('#rc-list').innerHTML=RC.length?RC.map(r=>`<a class="rcard" href="#recette-${esc(r.id)}"><h3>${esc(r.titre)}</h3><p>${esc(r.intro||'')}</p><div class="meta"><span>${esc(unit(r,r.portions))}</span><span>Prépa ${esc(r.prep)}</span><span>Cuisson ${esc(r.cuisson)}</span>${r.repos?`<span>Repos ${esc(r.repos)}</span>`:''}</div></a>`).join(''):'<div class="empty plate">Aucune recette pour l\'instant.</div>'}
function renderOne(id){
 const r=RC.find(x=>x.id===id);if(!r){$('#rc-one').innerHTML='<div class="empty plate">Recette introuvable.</div>';return}
 const st=RS[id]??={p:r.portions,ing:new Set(),ok:new Set()},k=st.p/r.portions;
 $('#rc-one').innerHTML=`<div class="rhead"><h1 class="v"><svg class="ic-l"><use href="#i-recette"/></svg>${esc(r.titre)}</h1><p>${esc(r.intro||'')}</p><div class="meta"><span>Prépa ${esc(r.prep)}</span><span>Cuisson ${esc(r.cuisson)}</span>${r.repos?`<span>Repos ${esc(r.repos)}</span>`:''}</div></div>
 <div class="rgrid"><section class="plate"><h2>Ingrédients</h2><div class="serv"><button type="button" data-sv="-1" aria-label="Moins">−</button><b>${esc(unit(r,st.p))}</b><button type="button" data-sv="1" aria-label="Plus">+</button></div>
 <button type="button" class="ghost rcadd" data-tocs="${esc(r.id)}">🛒 Ajouter à la liste de courses</button><ul class="ing" style="margin-top:12px">${r.ingredients.map((g,i)=>`<li><label><input type="checkbox" data-ing="${i}" ${st.ing.has(i)?'checked':''}><span>${g.q?`<span class="q">${esc(fmtQ(g.q*k,g.u))}</span> `:''}${esc(g.n)}</span></label></li>`).join('')}</ul></section>
 <section class="plate"><h2>Étapes</h2><ol class="steps">${r.etapes.map((e,i)=>`<li data-st="${i}" class="${st.ok.has(i)?'ok':''}"><div><b>${esc(e.t)}</b><p>${esc(e.d)}</p>${e.min?`<button type="button" class="timer" data-tm="${e.min}">⏱ Minuteur ${e.min} min</button>`:''}</div></li>`).join('')}</ol>
 ${r.astuces?.length?`<h2 style="margin-top:18px">Astuces</h2><ul class="tips">${r.astuces.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`:''}</section></div>`}
$('#rc-one').addEventListener('click',e=>{const id=location.hash.slice(9),st=RS[id];if(!st)return;
 const sv=e.target.closest('[data-sv]');if(sv){st.p=Math.max(1,Math.min(20,st.p+ +sv.dataset.sv));renderOne(id);return}
 const tm=e.target.closest('[data-tm]');if(tm){e.stopPropagation();startTimer(tm);return}
 const li=e.target.closest('[data-st]');if(li){const i=+li.dataset.st;st.ok.has(i)?st.ok.delete(i):st.ok.add(i);li.classList.toggle('ok')}});
$('#rc-one').addEventListener('change',e=>{const c=e.target.closest('[data-ing]'),st=RS[location.hash.slice(9)];if(!c||!st)return;const i=+c.dataset.ing;c.checked?st.ing.add(i):st.ing.delete(i)});
function startTimer(b){if(b._iv){clearInterval(b._iv);b._iv=null;b.className='timer';b.textContent='⏱ Minuteur '+b.dataset.tm+' min';return}
 const end=Date.now()+b.dataset.tm*60000;b.className='timer run';
 const t=()=>{const s=Math.max(0,Math.round((end-Date.now())/1000));b.textContent='⏱ '+Math.floor(s/60)+':'+pad(s%60)+' · arrêter';
  if(!s){clearInterval(b._iv);b._iv=null;b.className='timer done';b.textContent='✓ Terminé !';try{const a=new AudioContext(),o=a.createOscillator();o.connect(a.destination);o.frequency.value=880;o.start();o.stop(a.currentTime+.6)}catch(e){}if(navigator.vibrate)navigator.vibrate([300,150,300])}};
 t();b._iv=setInterval(t,1000)}
loadRC();


/* ---------- liste de courses ---------- */
const CAT=[
 ['fl','Fruits et légumes',['Pommes de terre','Oignons','Ail','Échalotes','Carottes','Tomates','Salade','Courgettes','Poireaux','Champignons','Concombre','Poivrons','Persil','Pommes','Bananes','Citrons','Oranges','Clémentines','Raisin']],
 ['bo','Boulangerie',['Baguette','Pain de campagne','Pain de mie','Biscottes','Croissants','Brioche']],
 ['cr','Crèmerie et œufs',['Lait','Beurre','Œufs','Crème fraîche','Yaourts','Fromage blanc','Fromage râpé','Emmental','Comté','Camembert','Mozzarella','Desserts lactés']],
 ['vi','Viandes et poissons',['Steak haché','Poulet','Jambon','Lardons','Saucisses','Côtes de porc','Rôti','Charcuterie','Filets de poisson','Crevettes','Thon en boîte','Sardines']],
 ['es','Épicerie salée',['Pâtes','Riz','Semoule','Lentilles','Farine','Huile d\'olive','Huile de tournesol','Vinaigre','Moutarde','Mayonnaise','Ketchup','Sel','Poivre','Épices','Bouillon cube','Sauce tomate','Concentré de tomate','Conserves de légumes','Chips','Apéritif']],
 ['su','Épicerie sucrée et petit-déjeuner',['Sucre','Café','Thé','Chocolat en poudre','Céréales','Confiture','Pâte à tartiner','Miel','Biscuits','Chocolat','Compotes','Levure']],
 ['bs','Boissons',['Eau plate','Eau gazeuse','Jus de fruits','Sodas','Sirop','Bière','Vin rouge','Vin blanc']],
 ['sg','Surgelés',['Légumes surgelés','Frites','Pizza','Poisson pané','Steaks surgelés','Glaces']],
 ['hy','Hygiène',['Papier toilette','Gel douche','Shampoing','Dentifrice','Brosses à dents','Déodorant','Rasoirs','Mousse à raser','Mouchoirs','Coton','Crème mains']],
 ['en','Entretien',['Liquide vaisselle','Pastilles lave-vaisselle','Lessive','Adoucissant','Éponges','Sacs poubelle','Essuie-tout','Nettoyant multi-usage','Javel','Papier aluminium','Film alimentaire','Sacs congélation']],
 ['ga','Bricolage et garage',['Piles','Ampoules','Gants nitrile','Dégraissant','Dégrippant','Chiffons','Lave-glace','Huile moteur','Scotch','Colliers de serrage']],
 ['an','Animaux',['Croquettes','Pâtée','Litière','Friandises']],
 ['ps','Ajouts perso',[]]];
const slug=t=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
let CS={sel:{},got:[],perso:[]};
const CSKEY='courses-v1';
try{const j=JSON.parse(localStorage.getItem(CSKEY)||'null');if(j)CS={...CS,...j}}catch(e){}
const csItems=()=>{const L=[];for(const [k,n,a] of CAT)for(const x of a)L.push({id:k+'-'+slug(x),n:x,cat:k});for(const p of CS.perso||[])L.push(p);return L};
const catName=k=>(CAT.find(c=>c[0]===k)||CAT[CAT.length-1])[1];
$('#cs-cat').innerHTML=CAT.map(([k,n])=>`<option value="${k}"${k==='ps'?' selected':''}>${esc(n)}</option>`).join('');
let csT;
function csSave(){try{localStorage.setItem(CSKEY,JSON.stringify(CS))}catch(e){}
 if(S.canW&&FB_OK){clearTimeout(csT);csT=setTimeout(()=>setDoc(doc(db,'masques','courses'),{sel:CS.sel,got:CS.got,perso:CS.perso,t:Date.now()}).catch(()=>{}),700)}}
let CSR=null;
function csApply(){if(!CSR||!S.canW)return;CS={sel:CSR.sel||{},got:CSR.got||[],perso:CSR.perso||[]};try{localStorage.setItem(CSKEY,JSON.stringify(CS))}catch(e){}renderCS()}
if(FB_OK)onSnapshot(doc(db,'masques','courses'),sn=>{if(!sn.exists())return;CSR=sn.data();csApply()},()=>{});
function renderCS(){
 const q=slug($('#cs-find').value||''),all=csItems(),n=Object.keys(CS.sel).length;
 $('#cs-cats').innerHTML=CAT.map(([k,name])=>{const it=all.filter(x=>x.cat===k&&(!q||slug(x.n).includes(q)));if(!it.length)return '';
  const c=it.filter(x=>CS.sel[x.id]).length;
  return `<div class="cat"><h3>${esc(name)}${c?`<small>${c} coché${c>1?'s':''}</small>`:''}</h3><ul class="items">${it.map(x=>`<li class="it"><label><input type="checkbox" data-cs="${esc(x.id)}" ${CS.sel[x.id]?'checked':''}><span class="bx">✓</span><span>${esc(x.n)}</span></label></li>`).join('')}</ul></div>`}).join('')||'<div class="empty">Aucun article ne correspond. Ajoute-le avec le champ ci-dessus.</div>';
 const chosen=all.filter(x=>CS.sel[x.id]);
 $('#cs-count').textContent=n;$('#cs-fabn').textContent=n;$('#u-cs').textContent=n?n+' article'+(n>1?'s':'')+' à acheter':'Rien à acheter';
 $('#cs-fab').hidden=!(n&&innerWidth<900&&location.hash==='#courses');
 $('#cs-sum').innerHTML=chosen.length?CAT.map(([k,name])=>{const g=chosen.filter(x=>x.cat===k);if(!g.length)return '';
  return `<div class="rg"><h4>${esc(name)}</h4><ul class="rl">${g.map(x=>`<li class="${CS.got.includes(x.id)?'got':''}"><button type="button" class="ck" data-got="${esc(x.id)}" aria-label="Dans le caddie">${CS.got.includes(x.id)?'✓':''}</button><span>${esc(x.n)}</span><span class="qty"><button type="button" data-qt="-1" data-id="${esc(x.id)}" aria-label="Moins">−</button><b>${CS.sel[x.id]}</b><button type="button" data-qt="1" data-id="${esc(x.id)}" aria-label="Plus">+</button></span></li>`).join('')}</ul></div>`}).join(''):'<div class="empty">Coche les articles dont tu as besoin : ils apparaissent ici, rangés par rayon.</div>';
}
function csText(){const all=csItems().filter(x=>CS.sel[x.id]);return 'Liste de courses\n'+CAT.map(([k,name])=>{const g=all.filter(x=>x.cat===k);return g.length?'\n'+name+'\n'+g.map(x=>'- '+x.n+(CS.sel[x.id]>1?' ×'+CS.sel[x.id]:'')).join('\n'):''}).join('\n')}
$('#cs-cats').addEventListener('change',e=>{const c=e.target.closest('[data-cs]');if(!c)return;const id=c.dataset.cs;
 if(c.checked)CS.sel[id]=CS.sel[id]||1;else{delete CS.sel[id];CS.got=CS.got.filter(x=>x!==id)}csSave();renderCS()});
$('#cs-sum').addEventListener('click',e=>{const g=e.target.closest('[data-got]'),qb=e.target.closest('[data-qt]');
 if(g){const id=g.dataset.got;CS.got=CS.got.includes(id)?CS.got.filter(x=>x!==id):[...CS.got,id]}
 else if(qb){const id=qb.dataset.id,v=(CS.sel[id]||1)+ +qb.dataset.qt;if(v<1){delete CS.sel[id];CS.got=CS.got.filter(x=>x!==id)}else CS.sel[id]=Math.min(99,v)}else return;
 csSave();renderCS()});
$('#cs-find').addEventListener('input',renderCS);
$('#cs-addb').addEventListener('click',()=>{const n=$('#cs-new').value.trim();if(!n)return;const cat=$('#cs-cat').value;const id='p-'+slug(n);
 if(!csItems().some(x=>x.id===id||slug(x.n)===slug(n)))CS.perso=[...(CS.perso||[]),{id,n,cat}];
 const ex=csItems().find(x=>x.id===id||slug(x.n)===slug(n));CS.sel[ex.id]=CS.sel[ex.id]||1;$('#cs-new').value='';csSave();renderCS()});
$('#cs-new').addEventListener('keydown',e=>{if(e.key==='Enter')$('#cs-addb').click()});
$('#cs-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(csText());$('#cs-msg').textContent='Liste copiée : colle-la dans un SMS ou une note.'}catch(e){$('#cs-msg').textContent='Copie impossible sur cet appareil.'}});
$('#cs-share').addEventListener('click',async()=>{const t=csText();if(navigator.share){try{await navigator.share({title:'Liste de courses',text:t})}catch(e){}}else{try{await navigator.clipboard.writeText(t);$('#cs-msg').textContent='Partage indisponible ici : liste copiée à la place.'}catch(e){}}});
$('#cs-clear').addEventListener('click',()=>{const old=JSON.parse(JSON.stringify(CS));CS.sel={};CS.got=[];csSave();renderCS();undo('Liste vidée',()=>{CS=old;csSave();renderCS()})});
addEventListener('resize',()=>{$('#cs-fab').hidden=!(Object.keys(CS.sel).length&&innerWidth<900&&location.hash==='#courses')});
$('#cs-fab').addEventListener('click',e=>{e.preventDefault();$('#cs-recap').scrollIntoView({behavior:'smooth'})});
let csSeen=false;
const csIO=new IntersectionObserver(es=>{csSeen=es[0].isIntersecting;$('#cs-fab').style.display=csSeen?'none':''});csIO.observe($('#cs-recap'));
renderCS();
/* recette → liste de courses */
document.addEventListener('click',e=>{const b=e.target.closest('[data-tocs]');if(!b)return;const r=RC.find(x=>x.id===b.dataset.tocs);if(!r)return;
 let n=0;for(const g of r.ingredients){if(!g.q)continue;const name=g.n.replace(/\s*\(.*?\)\s*/g,' ').replace(/,.*$/,'').trim();const nm=name.charAt(0).toUpperCase()+name.slice(1);
  let ex=csItems().find(x=>slug(x.n)===slug(nm)||slug(nm).startsWith(slug(x.n)+'-')||slug(nm)===slug(x.n)+'s');
  if(!ex){ex={id:'p-'+slug(nm),n:nm,cat:'ps'};CS.perso=[...(CS.perso||[]),ex]}CS.sel[ex.id]=CS.sel[ex.id]||1;n++}
 csSave();renderCS();b.textContent='✓ '+n+' ingrédients ajoutés à la liste de courses'});


/* ---------- organiser par appui long (disposition propre à chaque appareil) ---------- */
const keyOf=el=>el.dataset.k||el.dataset.v||el.getAttribute('href')||'';
const ORDK='ordre-v1';
let ORD={};try{ORD=JSON.parse(localStorage.getItem(ORDK)||'{}')||{}}catch(e){}
const DEF={};
document.querySelectorAll('[data-sort]').forEach(c=>{DEF[c.dataset.sort]=[...c.children].map(keyOf);applyOrd(c)});
function applyOrd(c){const o=ORD[c.dataset.sort];if(!Array.isArray(o))return;const m=new Map([...c.children].map(e=>[keyOf(e),e]));for(const k of o){const e=m.get(k);if(e)c.appendChild(e)}for(const e of m.values())if(!o.includes(keyOf(e)))c.appendChild(e)}
function saveOrd(c){ORD[c.dataset.sort]=[...c.children].map(keyOf);try{localStorage.setItem(ORDK,JSON.stringify(ORD))}catch(e){}}
let editing=false,press=null,drag=null;
function setEdit(on){editing=on;document.body.classList.toggle('editing',on);if(navigator.vibrate&&on)navigator.vibrate(15)}
$('#ed-done').addEventListener('click',()=>setEdit(false));
$('#ed-reset').addEventListener('click',()=>{ORD={};try{localStorage.removeItem(ORDK)}catch(e){}document.querySelectorAll('[data-sort]').forEach(c=>{const m=new Map([...c.children].map(e=>[keyOf(e),e]));for(const k of DEF[c.dataset.sort])m.get(k)&&c.appendChild(m.get(k))})});
function itemAt(x,y,c){const el=document.elementFromPoint(x,y);const it=el&&el.closest('[data-sort]>*');return it&&it.parentElement===c?it:null}
function startDrag(el,e){const r=el.getBoundingClientRect();drag={el,c:el.parentElement,ox:e.clientX-r.left,oy:e.clientY-r.top,id:e.pointerId};el.classList.add('drag');el.style.pointerEvents='none';try{el.setPointerCapture(e.pointerId)}catch(_){}follow(e.clientX,e.clientY)}
function follow(x,y){const el=drag.el;el.style.transform='';const r=el.getBoundingClientRect();el.style.transform=`translate(${x-drag.ox-r.left}px,${y-drag.oy-r.top}px)`}
function flip(c,fn){const kids=[...c.children].filter(k=>k!==drag.el),before=new Map(kids.map(k=>[k,k.getBoundingClientRect()]));fn();
 for(const k of kids){const a=before.get(k),b=k.getBoundingClientRect(),dx=a.left-b.left,dy=a.top-b.top;if(!dx&&!dy)continue;
  k.style.transition='none';k.style.transform=`translate(${dx}px,${dy}px)`;requestAnimationFrame(()=>{k.style.transition='transform .25s cubic-bezier(.2,.8,.2,1)';k.style.transform=''})}}
document.addEventListener('pointerdown',e=>{const it=e.target.closest('[data-sort]>*');if(!it||e.button>0)return;
 if(editing){if(e.target.closest('.editbar'))return;e.preventDefault();startDrag(it,e);return}
 press={it,x:e.clientX,y:e.clientY,t:setTimeout(()=>{setEdit(true);startDrag(it,{clientX:press.x,clientY:press.y,pointerId:e.pointerId});press=null},480)}},{passive:false});
document.addEventListener('pointermove',e=>{
 if(press&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>10){clearTimeout(press.t);press=null}
 if(!drag)return;e.preventDefault();follow(e.clientX,e.clientY);
 const t=itemAt(e.clientX,e.clientY,drag.c);if(!t||t===drag.el)return;
 const kids=[...drag.c.children],a=kids.indexOf(drag.el),b=kids.indexOf(t);
 flip(drag.c,()=>{a<b?t.after(drag.el):t.before(drag.el)});follow(e.clientX,e.clientY)},{passive:false});
function endDrag(){if(press){clearTimeout(press.t);press=null}if(!drag)return;const {el,c}=drag;el.classList.remove('drag');el.style.pointerEvents='';
 el.style.transition='transform .22s cubic-bezier(.2,.8,.2,1)';el.style.transform='';setTimeout(()=>{el.style.transition=''},250);saveOrd(c);drag=null;justDragged=Date.now()}
let justDragged=0;
document.addEventListener('pointerup',endDrag);document.addEventListener('pointercancel',endDrag);
document.addEventListener('click',e=>{if((editing||Date.now()-justDragged<400)&&e.target.closest('[data-sort]')){e.preventDefault();e.stopPropagation()}},true);
document.addEventListener('contextmenu',e=>{if(e.target.closest('[data-sort]'))e.preventDefault()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&editing)setEdit(false)});

/* ---------- divers ---------- */
let tt;function undo(msg,fn){$('#toast-t').textContent=msg;$('#toast').classList.add('on');clearTimeout(tt);$('#toast-b').onclick=()=>{fn();$('#toast').classList.remove('on')};tt=setTimeout(()=>$('#toast').classList.remove('on'),6000)}
function rerender(){renderNotes();renderAnn();renderPhotos();renderCal()}
function lockUI(){for(const s of ['#n-compose','#a-compose','#p-up','#r-compose'])$(s).hidden=!S.canW}
function route(){const v=location.hash.slice(1)||'home';let ok=['home','meteo','agenda','notes','photos','annonces','utile','recettes','courses'].includes(v)?v:'home';
 if(/^recette-[a-z0-9-]+$/.test(v)){ok='recette';renderOne(v.slice(8))}
 const tab={recettes:'utile',recette:'utile',courses:'utile'}[ok]||ok;if(ok==='courses')renderCS();
 document.querySelectorAll('.view').forEach(x=>x.classList.toggle('on',x.id==='v-'+ok));
 document.querySelectorAll('.dock a').forEach(a=>a.classList.toggle('on',a.dataset.v===tab));window.scrollTo(0,0)}
addEventListener('hashchange',route);route();

let lock=null;
async function wake(){try{lock=await navigator.wakeLock.request('screen');$('#wake').classList.add('on');lock.addEventListener('release',()=>{lock=null;$('#wake').classList.remove('on')})}catch(e){$('#wake').textContent='Réglages › Affichage › Mise en veille';setTimeout(()=>$('#wake').textContent='Écran toujours allumé',6000)}}
$('#wake').addEventListener('click',async()=>{if(lock){try{await lock.release()}catch(e){}lock=null;$('#wake').classList.remove('on');try{localStorage.removeItem('wake')}catch(e){}return}await wake();try{localStorage.setItem('wake','1')}catch(e){}});
document.addEventListener('visibilitychange',()=>{let w=null;try{w=localStorage.getItem('wake')}catch(e){}if(!document.hidden&&w&&!lock)wake()});
$('#fs').addEventListener('click',async()=>{try{document.fullscreenElement?await document.exitFullscreen():await document.documentElement.requestFullscreen()}catch(e){$('#fs').textContent='Plein écran indisponible'}});

lockUI();rerender();renderWx();
