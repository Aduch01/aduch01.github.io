/* Le Tableau — version hébergée (GitHub Pages + Firebase)
   Tout le monde lit sans compte. Seul le propriétaire (OWNER_UID) publie. */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getFirestore,collection,doc,setDoc,deleteDoc,onSnapshot} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {firebaseConfig,OWNER_UID,PLACE} from './config.js?v=5';

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
 lockUI();rerender()});

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

function ico(c){c=(c||'').toLowerCase();
 const sun='<circle cx="32" cy="30" r="11" fill="#ffc53d"/><g stroke="#ffc53d" stroke-width="3" stroke-linecap="round">'+[0,45,90,135,180,225,270,315].map(a=>{const r=a*Math.PI/180;return `<line x1="${32+17*Math.cos(r)}" y1="${30+17*Math.sin(r)}" x2="${32+22*Math.cos(r)}" y2="${30+22*Math.sin(r)}"/>`}).join('')+'</g>';
 const cloud=(x,y,f)=>`<path d="M${x} ${y}h26a9 9 0 0 0 0-18 13 13 0 0 0-25-2 10 10 0 0 0-1 20z" transform="translate(-4 0)" fill="${f}"/>`;
 let s='';
 if(/neige|grain/.test(c))s=cloud(14,38,'#c9d3da')+'<g fill="#9fd8ff">'+[20,32,44].map(x=>`<circle cx="${x}" cy="50" r="3"/>`).join('')+'</g>';
 else if(/orage/.test(c))s=cloud(14,36,'#6f7d89')+'<path d="M30 40l-6 10h6l-3 9 10-13h-6l3-6z" fill="#ffc53d"/>';
 else if(/pluie|averse|bruine/.test(c))s=cloud(14,36,'#8a99a6')+'<g stroke="#4fb3f0" stroke-width="3" stroke-linecap="round">'+[20,30,40].map(x=>`<line x1="${x}" y1="44" x2="${x-4}" y2="54"/>`).join('')+'</g>';
 else if(/brume|brouillard/.test(c))s=cloud(14,32,'#b5c0c8')+'<g stroke="#9aa6af" stroke-width="3" stroke-linecap="round"><line x1="12" y1="42" x2="50" y2="42"/><line x1="18" y1="50" x2="54" y2="50"/></g>';
 else if(/clair|soleil/.test(c))s=sun;
 else if(/éclairc|partiel/.test(c))s='<g transform="translate(-8 -8)">'+sun+'</g>'+cloud(20,46,'#c3ccd3');
 else s=cloud(10,36,'#aab5be')+cloud(22,46,'#8796a2');
 return `<svg viewBox="0 0 64 64" aria-hidden="true">${s}</svg>`}
const jour=d=>new Date(d+'T12:00').toLocaleDateString('fr-FR',{weekday:'short'}).replace('.','');
const jourL=d=>new Date(d+'T12:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
const fmtMaj=s=>{const d=new Date(s);return isNaN(d)?'—':d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})};

function renderWx(){
 const w=D.wx,H=$('#h-wx');
 if(!w||!w.jours?.length){H.innerHTML='<div class="empty">Météo indisponible pour le moment.</div>';$('#m-day').innerHTML=H.innerHTML;$('#m-week').innerHTML='';return}
 const J=w.jours,t=J[0];
 const days=J.map((d,i)=>`<button type="button" class="day${i===S.day?' sel':''}" data-day="${i}"><small>${i?esc(jour(d.date)):'Auj.'}</small>${ico(d.cond)}<b>${esc(d.max)}°</b><small>${esc(d.min)}°</small></button>`).join('');
 H.innerHTML=`<div class="wx-now">${ico(w.condNow||t.cond)}<div><div class="big">${esc(w.actuelle)}°</div><div class="cond">${esc(w.condNow||t.cond)} · ${esc(w.ville)}</div><div class="wx-more">Ressenti ${esc(w.ressenti)}° · humidité ${esc(w.hum)} %</div></div></div><div class="days">${days}</div><div class="maj">Mise à jour automatique · ${esc(fmtMaj(w.maj))}</div>`;
 const d=J[S.day]||t;
 $('#m-title').textContent='Météo à '+w.ville;
 $('#m-day').innerHTML=`<h2>${esc(jourL(d.date))}</h2><div class="wx-now">${ico(d.cond)}<div><div class="big">${esc(d.max)}° <span style="font-size:.5em;color:var(--mut)">/ ${esc(d.min)}°</span></div><div class="cond">${esc(d.cond)}</div></div></div><div class="wx-detail"><div class="stat"><span>Risque de pluie</span><b>${esc(d.pluie)} %</b></div><div class="stat"><span>Cumul</span><b>${esc(d.mm)} mm</b></div><div class="stat"><span>Vent max</span><b>${esc(d.vent)} km/h ${esc(d.dir)}</b></div><div class="stat"><span>Soleil</span><b>${esc(d.lever)} – ${esc(d.coucher)}</b></div></div><div class="days">${days}</div>`;
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
 $('#n-list').innerHTML=L.length?L.map((n,i)=>`<article class="note${n.done?' done':''}" style="background:${nc(n.c)};--r:${[-1.2,.8,-.4,1.1,0][i%5]}deg"><small>${n.pin?'Épinglée · ':''}${esc(new Date(n.t).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}))}</small><p>${esc(n.text)}</p>${S.canW?`<div class="row"><button type="button" data-n="done" data-id="${esc(n.id)}" aria-label="Fait">${n.done?'↺':'✓'}</button><button type="button" data-n="pin" data-id="${esc(n.id)}">${n.pin?'Désépingler':'Épingler'}</button><button type="button" data-n="edit" data-id="${esc(n.id)}">Modifier</button><button type="button" data-n="del" data-id="${esc(n.id)}" aria-label="Supprimer">✕</button></div>`:''}</article>`).join(''):'<div class="empty plate">Aucune note pour l\'instant.</div>';
 $('#h-notes').innerHTML=L.filter(n=>!n.done).slice(0,5).map(n=>`<li class="mline"><span class="dot" style="background:${nc(n.c)}"></span><span>${esc(n.text.length>90?n.text.slice(0,90)+'…':n.text)}</span></li>`).join('')||'<li class="empty">Rien à signaler.</li>';
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
 const L=[...all('ann')].sort((x,y)=>(x.done|0)-(y.done|0)||y.t-x.t),F=L.filter(a=>S.filt==='all'||a.k===S.filt);
 $('#a-list').innerHTML=F.length?F.map(a=>`<li class="item${a.done?' done':''}">${a.k==='tache'?`<button type="button" class="check${a.done?' on':''}" data-a="done" data-id="${esc(a.id)}" ${S.canW?'':'disabled'} aria-label="Fait">${a.done?'✓':''}</button>`:'<span class="tag n">Nouvelle</span>'}<div><h3>${esc(a.title)}</h3>${a.body?`<p>${esc(a.body)}</p>`:''}<div class="hint">${esc(new Date(a.t).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}${a.k==='tache'?' · tâche':''}</div></div>${S.canW?`<button type="button" class="ghost" data-a="del" data-id="${esc(a.id)}" aria-label="Supprimer">✕</button>`:'<span></span>'}</li>`).join(''):'<li class="empty plate">Rien de publié ici.</li>';
 $('#h-ann').innerHTML=L.filter(a=>!a.done).slice(0,4).map(a=>`<li class="mline"><span class="tag ${a.k==='tache'?'t':'n'}">${a.k==='tache'?'Tâche':'Nouvelle'}</span><span>${esc(a.title)}</span></li>`).join('')||'<li class="empty">Aucune tâche en cours.</li>';
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
async function shrink(file){
 const bmp=await createImageBitmap(file,{imageOrientation:'from-image'});
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

/* ---------- divers ---------- */
let tt;function undo(msg,fn){$('#toast-t').textContent=msg;$('#toast').classList.add('on');clearTimeout(tt);$('#toast-b').onclick=()=>{fn();$('#toast').classList.remove('on')};tt=setTimeout(()=>$('#toast').classList.remove('on'),6000)}
function rerender(){renderNotes();renderAnn();renderPhotos()}
function lockUI(){for(const s of ['#n-compose','#a-compose','#p-up'])$(s).hidden=!S.canW}
function route(){const v=location.hash.slice(1)||'home',ok=['home','meteo','notes','photos','annonces'].includes(v)?v:'home';
 document.querySelectorAll('.view').forEach(x=>x.classList.toggle('on',x.id==='v-'+ok));
 document.querySelectorAll('.dock a').forEach(a=>a.classList.toggle('on',a.dataset.v===ok));window.scrollTo(0,0)}
addEventListener('hashchange',route);route();

let lock=null;
async function wake(){try{lock=await navigator.wakeLock.request('screen');$('#wake').classList.add('on');lock.addEventListener('release',()=>{lock=null;$('#wake').classList.remove('on')})}catch(e){$('#wake').textContent='Réglages › Affichage › Mise en veille';setTimeout(()=>$('#wake').textContent='Écran toujours allumé',6000)}}
$('#wake').addEventListener('click',async()=>{if(lock){try{await lock.release()}catch(e){}lock=null;$('#wake').classList.remove('on');try{localStorage.removeItem('wake')}catch(e){}return}await wake();try{localStorage.setItem('wake','1')}catch(e){}});
document.addEventListener('visibilitychange',()=>{let w=null;try{w=localStorage.getItem('wake')}catch(e){}if(!document.hidden&&w&&!lock)wake()});
$('#fs').addEventListener('click',async()=>{try{document.fullscreenElement?await document.exitFullscreen():await document.documentElement.requestFullscreen()}catch(e){$('#fs').textContent='Plein écran indisponible'}});

lockUI();rerender();renderWx();
