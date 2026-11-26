/* Le Tableau — version hébergée (GitHub Pages + Firebase)
   Tout le monde lit sans compte. Seul le propriétaire (OWNER_UID) publie. */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getFirestore,collection,doc,setDoc,deleteDoc,onSnapshot} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {firebaseConfig,OWNER_UID,PLACE} from './config.js?v=46';

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
let flT;function toastTop(t,ok){const b=$('#fxinfo');if(!b)return;b.textContent=t;b.classList.toggle('ok',!!ok);b.classList.remove('fade');clearTimeout(flT);flT=setTimeout(()=>b.classList.add('fade'),2600)}
function status(t){const el=$('#status');if(el)el.textContent=t||(S.canW?'Connecté : toi seul peux publier':'Lecture seule (touche Connexion si tu es le propriétaire)');
 if(t&&/Publié|Supprimé|Échec|interrompue|injoignables|Publication/.test(t))toastTop(t,/Publié|Supprimé/.test(t))}
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
 status('');
 lockUI();rerender();if(typeof csApply==='function')csApply();if(typeof renderKB==='function')renderKB()});

/* ---------- horloge ---------- */
const fD=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
let clk='';
const fDay=new Intl.DateTimeFormat('fr-FR',{weekday:'long'}),fDm=new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'});
function tick(){const d=new Date(),t=d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),C=$('#clock');$('#date').textContent=fDm.format(d);const dd=$('#dl-day');if(dd)dd.textContent=fDay.format(d);
 if(t===clk)return;const first=!clk||C.children.length!==t.length;
 if(first){C.innerHTML=[...t].map(ch=>ch===':'?'<span class="col">:</span>':`<span class="sl"><span>${ch}</span></span>`).join('')}
 else{[...t].forEach((ch,i)=>{if(ch!==clk[i]&&ch!==':'){const sl=C.children[i],sp=sl.firstChild;sp.textContent=ch;
  if(window.Motion){try{Motion.animate(sp,{y:['-100%','0%'],opacity:[0,1],filter:['blur(6px)','blur(0px)']},{type:'spring',stiffness:260,damping:22})}catch(e){}}}})}
 clk=t;greet(d)}
function greet(d){const h=d.getHours(),g=h<5?'Bonne nuit':h<12?'Bonjour':h<18?'Bon après-midi':h<23?'Bonsoir':'Bonne nuit';
 const w=D.wx?.jours?.[0];$('#greet').innerHTML=esc(g)+(w&&D.wx.actuelle!=null?` · <b>${esc(D.wx.actuelle)}°</b> ${esc((D.wx.condNow||w.cond||'').toLowerCase())} à ${esc(D.wx.ville)}`:'');
 setSky(h)}
const SKY={aube:['#ff7a59','#ffb86b','#c04dff','#4f7bff','#3a1440'],jour:['#3b82f6','#0ea5e9','#8b5cf6','#14e0c8','#0f2a5c'],soir:['#7c3aed','#f97316','#ec4899','#6366f1','#2a0f3d'],nuit:['#4c1d95','#1e3a8a','#831843','#0e7490','#14082e']};
let skyCur='';function setSky(h){const k=h>=5&&h<8?'aube':h>=8&&h<17?'jour':h>=17&&h<21?'soir':'nuit';if(k===skyCur)return;skyCur=k;const v=SKY[k],r=document.documentElement.style;
 ['--a1','--a2','--a3','--a4','--abase'].forEach((p,i)=>r.setProperty(p,v[i]))}
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
 const nt=isNight(t);renderWxHome();
 if(typeof fxTemp==='function')fxTemp();greet(new Date());if(typeof wxFxSet==='function')wxFxSet($('#wxcard').dataset.sky);
 const d=J[S.day]||t;
 $('#m-title').textContent='Météo à '+w.ville;
 $('#m-day').dataset.sky=sky(d.cond,S.day===0&&nt);
 $('#m-day').innerHTML=`<h2>${esc(jourL(d.date))}</h2><div class="wx-now">${ico(d.cond,S.day===0&&nt)}<div><div class="big">${esc(d.max)}° <span style="font-size:.5em;color:var(--mut)">/ ${esc(d.min)}°</span></div><div class="cond">${esc(d.cond)}</div></div></div><div class="wx-detail"><div class="stat"><span>Risque de pluie</span><b>${esc(d.pluie)} %</b></div><div class="stat"><span>Cumul</span><b>${esc(d.mm)} mm</b></div><div class="stat"><span>Vent max</span><b>${esc(d.vent)} km/h ${esc(d.dir)}</b></div><div class="stat"><span>Soleil</span><b>${esc(d.lever)} – ${esc(d.coucher)}</b></div></div><div class="days">${days}</div>`;
 const lo=Math.min(...J.map(x=>x.min)),hi=Math.max(...J.map(x=>x.max)),sp=(hi-lo)||1;
 $('#m-week').innerHTML=J.map((x,i)=>`<button type="button" class="range" data-day="${i}" style="width:100%;text-align:left;border-radius:0"><span>${i?esc(jour(x.date)):'Auj.'} <b>${esc(x.min)}°</b></span><span><span class="track"><i style="left:${(x.min-lo)/sp*100}%;right:${100-(x.max-lo)/sp*100}%"></i></span><span class="rain" style="display:block;width:${Math.max(2,+x.pluie||0)}%"></span></span><span style="text-align:right"><b>${esc(x.max)}°</b> · ${esc(x.pluie)}%</span></button>`).join('');
 $('#m-maj').textContent='Barre colorée : écart min–max · trait bleu : risque de pluie. Source Open-Meteo, mise à jour toutes les 30 min (dernière à '+fmtMaj(w.maj)+').';
}

/* ---------- widget météo de l'accueil : grand rapport du jour + navigation dans la semaine ---------- */
S.hday=0;
function scene(c,night){c=(c||'').toLowerCase();
 const sunG=(x,y,r)=>`<g class="sc-sun" transform="translate(${x} ${y})"><circle r="${r*2}" fill="url(#w-glow)" class="sc-glow"/><g class="sc-rays"><circle r="${r*1.8}" fill="none"/>${Array.from({length:12},(_,i)=>`<rect x="-1.6" y="${-r*1.75}" width="3.2" height="${r*.5}" rx="1.6" fill="#ffd23f" transform="rotate(${i*30})" style="transform-origin:0 0;transform-box:view-box"/>`).join('')}</g><circle r="${r}" fill="url(#w-sun)" filter="url(#w-sh)"/></g>`;
 const moonG=(x,y)=>`<g class="sc-moon" transform="translate(${x} ${y})"><circle r="26" fill="url(#w-glow)" opacity=".35" class="sc-glow"/><path d="M6 -16a17 17 0 1 0 11 27 14 14 0 0 1-11-27z" fill="url(#w-cloud)" filter="url(#w-sh)"/></g>`+[[20,18],[96,14],[104,40],[30,52],[88,64]].map(([x,y],i)=>`<circle class="sc-star" style="--d:${i*.5}s" cx="${x}" cy="${y}" r="1.4" fill="#fff"/>`).join('');
 const cloud=(x,y,k,f,cls)=>`<g class="${cls}"><path transform="translate(${x} ${y}) scale(${k})" d="M14 40h40a13 13 0 0 0 1.6-25.9A19 19 0 0 0 19.6 17 14 14 0 0 0 14 40z" fill="url(#${f})" filter="url(#w-sh)"/></g>`;
 const drops=n=>Array.from({length:n},(_,i)=>`<path class="sc-drop" style="--d:${(i*.13).toFixed(2)}s" d="M${34+i*8} 70c-2.2 3.6-3.2 5.4-3.2 6.8a3.2 3.2 0 0 0 6.4 0c0-1.4-1-3.2-3.2-6.8z" fill="url(#w-drop)"/>`).join('');
 const flakes=Array.from({length:7},(_,i)=>`<circle class="sc-flake" style="--d:${(i*.45).toFixed(2)}s" cx="${32+i*9}" cy="70" r="${2.4+(i%3)*.6}" fill="#fff"/>`).join('');
 let s;
 if(/neige|grain/.test(c))s=cloud(18,4,1.1,'w-cloud','sc-cloud')+flakes;
 else if(/orage/.test(c))s=cloud(14,0,1.15,'w-cloud2','sc-cloud')+drops(5)+'<path class="sc-bolt" d="M62 58l-9 15h8l-4 13 14-18h-8l4-10z" fill="url(#w-bolt)" filter="url(#w-sh)"/>';
 else if(/pluie|averse|bruine/.test(c))s=cloud(30,-6,.75,'w-cloud2','sc-cloud2')+cloud(14,2,1.1,/forte|violent/.test(c)?'w-cloud2':'w-cloud','sc-cloud')+drops(/bruine|faible/.test(c)?5:7);
 else if(/brume|brouillard/.test(c))s=cloud(16,0,1.05,'w-cloud2','sc-cloud')+[62,72,82].map((y,i)=>`<rect class="sc-fog" style="--d:${i*.6}s" x="${18+i*6}" y="${y}" width="${70-i*8}" height="4.5" rx="2.2" fill="#e2e8f2" opacity=".8"/>`).join('');
 else if(/clair|soleil/.test(c))s=night?moonG(60,46):sunG(60,48,22);
 else if(/éclairc|partiel/.test(c))s=(night?moonG(44,32):sunG(42,34,16))+cloud(26,22,1,'w-cloud','sc-cloud');
 else s=cloud(34,-2,.85,'w-cloud2','sc-cloud2')+cloud(10,12,1.15,'w-cloud','sc-cloud');
 return `<svg class="scene" viewBox="0 0 120 100" aria-hidden="true">${s}</svg>`}
function renderWxHome(){const w=D.wx,H=$('#h-wx');if(!w?.jours?.length)return;const J=w.jours,i=Math.min(S.hday,J.length-1),d=J[i],today=i===0,nt=today&&isNight(J[0]);
 const cond=today?(w.condNow||d.cond):d.cond,sk=sky(cond,nt);$('#wxcard').dataset.sky=sk;
 const label=today?'Aujourd\'hui':i===1?'Demain':jourL(d.date);
 const stats=today?[['Ressenti',w.ressenti+'°'],['Humidité',w.hum+' %'],['Pluie',d.pluie+' %'],['Vent',d.vent+' km/h '+d.dir],['Lever',d.lever],['Coucher',d.coucher]]
  :[['Pluie',d.pluie+' %'],['Cumul',d.mm+' mm'],['Vent',d.vent+' km/h '+d.dir],['Lever',d.lever],['Coucher',d.coucher],['Écart',(d.max-d.min)+'°']];
 H.innerHTML=`<div class="wxh-top"><button type="button" class="wxnav" data-wxd="-1" ${i===0?'disabled':''} aria-label="Jour précédent">‹</button><div class="wxh-day"><b>${esc(label)}</b><small>${esc(w.ville)}</small></div><button type="button" class="wxnav" data-wxd="1" ${i>=J.length-1?'disabled':''} aria-label="Jour suivant">›</button></div>
 <div class="wxh-main">${scene(cond,nt)}<div class="wxh-t"><div class="big">${esc(today?w.actuelle:d.max)}°</div><div class="cond">${esc(cond)}</div><div class="wxh-mm"><span>↑ ${esc(d.max)}°</span><span>↓ ${esc(d.min)}°</span></div></div></div>
 <div class="wxh-stats">${stats.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
 <div class="wxh-strip">${J.map((x,j)=>`<button type="button" data-wxh="${j}" class="${j===i?'sel':''}"><small>${j?esc(jour(x.date)):'Auj.'}</small>${ico(x.cond)}<b>${esc(x.max)}°</b></button>`).join('')}</div>`;
 if(typeof wxFxSet==='function')wxFxSet(sk);
 if(typeof fx==='function'&&renderWxHome._last!==undefined&&renderWxHome._last!==i)fx(H.querySelector('.wxh-main'),{opacity:[0,1],x:[renderWxHome._last<i?40:-40,0]},{stiffness:300,damping:26});renderWxHome._last=i}
$('#h-wx').addEventListener('click',e=>{const n=e.target.closest('[data-wxd]'),c=e.target.closest('[data-wxh]');if(!n&&!c)return;e.stopPropagation();
 const L=D.wx?.jours?.length||1;S.hday=c?+c.dataset.wxh:Math.max(0,Math.min(L-1,S.hday+ +n.dataset.wxd));renderWxHome();if(typeof fxTemp==='function'&&S.hday===0)fxTemp()});

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
 $('#h-ann')&&($('#h-ann').innerHTML=L.filter(a=>!a.done).slice(0,3).map(a=>`<li class="mline"><span class="tag ${a.k==='tache'?'t':'n'}">${a.k==='tache'?'Tâche':'Nouvelle'}</span><span>${esc(a.title)}</span></li>`).join('')||'<li class="empty">Aucune tâche en cours.</li>');
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
let slideCur='';
function slide(keep){const L=ph(),P=$('#h-pic');if(!P)return;
 if(!L.length){P.innerHTML='<div class="empty">Pas encore de photo</div>';slideCur='';$('#h-cap').textContent='';return}
 if(!keep)S.pi=(S.pi+1)%L.length;S.pi%=L.length;const p=L[S.pi];$('#h-cap').textContent=p.cap||'';
 if(p.id===slideCur&&P.querySelector('.pl'))return;slideCur=p.id;
 const ly=document.createElement('div');ly.className='pl';ly.style.setProperty('--kb',Math.max(6,SPD||12)+2+'s');
 ly.innerHTML=`<img class="bg" src="${p.img}" alt="" aria-hidden="true"><img class="fg" src="${p.img}" alt="${esc(p.cap||'Photo')}">`;
 const olds=[...P.children];const first=!P.querySelector('.pl');P.appendChild(ly);
 const show=()=>{requestAnimationFrame(()=>{ly.classList.add('in');setTimeout(()=>olds.forEach(o=>o.remove()),2300)})};
 const im=ly.querySelector('.fg');if(first){olds.forEach(o=>o.remove());ly.classList.add('in','now');return}
 (im.decode?im.decode():Promise.resolve()).then(show,show)}
let SPD=15;try{const v=localStorage.getItem('diapo');if(v!==null&&!isNaN(+v))SPD=+v}catch(e){}
let spT=null;
function spRun(){clearInterval(spT);spT=null;if(SPD>0)spT=setInterval(()=>{if(!document.hidden)slide(false)},SPD*1000)}
const spLbl=v=>!v?'Arrêt':v<60?v+' s':(v%60?Math.floor(v/60)+' min '+(v%60)+' s':(v/60)+' min');
function spShow(){$('#p-now').textContent=spLbl(SPD);$('#p-speed').querySelectorAll('button').forEach(b=>b.classList.toggle('on',+b.dataset.s===SPD));
 $('#p-sec').value=Math.min(120,Math.max(2,SPD||10));$('#p-secv').textContent=SPD?spLbl(SPD):'—'}
function spSet(v){SPD=v;try{localStorage.setItem('diapo',String(v))}catch(e){}spShow();spRun()}
$('#p-speed').addEventListener('click',e=>{const b=e.target.closest('[data-s]');if(b)spSet(+b.dataset.s)});
$('#p-sec').addEventListener('input',e=>{$('#p-secv').textContent=spLbl(+e.target.value)});
$('#p-sec').addEventListener('change',e=>spSet(+e.target.value));
spShow();spRun();
$('#p-grid').addEventListener('click',e=>{const b=e.target.closest('[data-p]');if(b)openV(+b.dataset.p)});
$('#h-pic')?.addEventListener('click',()=>{location.hash='photos'});
$('#h-pic')?.addEventListener('keydown',e=>{if(e.key==='Enter')location.hash='photos'});
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




/* ---------- illustrations de plats (vue de dessus) ---------- */
const ART={pasta:['#ffb347','#ff6b3d'],soup:['#ff9a5a','#e8542a'],omelette:['#ffd25e','#f59e0b'],salad:['#7ee8a2','#16a34a'],croque:['#ffc46b','#d97706'],gratin:['#ffcf7a','#c2410c'],
 quiche:['#ffd98a','#ea8a1a'],curry:['#ffb45c','#d9480f'],crepe:['#ffd6a5','#f08a24'],pizza:['#ff8a7a','#d62828'],parmentier:['#e8b07a','#9a4a1c'],cake:['#ffcf9e','#d97706']};
function dishArt(k){const [c1,c2]=ART[k]||ART.pasta,id='da'+k;let f='';let sd=[...k].reduce((a,c)=>a*31+c.charCodeAt(0),7)>>>0;const rnd=()=>((sd=(sd*1664525+1013904223)>>>0)/4294967296);const R=(a,b)=>a+rnd()*(b-a);
 const plate=(r=58)=>`<ellipse cx="100" cy="92" rx="${r+8}" ry="${r*.92+8}" fill="#000" opacity=".22"/><circle cx="100" cy="86" r="${r+8}" fill="#f8f6f2"/><circle cx="100" cy="86" r="${r}" fill="#ece7df"/><circle cx="100" cy="86" r="${r-4}" fill="#fffdfa"/>`;
 const dish=(w,h,col)=>`<rect x="${100-w/2-6}" y="${86-h/2-2}" width="${w+12}" height="${h+12}" rx="16" fill="#000" opacity=".2"/><rect x="${100-w/2-6}" y="${86-h/2-6}" width="${w+12}" height="${h+12}" rx="16" fill="${col}"/>`;
 if(k==='pasta')f=plate()+Array.from({length:9},(_,i)=>`<path d="M${70+i*2} ${70+i*3}q${R(10,22)} ${R(-14,-4)} ${R(30,46)} ${R(-4,10)}t${R(14,22)} ${R(-6,8)}" stroke="#f6c453" stroke-width="5" fill="none" stroke-linecap="round"/>`).join('')+Array.from({length:7},()=>`<rect x="${R(72,124)}" y="${R(66,104)}" width="7" height="5" rx="1.5" fill="#c2410c"/>`).join('')+'<circle cx="112" cy="78" r="3" fill="#333" opacity=".5"/><circle cx="90" cy="96" r="2.5" fill="#333" opacity=".5"/>';
 else if(k==='soup')f=plate(56)+'<circle cx="100" cy="86" r="44" fill="#f97316"/><circle cx="100" cy="86" r="44" fill="url(#'+id+'g)" opacity=".5"/><path d="M80 82q20-18 38 0t-12 18q-14 2-12-10" stroke="#fff7ed" stroke-width="5" fill="none" stroke-linecap="round"/>'+Array.from({length:6},()=>`<circle cx="${R(76,124)}" cy="${R(66,106)}" r="2.2" fill="#3f7d20"/>`).join('');
 else if(k==='omelette')f=plate()+'<path d="M52 92a48 40 0 0 1 96 0z" fill="#fbbf24"/><path d="M52 92a48 40 0 0 1 96 0" fill="none" stroke="#f59e0b" stroke-width="3"/>'+Array.from({length:5},(_,i)=>`<ellipse cx="${72+i*14}" cy="${76-(i%2)*8}" rx="6" ry="4" fill="#a16207"/>`).join('')+'<circle cx="84" cy="66" r="2" fill="#22c55e"/><circle cx="112" cy="70" r="2" fill="#22c55e"/>';
 else if(k==='salad')f=plate()+Array.from({length:10},()=>`<ellipse cx="${R(66,134)}" cy="${R(58,112)}" rx="${R(12,18)}" ry="${R(6,9)}" transform="rotate(${R(0,180)} ${100} ${86})" fill="${['#4ade80','#22c55e','#86efac'][rnd()*3|0]}"/>`).join('')+Array.from({length:5},()=>`<rect x="${R(74,120)}" y="${R(66,104)}" width="14" height="7" rx="3" fill="#f5d0a0"/>`).join('')+Array.from({length:6},()=>`<rect x="${R(70,126)}" y="${R(62,108)}" width="7" height="7" rx="1.5" fill="#d6a15c"/>`).join('');
 else if(k==='croque')f=plate()+[[-22,-8],[20,10]].map(([dx,dy])=>`<rect x="${78+dx}" y="${64+dy}" width="46" height="44" rx="8" fill="#e8a24a"/><rect x="${81+dx}" y="${67+dy}" width="40" height="38" rx="6" fill="#f6c453"/><path d="M${84+dx} ${80+dy}q10-6 20 0t14 4" stroke="#d9822b" stroke-width="3" fill="none"/>`).join('');
 else if(k==='gratin')f=dish(110,80,'#7c2d12')+'<rect x="49" y="50" width="102" height="72" rx="12" fill="#f4b860"/>'+Array.from({length:12},()=>`<ellipse cx="${R(60,140)}" cy="${R(58,114)}" rx="11" ry="7" fill="#e7a03b" opacity=".85"/>`).join('')+Array.from({length:8},()=>`<circle cx="${R(58,142)}" cy="${R(56,116)}" r="${R(3,6)}" fill="#a85d1a" opacity=".6"/>`).join('');
 else if(k==='quiche')f=`<circle cx="100" cy="92" r="66" fill="#000" opacity=".2"/><circle cx="100" cy="86" r="64" fill="#d9822b"/>`+Array.from({length:24},(_,i)=>{const a=i/24*6.283;return `<circle cx="${100+60*Math.cos(a)}" cy="${86+60*Math.sin(a)}" r="7" fill="#e8a24a"/>`}).join('')+'<circle cx="100" cy="86" r="52" fill="#fcd34d"/>'+Array.from({length:12},()=>`<rect x="${R(66,128)}" y="${R(54,112)}" width="8" height="5" rx="1.5" fill="#c2410c" opacity=".8"/>`).join('')+'<path d="M100 86L100 34A52 52 0 0 1 145 60z" fill="#fde68a" opacity=".7"/>';
 else if(k==='curry')f=plate()+'<path d="M58 86a42 40 0 0 1 42-40v80a42 40 0 0 1-42-40z" fill="#fff"/>'+Array.from({length:16},()=>`<ellipse cx="${R(64,96)}" cy="${R(54,118)}" rx="3" ry="1.5" fill="#e5e5e5"/>`).join('')+'<path d="M100 46a42 40 0 0 1 0 80z" fill="#f59e0b"/>'+Array.from({length:6},()=>`<rect x="${R(104,132)}" y="${R(62,108)}" width="11" height="9" rx="3" fill="#fde68a"/>`).join('')+'<circle cx="120" cy="70" r="3" fill="#16a34a"/><circle cx="112" cy="100" r="3" fill="#16a34a"/>';
 else if(k==='crepe')f=plate()+[0,1,2].map(i=>`<path d="M${66+i*8} ${108-i*14}L${132-i*2} ${100-i*14}L${100+i*4} ${62-i*4}z" fill="${['#f8c98a','#f3b86a','#fad7a0'][i]}" stroke="#e59f4a" stroke-width="2" stroke-linejoin="round"/>`).join('')+Array.from({length:14},()=>`<circle cx="${R(74,126)}" cy="${R(56,98)}" r="1.4" fill="#fff"/>`).join('')+'<path d="M108 64q8 6 0 12" stroke="#7c2d12" stroke-width="3" fill="none" stroke-linecap="round"/>';
 else if(k==='pizza')f=`<circle cx="100" cy="92" r="66" fill="#000" opacity=".2"/><circle cx="100" cy="86" r="64" fill="#e0a458"/><circle cx="100" cy="86" r="54" fill="#dc2626"/>`+Array.from({length:9},()=>`<ellipse cx="${R(62,138)}" cy="${R(50,122)}" rx="${R(9,13)}" ry="${R(7,10)}" fill="#fff7d6"/>`).join('')+Array.from({length:6},()=>`<circle cx="${R(66,134)}" cy="${R(54,118)}" r="6" fill="#f472b6" opacity=".85"/>`).join('')+Array.from({length:6},()=>`<path d="M${R(66,130)} ${R(54,116)}a5 5 0 0 1 10 0z" fill="#d6d3d1"/>`).join('')+Array.from({length:10},()=>`<circle cx="${R(60,140)}" cy="${R(46,126)}" r="1.4" fill="#166534"/>`).join('');
 else if(k==='parmentier')f=dish(110,80,'#9a3412')+'<rect x="49" y="50" width="102" height="72" rx="12" fill="#fde7b0"/>'+Array.from({length:9},(_,i)=>`<path d="M${56+i*11} 56q6 30 0 62" stroke="#f2c94c" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>`).join('')+Array.from({length:10},()=>`<circle cx="${R(58,142)}" cy="${R(56,116)}" r="${R(3,6)}" fill="#c2410c" opacity=".55"/>`).join('');
 else f=`<rect x="44" y="72" width="112" height="52" rx="12" fill="#000" opacity=".2"/><rect x="44" y="64" width="112" height="54" rx="14" fill="#c2671c"/><rect x="48" y="58" width="104" height="30" rx="14" fill="#e8a24a"/><path d="M60 66q40-18 80 0" stroke="#f6c453" stroke-width="6" fill="none" stroke-linecap="round"/>`+Array.from({length:12},()=>`<circle cx="${R(58,142)}" cy="${R(62,80)}" r="1.6" fill="#fff" opacity=".8"/>`).join('')+'<rect x="76" y="62" width="2" height="52" fill="#a24f12" opacity=".5"/><rect x="122" y="62" width="2" height="52" fill="#a24f12" opacity=".5"/>';
 return `<svg viewBox="0 0 200 172" class="dart" aria-hidden="true"><defs><radialGradient id="${id}g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>${f}<ellipse cx="78" cy="46" rx="30" ry="12" fill="#fff" opacity=".16"/></svg>`}
/* ---------- widget « Idées repas » de l'accueil ---------- */
let IDI=0,IDT=null;
const idees=()=>RC.filter(r=>r.idee);
function renderIdees(dir){const L=idees(),st=$('#id-stage');if(!st)return;if(!L.length){st.innerHTML='<div class="empty">Idées en cours de chargement…</div>';return}
 IDI=(IDI+L.length)%L.length;const r=L[IDI],[c1,c2]=ART[r.art]||ART.pasta;
 const card=document.createElement('a');card.className='id-card';card.href='#recette-'+r.id;card.style.setProperty('--c1',c1);card.style.setProperty('--c2',c2);
 card.innerHTML=`<div class="id-art">${dishArt(r.art)}</div><div class="id-txt"><span class="id-kicker">Idée repas</span><h3>${esc(r.titre)}</h3><p>${esc(r.intro||'')}</p><div class="id-meta"><span>⏱ ${esc(r.duree||'')}</span><span>${esc(r.niveau||'Facile')}</span><span>${esc(unit(r,r.portions))}</span></div><span class="id-go">Voir la recette ›</span></div>`;
 const olds=[...st.children];st.appendChild(card);
 if(olds.length&&typeof fx==='function'&&MO){fx(card,{opacity:[0,1],x:[dir<0?-60:60,0],scale:[.96,1]},{stiffness:200,damping:24});olds.forEach(o=>{fx(o,{opacity:[1,0],x:[0,dir<0?60:-60]},{type:'tween',duration:.45});setTimeout(()=>o.remove(),480)})}else olds.forEach(o=>o.remove());
 $('#id-dots').innerHTML=L.map((_,i)=>`<button type="button" data-idi="${i}" class="${i===IDI?'on':''}" aria-label="Idée ${i+1}"></button>`).join('')}
function idPlay(){clearInterval(IDT);IDT=setInterval(()=>{if(!document.hidden&&curPage==='home'){IDI++;renderIdees(1)}},9000)}
$('#id-dots').addEventListener('click',e=>{const b=e.target.closest('[data-idi]');if(!b)return;const n=+b.dataset.idi;const d=n>IDI?1:-1;IDI=n;renderIdees(d);idPlay()});
{let x0=null;const st=$('#id-stage');st.addEventListener('touchstart',e=>{x0=e.touches[0].clientX},{passive:true});
 st.addEventListener('touchend',e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>50){IDI+=dx<0?1:-1;renderIdees(dx<0?1:-1);idPlay();e.preventDefault()}})}

/* ---------- utile : recettes (recettes.json, publiées depuis la conversation) ---------- */
let RC=[];const RS={};
async function loadRC(){try{const r=await fetch('recettes.json?t='+Date.now(),{cache:'no-store'});if(r.ok)RC=await r.json()}catch(e){}renderRC();IDI=Math.floor(Math.random()*Math.max(1,idees().length));renderIdees(1);idPlay();route()}
const fmtQ=(q,u)=>{if(!q)return '';let v=q;if(u==='g'&&v>=1000){v=v/1000;u='kg'}
 const r=v>=10?Math.round(v):Math.round(v*4)/4;const s=Number.isInteger(r)?String(r):String(r).replace('.',',');return s+(u?' '+u:'')};
const unit=(r,n)=>{const u=Array.isArray(r.unite)?r.unite:['personne','personnes'];return n+' '+(n>1?u[1]:u[0])};
const chefOk=c=>c&&typeof c.photo==='string'&&/^photos\/[\w.-]+\.(jpe?g|png|webp)$/i.test(c.photo);
const metaR=r=>[r.prep&&'Prépa '+r.prep,r.cuisson&&'Cuisson '+r.cuisson,r.repos&&'Repos '+r.repos].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('');
function renderRC(){
 $('#u-rc')&&($('#u-rc').textContent=RC.length+' recette'+(RC.length>1?'s':''));
 $('#rc-list').innerHTML=RC.length?RC.map(r=>`<a class="rcard${chefOk(r.chef)||r.art?' haschef':''}" href="#recette-${esc(r.id)}">${chefOk(r.chef)?`<img class="chefpic" src="${r.chef.photo}" alt="Chef ${esc(r.chef.nom)}">`:r.art?`<span class="chefpic artpic" style="--c1:${(ART[r.art]||ART.pasta)[0]};--c2:${(ART[r.art]||ART.pasta)[1]}">${dishArt(r.art)}</span>`:''}<div><h3>${esc(r.titre)}</h3>${r.chef?`<div class="chefby">Recette du chef ${esc(r.chef.nom)}</div>`:''}<p>${esc(r.intro||'')}</p><div class="meta">${r.ingredients?.length?`<span>${esc(unit(r,r.portions))}</span>`:''}${metaR(r)}${!r.etapes?.length?'<span>Bientôt</span>':''}</div></div></a>`).join(''):'<div class="empty plate">Aucune recette pour l\'instant.</div>'}
function renderOne(id){
 const r=RC.find(x=>x.id===id);if(!r){$('#rc-one').innerHTML='<div class="empty plate">Recette introuvable.</div>';return}
 const st=RS[id]??={p:r.portions,ing:new Set(),ok:new Set()},k=st.p/r.portions;
 $('#rc-one').innerHTML=`<div class="rhead"><h1 class="v"><svg class="ic-l"><use href="#i-recette"/></svg>${esc(r.titre)}</h1><p>${esc(r.intro||'')}</p><div class="meta">${metaR(r)}</div></div>
 ${chefOk(r.chef)?`<section class="plate chef"><img src="${r.chef.photo}" alt="Chef ${esc(r.chef.nom)}"><div><small>La recette du chef</small><b>${esc(r.chef.nom)}</b></div></section>`:''}
 ${!r.ingredients?.length&&!r.etapes?.length?`<section class="plate"><div class="empty">Ingrédients et étapes à venir.</div></section>`:`
 <div class="rgrid"><section class="plate"><h2>Ingrédients</h2><div class="serv"><button type="button" data-sv="-1" aria-label="Moins">−</button><b>${esc(unit(r,st.p))}</b><button type="button" data-sv="1" aria-label="Plus">+</button></div>
 <button type="button" class="ghost rcadd" data-tocs="${esc(r.id)}">🛒 Ajouter à la liste de courses</button><ul class="ing" style="margin-top:12px">${r.ingredients.map((g,i)=>`<li><label><input type="checkbox" data-ing="${i}" ${st.ing.has(i)?'checked':''}><span>${g.q?`<span class="q">${esc(fmtQ(g.q*k,g.u))}</span> `:''}${esc(g.n)}</span></label></li>`).join('')}</ul></section>
 <section class="plate"><h2>Étapes</h2><ol class="steps">${r.etapes.map((e,i)=>`<li data-st="${i}" class="${st.ok.has(i)?'ok':''}"><div><b>${esc(e.t)}</b><p>${esc(e.d)}</p>${e.min?`<button type="button" class="timer" data-tm="${e.min}">⏱ Minuteur ${e.min} min</button>`:''}</div></li>`).join('')}</ol>
 ${r.astuces?.length?`<h2 style="margin-top:18px">Astuces</h2><ul class="tips">${r.astuces.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`:''}</section></div>`}`}
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
 $('#cs-count').textContent=n;$('#cs-fabn').textContent=n;$('#u-cs')&&($('#u-cs').textContent=n?n+' article'+(n>1?'s':'')+' à acheter':'Rien à acheter');
 $('#cs-fab').hidden=!(n&&innerWidth<900&&curPage==='courses');
 $('#cs-sum').innerHTML=chosen.length?CAT.map(([k,name])=>{const g=chosen.filter(x=>x.cat===k);if(!g.length)return '';
  return `<div class="rg"><h4>${esc(name)}</h4><ul class="rl">${g.map(x=>`<li class="${CS.got.includes(x.id)?'got':''}"><button type="button" class="ck" data-got="${esc(x.id)}" aria-label="Dans le caddie">${CS.got.includes(x.id)?'✓':''}</button><span>${esc(x.n)}</span><span class="qty"><button type="button" data-qt="-1" data-id="${esc(x.id)}" aria-label="Moins">−</button><b>${CS.sel[x.id]}</b><button type="button" data-qt="1" data-id="${esc(x.id)}" aria-label="Plus">+</button></span></li>`).join('')}</ul></div>`}).join(''):'<div class="empty">Coche les articles dont tu as besoin : ils apparaissent ici, rangés par rayon.</div>';
}
function csText(){const all=csItems().filter(x=>CS.sel[x.id]);return 'Liste de courses\n'+CAT.map(([k,name])=>{const g=all.filter(x=>x.cat===k);return g.length?'\n'+name+'\n'+g.map(x=>'- '+x.n+(CS.sel[x.id]>1?' ×'+CS.sel[x.id]:'')).join('\n'):''}).join('\n')}
$('#cs-cats').addEventListener('change',e=>{const c=e.target.closest('[data-cs]');if(!c)return;const id=c.dataset.cs,on=c.checked;
 if(on)CS.sel[id]=CS.sel[id]||1;else{delete CS.sel[id];CS.got=CS.got.filter(x=>x!==id)}csSave();renderCS();
 if(on){const q=CSS.escape(id);fx(document.querySelector(`[data-cs="${q}"]~.bx`),{scale:[.5,1.25,1]},{type:'tween',duration:.35});
  fx(document.querySelector(`#cs-sum [data-got="${q}"]`)?.closest('li'),{opacity:[0,1],x:[24,0]},{stiffness:380,damping:26});fx($('#cs-count'),{scale:[1.35,1]},{stiffness:600,damping:12})}});
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
addEventListener('resize',()=>{$('#cs-fab').hidden=!(Object.keys(CS.sel).length&&innerWidth<900&&curPage==='courses')});
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



/* ---------- animations Motion (facultatives : l'appli marche sans) ---------- */
var RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
var MO=null;
function fxBadge(t,ok){const b=$('#fxinfo');if(b){b.textContent=t;b.classList.toggle('ok',!!ok)}}
fxBadge(RM?'Version 46 · animations coupées par le réglage « Réduire les animations » de l\'appareil':'Version 46 · chargement des animations…');
if(!RM){const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/motion@14.10.1/dist/motion.js';sc.async=true;
 sc.onerror=()=>fxBadge('Version 46 · animations non chargées (connexion ?)');
 sc.onload=()=>{MO=window.Motion||null;if(MO){document.documentElement.classList.add('mo');fxBadge('Version 46 · animations actives ✨',true);setTimeout(()=>$('#fxinfo')?.classList.add('fade'),6000);fxView(document.getElementById('v-'+curPage))}else fxBadge('Version 46 · animations non chargées')};document.head.appendChild(sc)}
const SPR={type:'spring',stiffness:420,damping:28};
function fx(el,kf,o){if(!MO||!el)return null;try{return MO.animate(el,kf,{type:'spring',stiffness:420,damping:28,...o})}catch(e){return null}}
function fxView(v){if(!MO||!v)return;
 const kids=v.id==='v-home'?[...v.querySelectorAll('.app-ic'),...v.querySelectorAll('.widgets>.plate')]:[...v.querySelectorAll('.pg>.plate,.pg>.agenda>.plate,.pg>.shop>.plate,.note,.rcard,.item,.thumb')];
 if(kids.length&&kids.length<80)fx(kids,{opacity:[0,1],y:[30,0],scale:[.9,1]},{delay:MO.stagger(.035),stiffness:220,damping:18})}
document.addEventListener('click',e=>{const a=e.target.closest('.app-ic');if(a&&!editing)fx(a.querySelector('svg'),{scale:[.7,1],rotate:[-6,0]},{stiffness:500,damping:10})},true);
document.addEventListener('pointerdown',e=>{const b=e.target.closest('.btn,.chip,.mic,.tile,.sw,.check,.ck');if(b&&!editing)fx(b,{scale:[.85,1]},{stiffness:600,damping:10})},true);
var wxPrev=null;
function fxTemp(){const el=document.querySelector('#h-wx .big');if(!el||!D.wx)return;const cur=+D.wx.actuelle,from=wxPrev==null?cur-6:wxPrev;wxPrev=cur;
 if(!MO||from===cur)return;try{MO.animate(from,cur,{duration:.9,ease:[.2,.8,.2,1],onUpdate:v=>{el.textContent=Math.round(v)+'°'}})}catch(e){}}


/* ---------- effets visuels : météo animée, reflets, loupe du dock, confettis ---------- */
var RMX=matchMedia('(prefers-reduced-motion: reduce)').matches;
/* météo animée dans le widget */
const WC=$('#wxfx'),wctx=WC.getContext('2d');let wxKind='',wxP=[],wxRaf=0,wxVis=true,flash=0;
function wxFxSet(k){if(RMX)return;wxKind=k||'cloud';const W=WC.clientWidth,H=WC.clientHeight,dpr=Math.min(2,devicePixelRatio||1);WC.width=W*dpr;WC.height=H*dpr;wctx.setTransform(dpr,0,0,dpr,0,0);
 const n={rain:45,storm:60,snow:40,night:45,sun:18,cloud:5,fog:6}[wxKind]||16;wxP=Array.from({length:n},()=>({x:Math.random()*W,y:Math.random()*H,v:.4+Math.random(),s:Math.random(),p:Math.random()*6.28}));
 if(!wxRaf)wxRaf=requestAnimationFrame(wxDraw)}
let wxLast=0;function wxDraw(t){wxRaf=0;if(!wxVis||document.hidden||curPage!=='home'){return}if(t-wxLast<32){wxRaf=requestAnimationFrame(wxDraw);return}wxLast=t;
 const W=WC.clientWidth,H=WC.clientHeight;wctx.clearRect(0,0,W,H);
 for(const p of wxP){
  if(wxKind==='rain'||wxKind==='storm'){p.y+=12+p.v*12;p.x-=2.5;if(p.y>H){p.y=-20;p.x=Math.random()*W*1.1}wctx.strokeStyle=`rgba(180,220,255,${.25+p.s*.35})`;wctx.lineWidth=1+p.s;wctx.beginPath();wctx.moveTo(p.x,p.y);wctx.lineTo(p.x-2.5,p.y+12+p.v*6);wctx.stroke()}
  else if(wxKind==='snow'){p.y+=.9+p.v*1.5;p.x+=Math.sin(t/1200+p.p)*.5;if(p.y>H){p.y=-6;p.x=Math.random()*W}wctx.fillStyle=`rgba(255,255,255,${.5+p.s*.4})`;wctx.beginPath();wctx.arc(p.x,p.y,1.2+p.s*2.4,0,7);wctx.fill()}
  else if(wxKind==='night'){const a=.25+.75*Math.abs(Math.sin(t/900*p.v+p.p));wctx.fillStyle=`rgba(255,255,255,${a*.8})`;wctx.beginPath();wctx.arc(p.x,p.y*.7,.6+p.s*1.4,0,7);wctx.fill()}
  else if(wxKind==='sun'){p.y-=.25*p.v;p.x+=Math.sin(t/2000+p.p)*.3;if(p.y<-10){p.y=H+10;p.x=Math.random()*W}const g=wctx.createRadialGradient(p.x,p.y,0,p.x,p.y,6+p.s*10);g.addColorStop(0,'rgba(255,240,180,.55)');g.addColorStop(1,'rgba(255,240,180,0)');wctx.fillStyle=g;wctx.beginPath();wctx.arc(p.x,p.y,6+p.s*10,0,7);wctx.fill()}
  else{p.x+=.15*p.v;if(p.x>W+120)p.x=-120;const g=wctx.createRadialGradient(p.x,p.y,0,p.x,p.y,90+p.s*60);g.addColorStop(0,'rgba(255,255,255,.07)');g.addColorStop(1,'rgba(255,255,255,0)');wctx.fillStyle=g;wctx.beginPath();wctx.arc(p.x,p.y,90+p.s*60,0,7);wctx.fill()}}
 if(wxKind==='sun'){const r=Math.max(W,H)*.9,g=wctx.createRadialGradient(W*.15,H*.1,0,W*.15,H*.1,r);g.addColorStop(0,`rgba(255,220,120,${.18+.06*Math.sin(t/1500)})`);g.addColorStop(1,'rgba(255,220,120,0)');wctx.fillStyle=g;wctx.fillRect(0,0,W,H)}
 if(wxKind==='storm'){if(Math.random()<.004)flash=1;if(flash>0){wctx.fillStyle=`rgba(230,230,255,${flash*.5})`;wctx.fillRect(0,0,W,H);flash-=.06}}
 wxRaf=requestAnimationFrame(wxDraw)}
new IntersectionObserver(es=>{wxVis=es[0].isIntersecting;if(wxVis&&!wxRaf&&wxKind)wxRaf=requestAnimationFrame(wxDraw)}).observe($('#wxcard'));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!wxRaf&&wxKind)wxRaf=requestAnimationFrame(wxDraw)});
new ResizeObserver(()=>{if(wxKind)wxFxSet(wxKind)}).observe($('#wxcard'));
/* reflet lumineux qui suit le doigt */
let glareEl=null;
document.addEventListener('pointermove',e=>{const p=e.target.closest&&e.target.closest('.plate');if(glareEl&&glareEl!==p){glareEl.classList.remove('glare');glareEl=null}
 if(!p||editing)return;const r=p.getBoundingClientRect();p.style.setProperty('--mx',(e.clientX-r.left)+'px');p.style.setProperty('--my',(e.clientY-r.top)+'px');if(!glareEl){p.classList.add('glare');glareEl=p}},{passive:true});
document.addEventListener('pointerdown',e=>{const p=e.target.closest('.plate');if(!p||editing)return;const r=p.getBoundingClientRect();p.style.setProperty('--mx',(e.clientX-r.left)+'px');p.style.setProperty('--my',(e.clientY-r.top)+'px');p.classList.add('glare');glareEl=p},{passive:true});
document.addEventListener('pointerup',e=>{if(glareEl&&e.pointerType!=='mouse'){const g=glareEl;setTimeout(()=>g.classList.remove('glare'),350);glareEl=null}});
/* confettis quand on termine quelque chose */
function confetti(x,y){if(RMX)return;const c=document.createElement('canvas');c.className='confetti';document.body.appendChild(c);const dpr=Math.min(2,devicePixelRatio||1);c.width=innerWidth*dpr;c.height=innerHeight*dpr;
 const g=c.getContext('2d');g.scale(dpr,dpr);const cols=['#ff4f8b','#ffd84d','#5ecbff','#7ee0a0','#b67bff','#ff8a3c'];
 const P=Array.from({length:70},()=>{const a=Math.random()*Math.PI*2,v=4+Math.random()*8;return{x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-6,r:Math.random()*6.28,vr:(Math.random()-.5)*.4,w:5+Math.random()*6,h:3+Math.random()*4,c:cols[Math.random()*cols.length|0]}});
 const t0=performance.now();(function f(t){const el=(t-t0)/1000;g.clearRect(0,0,innerWidth,innerHeight);
  for(const p of P){p.vy+=.32;p.vx*=.985;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;g.save();g.globalAlpha=Math.max(0,1-el/1.6);g.translate(p.x,p.y);g.rotate(p.r);g.fillStyle=p.c;g.fillRect(-p.w/2,-p.h/2,p.w,p.h);g.restore()}
  if(el<1.7)requestAnimationFrame(f);else c.remove()})(t0)}
document.addEventListener('click',e=>{if(editing)return;const t=e.target;
 const a=t.closest('[data-a="done"]'),g=t.closest('[data-got]'),n=t.closest('[data-n="done"]');
 const wasDone=a?a.classList.contains('on'):g?g.closest('li')?.classList.contains('got'):n?n.closest('.note')?.classList.contains('done'):true;
 if(!wasDone)confetti(e.clientX,e.clientY)},true);

/* ---------- organiser par appui long (disposition propre à chaque appareil) ---------- */
const keyOf=el=>el.dataset.k||el.dataset.v||el.getAttribute('href')||'';
const ORDK='ordre-v1';
let ORD={};try{ORD=JSON.parse(localStorage.getItem(ORDK)||'{}')||{}}catch(e){}
const DEF={};
document.querySelectorAll('[data-sort]').forEach(c=>{DEF[c.dataset.sort]=[...c.children].map(keyOf);applyOrd(c)});
function applyOrd(c){const o=ORD[c.dataset.sort];if(!Array.isArray(o))return;const m=new Map([...c.children].map(e=>[keyOf(e),e]));for(const k of o){const e=m.get(k);if(e)c.appendChild(e)}for(const e of m.values())if(!o.includes(keyOf(e)))c.appendChild(e)}
function saveOrd(c){ORD[c.dataset.sort]=[...c.children].map(keyOf);try{localStorage.setItem(ORDK,JSON.stringify(ORD))}catch(e){}if(c.dataset.sort==='apps'&&typeof syncPages==='function')syncPages()}
let editing=false,press=null,drag=null,cand=null,justDragged=0,raf=0,lastSwap=0;
function setEdit(on){editing=on;document.body.classList.toggle('editing',on);if(on&&navigator.vibrate)navigator.vibrate(15)}
$('#ed-done').addEventListener('click',()=>setEdit(false));
$('#ed-reset').addEventListener('click',()=>{ORD={};try{localStorage.removeItem(ORDK)}catch(e){}document.querySelectorAll('[data-sort]').forEach(c=>{const m=new Map([...c.children].map(e=>[keyOf(e),e]));for(const k of DEF[c.dataset.sort])m.get(k)&&c.appendChild(m.get(k))});if(typeof syncPages==='function')syncPages()});
function base(el){const t=el.style.transform;el.style.transform='none';const r=el.getBoundingClientRect();el.style.transform=t;return r}
function startDrag(el,x,y,id){const r=base(el);drag={el,c:el.parentElement,ox:x-r.left,oy:y-r.top,bx:r.left,by:r.top,x,y};el.classList.add('drag');el.style.pointerEvents='none';el.style.willChange='transform';paint()}
function paint(){if(!drag)return;const d=drag;d.el.style.transform=`translate3d(${d.x-d.ox-d.bx}px,${d.y-d.oy-d.by}px,0)`}
function swapCheck(){raf=0;if(!drag)return;paint();if(performance.now()-lastSwap<120)return;
 const el=document.elementFromPoint(drag.x,drag.y),t=el&&el.closest('[data-sort]>*');if(!t||t===drag.el||t.parentElement!==drag.c)return;
 const r=t.getBoundingClientRect();if(Math.abs(drag.x-(r.left+r.width/2))>r.width*.42||Math.abs(drag.y-(r.top+r.height/2))>r.height*.42)return;
 const kids=[...drag.c.children],ia=kids.indexOf(drag.el),ib=kids.indexOf(t),others=kids.filter(k=>k!==drag.el),before=new Map(others.map(k=>[k,k.getBoundingClientRect()]));
 ia<ib?t.after(drag.el):t.before(drag.el);lastSwap=performance.now();
 const nb=base(drag.el);drag.bx=nb.left;drag.by=nb.top;paint();
 for(const k of others){const p=before.get(k),q=k.getBoundingClientRect(),dx=p.left-q.left,dy=p.top-q.top;if(!dx&&!dy)continue;
  if(MO){try{MO.animate(k,{translate:[`${dx}px ${dy}px`,'0px 0px']},{type:'spring',stiffness:500,damping:34})}catch(e){}continue}
  k.style.transition='none';k.style.translate=`${dx}px ${dy}px`;k.getBoundingClientRect();k.style.transition='translate .22s cubic-bezier(.2,.8,.2,1)';k.style.translate='0px 0px';
  setTimeout(()=>{k.style.transition='';k.style.translate=''},260)}}
document.addEventListener('pointerdown',e=>{if(e.button>0)return;const it=e.target.closest('[data-sort]>*');
 if(editing){if(e.target.closest('.editbar'))return;cand={it,x:e.clientX,y:e.clientY};if(it)e.preventDefault();return}
 if(!it)return;press={it,x:e.clientX,y:e.clientY,t:setTimeout(()=>{const p=press;press=null;if(!p)return;setEdit(true);startDrag(p.it,p.x,p.y)},450)}},{passive:false});
document.addEventListener('pointermove',e=>{
 if(press&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>10){clearTimeout(press.t);press=null}
 if(cand&&!drag&&cand.it&&Math.hypot(e.clientX-cand.x,e.clientY-cand.y)>6){startDrag(cand.it,cand.x,cand.y);cand=null}
 if(!drag)return;e.preventDefault();drag.x=e.clientX;drag.y=e.clientY;if(!raf)raf=requestAnimationFrame(swapCheck)},{passive:false});
function endDrag(e){if(press){clearTimeout(press.t);press=null}
 if(drag&&MO){const d=drag,el=d.el,dx=d.x-d.ox-d.bx,dy=d.y-d.oy-d.by;drag=null;cancelAnimationFrame(raf);raf=0;cand=null;el.style.transform='';el.classList.remove('drag');el.style.pointerEvents='';el.style.willChange='';
  try{MO.animate(el,{translate:[`${dx}px ${dy}px`,'0px 0px']},{type:'spring',stiffness:420,damping:26})}catch(_){}saveOrd(d.c);justDragged=Date.now();return}
 if(cand&&!drag){cand=null;if(e&&e.type==='pointerup'){setEdit(false);justDragged=Date.now()}return}cand=null;
 if(!drag)return;const {el,c}=drag;drag=null;cancelAnimationFrame(raf);raf=0;
 el.style.transition='transform .2s cubic-bezier(.2,.8,.2,1)';el.style.transform='';el.classList.remove('drag');el.style.pointerEvents='';
 setTimeout(()=>{el.style.transition='';el.style.willChange=''},220);saveOrd(c);justDragged=Date.now()}
document.addEventListener('pointerup',endDrag);document.addEventListener('pointercancel',endDrag);
document.addEventListener('click',e=>{if(editing||Date.now()-justDragged<400){if(e.target.closest('.editbar'))return;e.preventDefault();e.stopPropagation()}},true);
document.addEventListener('contextmenu',e=>{if(e.target.closest('[data-sort]'))e.preventDefault()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&editing)setEdit(false)});


/* ---------- commande vocale ---------- */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const N=t=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9':,\s-]/g,' ').replace(/\s+/g,' ').trim();
let rec=null,listening=false;
function say(t){$('#vo-res').textContent=t;try{if(!speechSynthesis)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='fr-FR';u.rate=1.05;
 const v=speechSynthesis.getVoices().find(v=>/^fr/i.test(v.lang));if(v)u.voice=v;speechSynthesis.speak(u)}catch(e){}}
function voOpen(){const was=$('#vo').hidden;$('#vo').hidden=false;if(was&&typeof fx==='function'){fx($('.vo-card'),{opacity:[0,1],y:[40,0],scale:[.96,1]},{stiffness:380,damping:26})}$('#vo-help').hidden=true;$('#vo-heard').textContent='Je t\'écoute…';$('#vo-res').textContent='';}
function voClose(){$('#vo').hidden=true;try{rec&&rec.abort()}catch(e){}listening=false;armed=0;$('#orb').classList.remove('on')}
$('#vo-x').addEventListener('click',voClose);
$('#vo').addEventListener('click',e=>{if(e.target.id==='vo')voClose()});
$('#mic').addEventListener('click',()=>{
 if(!SR){voOpen();$('#orb').classList.remove('on');$('#vo-heard').textContent='Micro non disponible ici';say('La commande vocale n\'est pas disponible sur ce navigateur. Ouvre le site avec Chrome.');return}
 if(listening){try{rec.stop()}catch(e){}return}
 wakeStop();voOpen();rec=new SR();rec.lang='fr-FR';rec.interimResults=true;rec.maxAlternatives=1;rec.continuous=false;
 rec.onstart=()=>{listening=true;$('#orb').classList.add('on')};
 rec.onresult=e=>{let t='';for(const r of e.results)t+=r[0].transcript;$('#vo-heard').textContent='« '+t+' »';if(e.results[e.results.length-1].isFinal)handle(t)};
 rec.onerror=e=>{listening=false;$('#orb').classList.remove('on');
  const m={'not-allowed':'Autorise le micro : touche le cadenas à gauche de l\'adresse, puis Autorisations, Micro.','no-speech':'Je n\'ai rien entendu. Touche le micro et parle.','network':'Connexion nécessaire pour la reconnaissance vocale.'}[e.error];
  if(m){$('#vo-heard').textContent='Oups';say(m)}};
 rec.onend=()=>{listening=false;$('#orb').classList.remove('on');setTimeout(wakeStart,600)};
 try{rec.start()}catch(e){}});

/* « Ok Duch » : écoute en continu du mot d'activation (réglage propre à chaque appareil) */
const WAKE=/(?:^|\s)(?:(?:ok|okay|oke|okey|o k|ho|oh|au|hey|he|eh|aller)\s*,?\s*)?(?:d|t)(?:u|ou|eu|o)?(?:t?ch|sch|sh|ck|k|c|tsch)(?:e|es|s)?(?=\s|$)/;
const WAKE_STRICT=/(?:^|\s)(?:ok|okay|oke|okey|o k|ho|oh|au|hey|he|eh)\s*,?\s*(?:d|t)/;
const isWake=n=>{n=n.replace(/'/g,'');const m=n.match(WAKE);if(!m)return null;const hasOk=WAKE_STRICT.test(m[0]);return (hasOk||m.index===0)?m:null};
let OKD=false;try{OKD=localStorage.getItem('okduch')==='1'}catch(e){}
let wrec=null,wOn=false,armed=0,wFails=0,wLast=0,wOk=false,needTap=false;
const ANDROID=/Android/i.test(navigator.userAgent);
let liveT;function live(t){const el=$('#okd-live');el.hidden=!OKD;el.textContent=t;clearTimeout(liveT);liveT=setTimeout(()=>{if(OKD)el.textContent=wOn?'À l\'écoute de « Ok Duch »…':'Relance de l\'écoute…'},6000)}
function okdUI(){const b=$('#okd');$('#okd-live').hidden=!OKD;if(!OKD)return void(b.classList.remove('on'),b.textContent='« Ok Duch »',$('#mic').classList.remove('wake'));b.classList.toggle('on',OKD);b.textContent=OKD?'« Ok Duch » activé':'« Ok Duch »';$('#mic').classList.toggle('wake',OKD&&wOn)}
function wakeStop(){OKDpause=true;try{wrec&&wrec.abort()}catch(e){}wOn=false;okdUI()}
let OKDpause=false;
function wakeStart(){OKDpause=false;if(!SR||!OKD||wOn||listening||document.hidden)return;
 wrec=new SR();wrec.lang='fr-FR';wrec.continuous=!ANDROID;wrec.interimResults=true;wrec.maxAlternatives=3;
 wrec.onstart=()=>{wOn=true;wOk=true;needTap=false;wLast=Date.now();okdUI();live('À l\'écoute de « Ok Duch »…')};
 wrec.onresult=e=>{if(window.speechSynthesis&&speechSynthesis.speaking)return;
  for(let i=e.resultIndex;i<e.results.length;i++){const r=e.results[i];let txt=r[0].transcript,hit=null;
   for(let a=0;a<r.length;a++){const n=N(r[a].transcript).replace(/'/g,''),m=isWake(n);if(m){hit={n,m};txt=r[a].transcript;break}}
   live('J\'entends : « '+txt.trim()+' »'+(hit?' ✓':''));
   if(armed&&Date.now()<armed){if($('#vo').hidden)voOpen();$('#orb').classList.add('on');$('#vo-heard').textContent='« '+txt+' »';
    if(r.isFinal){armed=0;const n=N(txt);if((hit?n.slice(hit.m.index+hit.m[0].length):n).trim())handle(hit?n.slice(hit.m.index+hit.m[0].length):txt);else{armed=Date.now()+8000}}continue}
   if(hit){const rest=hit.n.slice(hit.m.index+hit.m[0].length).replace(/^[\s,]+/,'');
    if($('#vo').hidden){voOpen();if(navigator.vibrate)navigator.vibrate(20)}$('#orb').classList.add('on');$('#vo-heard').textContent=rest?'« '+rest+' »':'Je t\'écoute…';
    if(r.isFinal){if(rest.length>1){handle(rest)}else{armed=Date.now()+8000;say('Oui ?')}}}}};
 wrec.onerror=e=>{live('Écoute interrompue ('+e.error+')');
  if((e.error==='not-allowed'||e.error==='service-not-allowed')&&wOk){needTap=true;live('Touche l\'écran pour relancer l\'écoute « Ok Duch »');return}
  if(e.error==='not-allowed'||e.error==='service-not-allowed'){OKD=false;try{localStorage.setItem('okduch','0')}catch(_){}okdUI();
  voOpen();$('#vo-heard').textContent='Micro refusé';say('Autorise le micro pour utiliser Ok Duch : touche le cadenas à gauche de l\'adresse, puis Autorisations, Micro.')}};
 wrec.onend=()=>{wOn=false;okdUI();if(!OKD||OKDpause||listening||document.hidden||needTap)return;
  wFails=Date.now()-wLast<1500?wFails+1:0;setTimeout(wakeStart,ANDROID&&wFails<3?150:Math.min(30000,300*2**wFails))};
 try{wrec.start()}catch(e){needTap=true;live('Touche l\'écran pour relancer l\'écoute « Ok Duch »')}}
document.addEventListener('pointerdown',()=>{if(OKD&&!wOn&&!listening&&(needTap||!wrec)){needTap=false;wFails=0;wakeStart()}},true);
$('#okd').addEventListener('click',()=>{if(!SR){voOpen();$('#vo-heard').textContent='Micro non disponible ici';say('La commande vocale n\'est pas disponible sur ce navigateur. Ouvre le site avec Chrome.');return}
 OKD=!OKD;try{localStorage.setItem('okduch',OKD?'1':'0')}catch(e){}okdUI();
 if(OKD){wakeStart();voOpen();$('#orb').classList.remove('on');$('#vo-heard').textContent='« Ok Duch » est activé';say('C\'est activé. Dis Ok Duch, puis ta demande.');setTimeout(voClose,3500)}else wakeStop()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){try{wrec&&wrec.abort()}catch(e){}}else setTimeout(wakeStart,500)});
okdUI();if(OKD)setTimeout(wakeStart,1500);
const go=(h,msg)=>{location.hash=h;say(msg);setTimeout(voClose,1800)};
const NUM={un:1,une:1,deux:2,trois:3,quatre:4,cinq:5,six:6,sept:7,huit:8,neuf:9,dix:10,douze:12};
function csAddVoice(list){const done=[];
 for(let raw of list.split(/,|\set\s|\spuis\s|\savec\s/)){let t=N(raw).replace(/^(du|de la|de l'|des|de|d'|un|une|le|la|les|l'|quelques|aussi|encore)\s*/,'').replace(/^(du|de la|de l'|des|de|d')\s*/,'').trim();
  if(!t)continue;let q=1;const m=t.match(/^(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze)\s+(.*)$/);if(m){q=+m[1]||NUM[m[1]]||1;t=m[2].replace(/^(de|d')\s*/,'')}
  t=t.replace(/^(paquets?|boites?|bouteilles?|packs?|kilos?|kg|litres?|sachets?|pots?|tranches?)\s+(de|d')\s*/,'');
  const sg=x=>slug(x).replace(/(?<=\w{3})(s|x)\b/g,'');const k=sg(t);
  let it=csItems().find(x=>sg(x.n)===k)||csItems().find(x=>sg(x.n).startsWith(k)||k.startsWith(sg(x.n)+'-'));
  if(!it){const nm=t.charAt(0).toUpperCase()+t.slice(1);it={id:'p-'+slug(nm),n:nm,cat:'ps'};CS.perso=[...(CS.perso||[]),it]}
  CS.sel[it.id]=Math.max(CS.sel[it.id]||0,q);CS.got=CS.got.filter(x=>x!==it.id);done.push((q>1?q+' ':'')+it.n.toLowerCase())}
 csSave();renderCS();return done}
const JOURS=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'],MOIS=['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
function parseDate(t){const d=new Date();d.setHours(12,0,0,0);let used='';
 if(/apres[- ]demain/.test(t)){d.setDate(d.getDate()+2);used=/apres[- ]demain/}
 else if(/\bdemain\b/.test(t)){d.setDate(d.getDate()+1);used=/\bdemain\b/}
 else if(/\baujourd'?hui\b|\bce soir\b|\bcet apres-midi\b/.test(t)){used=/\baujourd'?hui\b|\bce soir\b|\bcet apres-midi\b/}
 else{const m=t.match(/\b(?:le\s+)?(\d{1,2}|premier|1er)\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)?\b(?!\s*h)/);
  const w=t.match(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/);
  if(m&&!/^\d{1,2}\s*(h|heure)/.test(m[0].replace(/^le\s+/,''))&&(m[2]||/\ble\s+\d/.test(m[0]))){const day=/prem|1er/.test(m[1])?1:+m[1];let mo=m[2]?MOIS.indexOf(m[2]):d.getMonth();
   const c=new Date(d.getFullYear(),mo,day,12);if(c<new Date(new Date().setHours(0,0,0,0)))m[2]?c.setFullYear(c.getFullYear()+1):c.setMonth(c.getMonth()+1);d.setTime(c.getTime());used=new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}
  else if(w){const target=JOURS.indexOf(w[1]);let diff=(target-d.getDay()+7)%7;if(diff===0)diff=7;d.setDate(d.getDate()+diff);used=new RegExp('\\b(ce |prochain |)'+w[1]+'( prochain)?\\b')}}
 return {date:iso(d),rest:used?t.replace(used,' '):t,found:!!used}}
function parseTime(t){const m=t.match(/\b(?:a\s+)?(\d{1,2})\s*(?:h|heures?|:)\s*(\d{2})?\b/)||t.match(/\b(?:a\s+)?(midi|minuit)\b/);
 if(!m)return {heure:'',rest:t};let hh=m[1]==='midi'?12:m[1]==='minuit'?0:+m[1],mm=+(m[2]||0);if(/\b(apres-midi|du soir)\b/.test(t)&&hh<12)hh+=12;
 return {heure:pad(hh)+':'+pad(mm),rest:t.replace(m[0],' ')}}
const cap=x=>{x=x.replace(/\s+/g,' ').trim();return x.charAt(0).toUpperCase()+x.slice(1)};
const accents=(norm,raw)=>{const W=raw.split(/\s+/);return norm.split(' ').map(w=>{const f=W.find(r=>N(r)===w);return f?f.replace(/[.,;:!?«»"]/g,''):w}).join(' ')};
const owner=()=>{if(S.canW)return true;say('Seul le propriétaire connecté peut faire ça.');return false};
function handle(raw){const t=N(raw);let m;
 if(/\b(desactive|coupe|arrete|eteins)\b.*\b(ok|okay)\s*(duch|douche|dutch)/.test(t)){OKD=false;try{localStorage.setItem('okduch','0')}catch(e){}wakeStop();say('Ok Duch est désactivé. Le bouton micro reste disponible.');setTimeout(voClose,2500);return}
 if(/^(aide|help|que sais-tu faire|qu'est-ce que tu sais faire|commandes?)\b/.test(t)){$('#vo-help').hidden=false;say('Voici ce que tu peux me demander.');return}
 if(/^(ferme|stop|annule|merci|rien)\b/.test(t)){say('D\'accord.');setTimeout(voClose,900);return}
 if(/\b(parametres?|reglages?)\b/.test(t)){openSettings();say('Voici les paramètres.');setTimeout(voClose,1200);return}
 // note
 if(m=t.match(/^(?:ajoute|cree|ecris|nouvelle|prends?)\s+(?:une\s+)?note\s*(?:qui dit|que)?\s*:?\s*(.+)$/)){if(!owner())return;
  put('notes',{id:'n'+Date.now().toString(36),text:cap(raw.replace(/^.*?note\s*(qui dit|que)?\s*:?\s*/i,'')),c:COLORS[0],done:false,pin:false,t:Date.now()});go('notes','Note ajoutée.');return}
 // tâche / annonce
 if(m=t.match(/^(?:ajoute|cree|publie|nouvelle)\s+(?:une\s+)?(tache|annonce|nouvelle)\s*:?\s*(.+)$/)){if(!owner())return;
  put('ann',{id:'a'+Date.now().toString(36),k:m[1]==='tache'?'tache':'nouvelle',title:cap(raw.replace(/^.*?(tâche|tache|annonce|nouvelle)\s*:?\s*/i,'')),body:'',done:false,t:Date.now()});go('',m[1]==='tache'?'Tâche ajoutée.':'Annonce publiée.');return}
 // rendez-vous
 if(/\b(rendez[- ]vous|rdv)\b/.test(t)&&!/^(ouvre|affiche|montre|va)/.test(t)){if(!owner())return;
  let r=t.replace(/^(ajoute|cree|note|mets|programme|nouveau|j'ai)\s*(un\s+)?/,'').replace(/\b(rendez[- ]vous|rdv)\b/,' ');
  const D1=parseDate(r);r=D1.rest;const T=parseTime(r);r=T.rest;
  let tt=r.replace(/\s+/g,' ').trim();for(let i=0;i<4;i++)tt=tt.replace(/^(pour|avec|chez|de|du|au|a|le|la|les|l'|:)\s+/,'').replace(/\s+(pour|le|la|a|au|avec|chez|de)$/,'');
  const title=cap(accents(tt,raw)||'Rendez-vous');
  put('ann',{id:'r'+Date.now().toString(36),k:'rdv',title,date:D1.date,heure:T.heure,lieu:'',body:'',c:COLORS[1],done:false,t:Date.now()});
  S.cd=D1.date;const dd=new Date(D1.date+'T12:00');S.cm=new Date(dd.getFullYear(),dd.getMonth(),1);renderCal();
  go('agenda','Rendez-vous « '+title+' » ajouté '+dd.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})+(T.heure?' à '+T.heure.replace(':','h'):'')+'.');return}
 // courses : vider / enlever / ajouter
 if(/^(vide|efface|remets? a zero)\s+(la\s+)?liste/.test(t)){CS.sel={};CS.got=[];csSave();renderCS();go('courses','Liste de courses vidée.');return}
 if(m=t.match(/^(?:enleve|retire|supprime|barre|plus besoin de?)\s+(.+?)(?:\s+(?:de|dans)\s+la\s+liste.*)?$/)){const rm=[];
  for(const p of m[1].split(/,|\set\s/)){const k=slug(N(p).replace(/^(du|de la|de l'|des|le|la|les|l'|d')\s*/,'')).replace(/s$/,'');const it=csItems().find(x=>CS.sel[x.id]&&slug(x.n).replace(/s$/,'').startsWith(k));if(it){delete CS.sel[it.id];rm.push(it.n.toLowerCase())}}
  csSave();renderCS();go('courses',rm.length?'J\'ai retiré '+rm.join(', ')+'.':'Je n\'ai pas trouvé cet article dans la liste.');return}
 if(m=t.match(/^(?:ajoute|rajoute|mets|met|achete|acheter|il (?:me |nous )?faut(?: acheter)?|il manque|prends?)\s+(.+?)(?:\s+(?:a|dans|sur|aux|sur la)\s+(?:la\s+|ma\s+)?(?:liste(?: de courses?)?|courses)\s*)?$/)){
  const d=csAddVoice(m[1]);go('courses',d.length?'J\'ai ajouté '+d.join(', ')+' à la liste de courses.':'Je n\'ai pas compris l\'article.');return}
 // météo parlée
 if(/\b(meteo|temps|pleuvoir|pleut|temperature|fait-il|fera-t-il|froid|chaud|neige)\b/.test(t)&&!/^(ouvre|affiche|montre|va)/.test(t)&&D.wx?.jours){
  const P=parseDate(t),i=Math.max(0,D.wx.jours.findIndex(j=>j.date===P.date)),j=D.wx.jours[i]||D.wx.jours[0];S.day=i;renderWx();location.hash='meteo';
  const quand=i===0?'Aujourd\'hui':i===1?'Demain':new Date(j.date+'T12:00').toLocaleDateString('fr-FR',{weekday:'long'});
  say(quand+' à '+D.wx.ville+' : '+j.cond.toLowerCase()+', de '+j.min+' à '+j.max+' degrés, '+j.pluie+' pour cent de risque de pluie.'+(i===0?' Il fait actuellement '+D.wx.actuelle+' degrés.':''));return}
 // photos
 if(/\b(photo|image)\s+suivante\b|^suivante$/.test(t)){slide(false);location.hash='';say('Photo suivante.');setTimeout(voClose,1200);return}
 if(/\b(photo|image)\s+precedente\b|^precedente$/.test(t)){S.pi=(S.pi-2+ph().length*2)%Math.max(1,ph().length);slide(false);location.hash='';say('Photo précédente.');setTimeout(voClose,1200);return}
 // ouvrir une recette
 if(/\brecette\b/.test(t)){const w=t.replace(/^.*?recettes?\s*(de la|du|des|de l'|de|d')?\s*/,'').trim();
  if(w){const r=RC.map(r=>({r,s:N(r.titre).split(' ').filter(x=>x.length>2&&w.includes(x.replace(/s$/,''))).length})).sort((a,b)=>b.s-a.s)[0];
   if(r&&r.s){go('recette-'+r.r.id,'J\'ouvre '+r.r.titre+'.');return}}
  go('recettes','Voici les recettes.');return}
 // navigation
 const NAV=[[/\b(accueil|maison|debut|ecran principal)\b/,'','Accueil.'],[/\b(liste de courses?|courses?|caddie)\b/,'courses','Voici la liste de courses.'],[/\b(meteo|temps)\b/,'meteo','Voici la météo.'],[/\b(agenda|calendrier|rendez-vous|planning)\b/,'agenda','Voici l\'agenda.'],
  [/\bnotes?\b/,'notes','Voici les notes.'],[/\b(photos?|galerie|images?)\b/,'photos','Voici les photos.'],[/\butiles?\b/,'utile','Voici la page Utile.']];
 for(const [re,h,msg] of NAV)if(re.test(t)){go(h,msg);return}
 $('#vo-help').hidden=false;say('Je n\'ai pas compris. Voici des exemples de commandes.')}
window.tableauVoix=handle;

/* ---------- divers ---------- */
let tt;function undo(msg,fn){$('#toast-t').textContent=msg;$('#toast').classList.add('on');clearTimeout(tt);$('#toast-b').onclick=()=>{fn();$('#toast').classList.remove('on')};tt=setTimeout(()=>$('#toast').classList.remove('on'),6000)}
function rerender(){renderNotes();renderAnn();renderPhotos();renderCal()}
function lockUI(){for(const s of ['#n-compose','#a-compose','#p-up','#r-compose'])$(s).hidden=!S.canW}
/* ---------- pages qu'on fait glisser (comme un téléphone) ---------- */
const PG=$('#pager');
const pagesEl=()=>[...PG.children];
let curPage='',firstGo=true;
const TITLES={home:'Accueil',meteo:'Météo',recettes:'Recettes',courses:'Courses',agenda:'Agenda',notes:'Notes',photos:'Photos'};
function renderDots(){$('#dots').innerHTML=pagesEl().map(p=>`<button type="button" data-dot="${p.dataset.page}" aria-label="${esc(TITLES[p.dataset.page]||p.dataset.page)}" class="${p.dataset.page===curPage?'on':''}"></button>`).join('')}
$('#dots').addEventListener('click',e=>{const b=e.target.closest('[data-dot]');if(b)goPage(b.dataset.dot)});
function setActive(k){if(k===curPage)return;curPage=k;const hb=$('#homebtn');if(hb)hb.hidden=k==='home';if(k==='home'&&typeof wxDraw==='function'&&!wxRaf&&wxKind)wxRaf=requestAnimationFrame(wxDraw);renderDots();if(k==='courses')renderCS();if(k==='agenda')renderCal();
 const el=document.getElementById('v-'+k);if(!firstGo&&typeof fxView==='function')fxView(el);
 history.replaceState(null,'',k==='home'?location.pathname+location.search:'#'+k)}
let navLock=null,navUntil=0;
let snapT;
function goPage(k,instant){const el=document.getElementById('v-'+k);if(!el)return;navLock=k;navUntil=Date.now()+1600;
 const far=Math.abs(el.offsetLeft-PG.scrollLeft)>PG.clientWidth*1.5,smooth=!(instant||firstGo||RMX||far);
 if(far&&!instant&&!firstGo)fx(el.querySelector('.pg'),{opacity:[0,1],scale:[.96,1]},{stiffness:260,damping:26});
 if(smooth){PG.style.scrollSnapType='none';clearTimeout(snapT);const done=()=>{clearTimeout(snapT);PG.style.scrollSnapType='';PG.removeEventListener('scrollend',done)};PG.addEventListener('scrollend',done);snapT=setTimeout(done,1100)}
 PG.scrollTo({left:el.offsetLeft,behavior:smooth?'smooth':'instant'});setActive(k);firstGo=false}
let pgT;PG.addEventListener('scroll',()=>{clearTimeout(pgT);pgT=setTimeout(()=>{const i=Math.round(PG.scrollLeft/PG.clientWidth),p=pagesEl()[i];if(!p)return;
 if(navLock&&Date.now()<navUntil){if(p.dataset.page===navLock)navLock=null;return}navLock=null;setActive(p.dataset.page)},90)},{passive:true});
addEventListener('resize',()=>{const el=document.getElementById('v-'+curPage);if(el)PG.scrollTo({left:el.offsetLeft,behavior:'instant'})});
$('#sheet-x').addEventListener('click',e=>{e.preventDefault();closeSheet();history.replaceState(null,'','#recettes')});
function openSheet(id){const sh=$('#v-recette');renderOne(id);if(sh.hidden){sh.hidden=false;sh.scrollTop=0;if(typeof fx==='function')fx(sh,{y:['100%','0%']},{stiffness:260,damping:30})}}
function closeSheet(){const sh=$('#v-recette');if(!sh.hidden)sh.hidden=true}
function route(){const v=location.hash.slice(1)||'home';
 if(/^recette-[a-z0-9-]+$/.test(v)){if(curPage!=='recettes')goPage('recettes',true);openSheet(v.slice(8));return}
 closeSheet();let k={utile:'recettes',video:'home'}[v]||v;if(!document.getElementById('v-'+k)?.classList.contains('page'))k='home';goPage(k)}
function syncPages(){const order=['home',...[...document.querySelectorAll('.launcher>.app-ic')].map(a=>a.dataset.v)];for(const k of order){const p=document.getElementById('v-'+k);if(p)PG.appendChild(p)}renderDots();
 const el=document.getElementById('v-'+curPage);if(el)PG.scrollTo({left:el.offsetLeft,behavior:'instant'})}
document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select')||!$('#viewer').hidden&&$('#viewer').classList.contains('on')||!$('#v-recette').hidden)return;
 const P=pagesEl().map(p=>p.dataset.page),i=P.indexOf(curPage);if(e.key==='ArrowRight'&&i<P.length-1)goPage(P[i+1]);if(e.key==='ArrowLeft'&&i>0)goPage(P[i-1])});
addEventListener('hashchange',route);syncPages();route();
/* retour à l'accueil : bouton (ordinateur), touche Échap, bouton « précédent » de la souris */
$('#homebtn').addEventListener('click',e=>{e.preventDefault();location.hash=''});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&curPage!=='home'&&$('#v-recette').hidden&&$('#settings').hidden&&$('#secret').hidden&&!$('#viewer').classList.contains('on')&&!e.target.closest('input,textarea,select'))location.hash=''});
document.addEventListener('mouseup',e=>{if(e.button===3&&curPage!=='home'){e.preventDefault();location.hash=''}});

/* ---------- tableau de tâches (Kanban + priorités) dans la page cachée ---------- */
const KCOLS=[['todo','À faire','#5ecbff'],['doing','En cours','#8b7bff'],['wait','En attente','#ffb020'],['done','Terminé','#30d158']];
const KPRIO={urgent:['Urgent','#ff3b5c','<path d="M12 2c1 3.5-1.5 5-1.5 7.5A2.5 2.5 0 0 0 13 12c0-1.5 1-2.5 1-2.5 2.2 2 3.5 4 3.5 6.5a5.5 5.5 0 0 1-11 0C6.5 10.5 11 8 12 2z"/>'],
 prevoir:['À prévoir','#ff9f0a','<path d="M7 2v3M17 2v3M3.5 9h17M5 4.5h14A1.5 1.5 0 0 1 20.5 6v13a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="14.5" r="2"/>'],
 attendre:['Peut attendre','#5ac8fa','<path d="M7 3h10M7 21h10M8 3c0 4 8 5 8 9s-8 5-8 9M16 3c0 4-8 5-8 9s8 5 8 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>']};
const kIco=p=>`<svg viewBox="0 0 24 24" class="kico" fill="currentColor" aria-hidden="true">${KPRIO[p][2]}</svg>`;
let KT=[],kFilter='all',kEdit=null,kPrio='prevoir',kCol='todo',kSaveT=null,kLocalT=0,kDrag=null;
const kToday=()=>iso(new Date());
function kSave(){kLocalT=Date.now();renderKB();if(!FB_OK)return;clearTimeout(kSaveT);kSaveT=setTimeout(()=>setDoc(doc(db,'masques','taches'),{items:KT,t:kLocalT}).then(()=>status('Publié')).catch(e=>{status('Échec : '+(e.code||'erreur'));if(/permission/.test(e.code||''))toastTop('Enregistrement refusé : les règles Firebase doivent être mises à jour')}),600)}
if(FB_OK)onSnapshot(doc(db,'masques','taches'),sn=>{if(!sn.exists())return;const d=sn.data();if((kDrag&&kDrag.g)||(d.t||0)<kLocalT)return;KT=Array.isArray(d.items)?d.items:[];renderKB()},()=>{});
function kDue(t){if(!t.due||t.status==='done')return '';const td=kToday(),cls=t.due<td?'late':t.due===td?'today':'';const d=new Date(t.due+'T12:00');
 const txt=t.due<td?'En retard · '+d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):t.due===td?'Aujourd\'hui':d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});return `<span class="kchip due ${cls}">${esc(txt)}</span>`}
function kCard(t){const P=KPRIO[t.prio]||KPRIO.prevoir;return `<article class="kcard p-${esc(t.prio)}${t.status==='done'?' done':''}" data-kid="${esc(t.id)}" style="--pc:${P[1]}">
 <div class="kc-top"><span class="kbadge">${kIco(t.prio in KPRIO?t.prio:'prevoir')}${esc(P[0])}</span>${kDue(t)}</div>
 <h3>${esc(t.title)}</h3>${t.notes?`<p>${esc(t.notes)}</p>`:''}
 <div class="kc-foot">${t.client?`<span class="kchip">${esc(t.client)}</span>`:''}${t.est?`<span class="kchip">⏱ ${esc(t.est)}</span>`:''}
 ${true?`<span class="kmove"><button type="button" data-kmv="-1" aria-label="Colonne précédente">‹</button><button type="button" data-kmv="1" aria-label="Colonne suivante">›</button></span>`:''}</div></article>`}
function renderKB(){const q=slug($('#kb-q').value||''),vis=t=>(kFilter==='all'||t.prio===kFilter)&&(!q||slug(t.title+' '+(t.client||'')+' '+(t.notes||'')).includes(q));
 const td=kToday(),open=KT.filter(t=>t.status!=='done');
 $('#kb-stats').innerHTML=[['À faire',KT.filter(t=>t.status==='todo').length,'#5ecbff'],['En cours',KT.filter(t=>t.status==='doing').length,'#8b7bff'],['Urgentes',open.filter(t=>t.prio==='urgent').length,'#ff3b5c'],['En retard',open.filter(t=>t.due&&t.due<td).length,'#ff6b3d'],['Faites (7 j)',KT.filter(t=>t.status==='done'&&t.doneAt&&Date.now()-t.doneAt<7*864e5).length,'#30d158']]
  .map(([k,v,c])=>`<div class="kstat" style="--sc:${c}"><b>${v}</b><span>${esc(k)}</span></div>`).join('');
 $('#kb-sub').textContent=open.length?open.length+' tâche'+(open.length>1?'s':'')+' en cours de route':'Rien en attente, bravo !';
 const order=(a,b)=>({urgent:0,prevoir:1,attendre:2}[a.prio]??1)-({urgent:0,prevoir:1,attendre:2}[b.prio]??1)||(a.order??0)-(b.order??0);
 $('#kb-board').innerHTML=KCOLS.map(([k,n,c])=>{const L=KT.filter(t=>t.status===k&&vis(t)).sort(k==='done'?(a,b)=>(b.doneAt||0)-(a.doneAt||0):order);
  return `<section class="kcol" data-kcol="${k}" style="--cc:${c}"><header><i></i><b>${esc(n)}</b><span class="kcount">${L.length}</span>${k==='doing'&&L.length>3?'<span class="kwip">Beaucoup en cours</span>':''}</header>
  <div class="kcards">${L.map(kCard).join('')||`<div class="kempty">${k==='done'?'Les tâches terminées arrivent ici':'Glisse une tâche ici'}</div>`}</div>
  ${k!=='done'?`<button type="button" class="kadd" data-kadd="${k}">+ Ajouter</button>`:''}</section>`}).join('');
 $('#kb-hint').textContent='Astuce : maintiens une carte puis fais-la glisser vers une autre colonne. Touche une carte pour la modifier.'}
/* formulaire */
$('#kb-prio').innerHTML=Object.entries(KPRIO).map(([k,[n,c]])=>`<button type="button" data-kp="${k}" style="--pc:${c}">${kIco(k)}${esc(n)}</button>`).join('');
$('#kb-col').innerHTML=KCOLS.map(([k,n])=>`<button type="button" data-kc="${k}">${esc(n)}</button>`).join('');
function kSel(){$('#kb-prio').querySelectorAll('[data-kp]').forEach(b=>b.classList.toggle('on',b.dataset.kp===kPrio));$('#kb-col').querySelectorAll('[data-kc]').forEach(b=>b.classList.toggle('on',b.dataset.kc===kCol))}
$('#kb-prio').addEventListener('click',e=>{const b=e.target.closest('[data-kp]');if(b){kPrio=b.dataset.kp;kSel()}});
$('#kb-col').addEventListener('click',e=>{const b=e.target.closest('[data-kc]');if(b){kCol=b.dataset.kc;kSel()}});
function kNeedLogin(){toastTop('Connecte-toi avec ton compte pour modifier tes tâches');openSettings()}
function kOpen(t,col){kEdit=t?t.id:null;kPrio=t?.prio||'prevoir';kCol=t?.status||col||'todo';
 $('#kb-mtitle').textContent=t?'Modifier la tâche':'Nouvelle tâche';$('#kb-save').textContent=t?'Enregistrer':'Ajouter';$('#kb-del').hidden=!t;
 $('#kb-t').value=t?.title||'';$('#kb-due').value=t?.due||'';$('#kb-est').value=t?.est||'';$('#kb-client').value=t?.client||'';$('#kb-notes').value=t?.notes||'';kSel();
 $('#kb-modal').hidden=false;fx($('#kb-form'),{opacity:[0,1],y:[30,0],scale:[.96,1]},{stiffness:340,damping:26});setTimeout(()=>$('#kb-t').focus(),120)}
const kClose=()=>{$('#kb-modal').hidden=true};
$('#kb-cancel').addEventListener('click',kClose);$('#kb-modal').addEventListener('click',e=>{if(e.target.id==='kb-modal')kClose()});
$('#kb-new').addEventListener('click',()=>kOpen(null,'todo'));
$('#kb-form').addEventListener('submit',e=>{e.preventDefault();const title=$('#kb-t').value.trim();if(!title)return;
 const base=kEdit?KT.find(x=>x.id===kEdit):null,was=base?.status;
 const t={...(base||{id:'k'+Date.now().toString(36),created:Date.now(),order:Date.now()}),title,prio:kPrio,status:kCol,due:$('#kb-due').value,est:$('#kb-est').value.trim(),client:$('#kb-client').value.trim(),notes:$('#kb-notes').value.trim()};
 if(t.status==='done'&&was!=='done')t.doneAt=Date.now();KT=base?KT.map(x=>x.id===t.id?t:x):[...KT,t];kClose();kSave();
 const el=document.querySelector(`[data-kid="${CSS.escape(t.id)}"]`);fx(el,{opacity:[0,1],scale:[.85,1]},{stiffness:400,damping:18})});
$('#kb-del').addEventListener('click',()=>{const o=KT.find(x=>x.id===kEdit);if(!o)return;KT=KT.filter(x=>x.id!==kEdit);kClose();kSave();undo('Tâche supprimée',()=>{KT=[...KT,o];kSave()})});
$('#kb-q').addEventListener('input',renderKB);
$('#kb-filter').addEventListener('click',e=>{const b=e.target.closest('[data-kf]');if(!b)return;kFilter=b.dataset.kf;$('#kb-filter').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));renderKB()});
function kMove(id,status,beforeId){const t=KT.find(x=>x.id===id);if(!t)return;const was=t.status;t.status=status;if(status==='done'&&was!=='done')t.doneAt=Date.now();if(status!=='done')delete t.doneAt;
 const sib=KT.filter(x=>x.status===status&&x.id!==id).sort((a,b)=>(a.order??0)-(b.order??0)),bi=beforeId?sib.findIndex(x=>x.id===beforeId):-1;
 t.order=bi<0?(sib.length?(sib[sib.length-1].order??0)+1000:Date.now()):((bi>0?sib[bi-1].order??0:(sib[0].order??0)-2000)+(sib[bi].order??0))/2;kSave();return was}
$('#kb-board').addEventListener('click',e=>{if(Date.now()-(kDrag?.end||0)<300)return;const add=e.target.closest('[data-kadd]');if(add)return kOpen(null,add.dataset.kadd);
 const mv=e.target.closest('[data-kmv]'),card=e.target.closest('[data-kid]');if(!card)return;const t=KT.find(x=>x.id===card.dataset.kid);if(!t)return;
 if(mv){e.stopPropagation();const i=KCOLS.findIndex(c=>c[0]===t.status),j=Math.max(0,Math.min(KCOLS.length-1,i+ +mv.dataset.kmv));if(j===i)return;const r=mv.getBoundingClientRect();kMove(t.id,KCOLS[j][0]);if(KCOLS[j][0]==='done')confetti(r.left,r.top);return}
 kOpen(t)});
/* glisser-déposer (maintien court sur tactile) */
{let pre=null;const B=$('#kb-board');
 B.addEventListener('pointerdown',e=>{if(e.button>0||e.target.closest('button'))return;const c=e.target.closest('.kcard');if(!c)return;
  pre={c,x:e.clientX,y:e.clientY,id:e.pointerId,t:setTimeout(()=>{if(pre)kStart(pre,e.clientX,e.clientY)},e.pointerType==='mouse'?9999:260)}});
 function kStart(p,x,y){const r=p.c.getBoundingClientRect(),g=p.c.cloneNode(true);g.classList.add('kghost');g.style.width=r.width+'px';document.body.appendChild(g);
  p.c.classList.add('kph');kDrag={c:p.c,g,ox:x-r.left,oy:y-r.top,id:p.c.dataset.kid};pre=null;if(navigator.vibrate)navigator.vibrate(12);kFollow(x,y)}
 function kFollow(x,y){const d=kDrag;d.g.style.transform=`translate(${x-d.ox}px,${y-d.oy}px) rotate(2.5deg)`;
  document.querySelectorAll('.kcol.over').forEach(c=>c.classList.remove('over'));d.g.style.display='none';const el=document.elementFromPoint(x,y);d.g.style.display='';
  const col=el&&el.closest('.kcol');if(col)col.classList.add('over');d.col=col;d.before=el&&el.closest('.kcard:not(.kph)')?.dataset.kid||null;
  const sc=el&&el.closest('.kb-board');if(sc){const r=sc.getBoundingClientRect();if(x>r.right-50)sc.scrollLeft+=14;if(x<r.left+50)sc.scrollLeft-=14}}
 document.addEventListener('pointermove',e=>{if(pre){const dd=Math.hypot(e.clientX-pre.x,e.clientY-pre.y);if(e.pointerType==='mouse'&&dd>6){clearTimeout(pre.t);kStart(pre,e.clientX,e.clientY)}else if(dd>10){clearTimeout(pre.t);pre=null}}
  if(kDrag&&kDrag.g){e.preventDefault();kFollow(e.clientX,e.clientY)}},{passive:false});
 B.addEventListener('touchmove',e=>{if(kDrag&&kDrag.g)e.preventDefault()},{passive:false});
 const end=e=>{if(pre){clearTimeout(pre.t);pre=null}if(!kDrag||!kDrag.g)return;const d=kDrag;d.g.remove();d.c.classList.remove('kph');document.querySelectorAll('.kcol.over').forEach(c=>c.classList.remove('over'));
  kDrag={end:Date.now()};if(d.col){const st=d.col.dataset.kcol,was=kMove(d.id,st,d.before);if(st==='done'&&was!=='done'&&e)confetti(e.clientX,e.clientY)}};
 document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end)}

/* ---------- page cachée : 2 touches sur le cadran de l'horloge ---------- */
{const SE=$('#secret');let taps=[];
 function openSecret(){if(!SE.hidden)return;SE.hidden=false;renderKB();SE.scrollTop=0;if(navigator.vibrate)navigator.vibrate([15,40,15]);fx(SE,{opacity:[0,1],scale:[1.06,1]},{stiffness:220,damping:24})}
 function closeSecret(){SE.hidden=true}
 $('#dial').addEventListener('pointerup',()=>{const n=Date.now();taps=taps.filter(t=>n-t<1500);taps.push(n);if(taps.length>=2){taps=[];openSecret()}});
 $('#secret-x').addEventListener('click',closeSecret);
 document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(!$('#kb-modal').hidden){$('#kb-modal').hidden=true;return}if(!SE.hidden)closeSecret()});
 {let y0=null;SE.addEventListener('touchstart',e=>{y0=SE.scrollTop<=2?e.touches[0].clientY:null},{passive:true});
  SE.addEventListener('touchend',e=>{if(y0!=null&&!(kDrag&&kDrag.g)&&$('#kb-modal').hidden&&!e.target.closest('.kcard')&&e.changedTouches[0].clientY-y0>120)closeSecret();y0=null},{passive:true})}}
/* ---------- cadran à aiguilles (balayage fluide des secondes) ---------- */
{const H=$('#dl-h'),M=$('#dl-m'),Sx=$('#dl-s'),R=$('#dl-sec'),SN=$('#dl-secnum');
 const loc=()=>(Date.now()-new Date().getTimezoneOffset()*60000)/1000;
 let ph=-1;function hands(){const t=loc(),hr=(t/120)%720,mn=(t/10)%8640;const wrap=hr<ph;ph=hr;if(wrap){H.style.transition=M.style.transition='none'}H.style.rotate=hr.toFixed(2)+'deg';M.style.rotate=mn.toFixed(2)+'deg';if(wrap)requestAnimationFrame(()=>{H.style.transition=M.style.transition=''})}
 function sync(){const n=new Date(),s=n.getSeconds()+n.getMilliseconds()/1000;hands();
  for(const el of [Sx,R]){el.style.animationDelay=(-s)+'s';el.classList.remove('run');void el.getBoundingClientRect();el.classList.add('run')}}
 function tickSec(){SN.textContent=String(new Date().getSeconds()).padStart(2,'0');hands()}
 sync();setInterval(tickSec,1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});setInterval(sync,5*60*1000)}
/* ---------- glisser vers le bas en haut d'une page = retour à l'accueil ---------- */
{const PH=$('#pullhome');let y0=0,x0=0,pg=null,tr=false,dy=0;
 const reset=()=>{tr=false;pg=null;PH.style.transition='translate .3s,opacity .3s';PH.style.translate='-50% -140%';PH.style.opacity='0';PH.classList.remove('ready')};
 PG.addEventListener('touchstart',e=>{if(curPage==='home'||editing||!$('#v-recette').hidden||e.touches.length>1)return;const p=document.getElementById('v-'+curPage);if(!p||p.scrollTop>2)return;
  pg=p;y0=e.touches[0].clientY;x0=e.touches[0].clientX;tr=true;dy=0},{passive:true});
 PG.addEventListener('touchmove',e=>{if(!tr)return;const t=e.touches[0];dy=t.clientY-y0;const dx=Math.abs(t.clientX-x0);
  if(dy<=0||dx>dy*.8||pg.scrollTop>2){if(dx>24&&dx>dy)reset();return}
  e.preventDefault();const k=Math.min(1,dy/110);PH.style.transition='none';PH.style.translate=`-50% ${-140+k*170}%`;PH.style.opacity=String(Math.min(1,k*1.4));PH.classList.toggle('ready',dy>110)},{passive:false});
 PG.addEventListener('touchend',()=>{if(!tr)return;const go=dy>110;reset();if(go){if(navigator.vibrate)navigator.vibrate(12);location.hash=''}},{passive:true});
 PG.addEventListener('touchcancel',reset,{passive:true})}

/* ---------- paramètres cachés (appui long sur l'heure) ---------- */
let setAt=0;function openSettings(){const st=$('#settings');if(!st.hidden)return;st.hidden=false;setAt=Date.now();$('#set-ver').textContent='Le Tableau · version '+'46'+' · '+location.host;status(S.canW?'':'');
 fx($('.set-card'),{opacity:[0,1],scale:[.92,1],y:[20,0]},{stiffness:340,damping:24})}
function closeSettings(){$('#settings').hidden=true}
$('#set-x').addEventListener('click',closeSettings);
$('#settings').addEventListener('click',e=>{if(e.target.id==='settings'&&Date.now()-setAt>600)closeSettings()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#settings').hidden)closeSettings()});
$('#set-org').addEventListener('click',()=>{closeSettings();goPage('home');setTimeout(()=>setEdit(true),350)});
$('#gear').addEventListener('click',openSettings);
/* plein écran : API sur tablette/ordinateur, écran d'accueil sur iPhone */
{const standalone=matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches||navigator.standalone;
 if(standalone){$('#fs-help').textContent='Déjà en plein écran (ouvert depuis l\'icône).';$('#fs').hidden=true}
 else if(!document.fullscreenEnabled&&!document.webkitFullscreenEnabled){$('#fs').textContent='Comment faire';
  $('#fs-help').textContent='Sur iPhone : dans Safari, touche Partager (carré avec flèche), puis « Sur l\'écran d\'accueil ». Ouvre ensuite Le Tableau depuis cette icône : il s\'affiche en plein écran.'}}
/* points : balayer pour changer de page */
{const DT=$('#dots'),LB=$('#dotlabel');let on=false;
 function pick(x){const bs=[...DT.querySelectorAll('[data-dot]')];let best=null,bd=1e9;for(const b of bs){const r=b.getBoundingClientRect(),d=Math.abs(x-(r.left+r.width/2));if(d<bd){bd=d;best=b}}return best}
 function show(k){LB.textContent=TITLES[k]||k;LB.hidden=false}
 DT.addEventListener('pointerdown',e=>{on=true;DT.classList.add('scrub');try{DT.setPointerCapture(e.pointerId)}catch(_){}const b=pick(e.clientX);if(b){show(b.dataset.dot);if(b.dataset.dot!==curPage)goPage(b.dataset.dot,true)}e.preventDefault()});
 DT.addEventListener('pointermove',e=>{if(!on)return;const b=pick(e.clientX);if(b&&b.dataset.dot!==curPage){goPage(b.dataset.dot,true);show(b.dataset.dot);if(navigator.vibrate)navigator.vibrate(8)}});
 const end=()=>{on=false;DT.classList.remove('scrub');setTimeout(()=>{if(!on)LB.hidden=true},500)};DT.addEventListener('pointerup',end);DT.addEventListener('pointercancel',end);
 DT.addEventListener('click',e=>e.stopImmediatePropagation(),true)}


let lock=null;
async function wake(){try{lock=await navigator.wakeLock.request('screen');$('#wake').classList.add('on');lock.addEventListener('release',()=>{lock=null;$('#wake').classList.remove('on')})}catch(e){$('#wake').textContent='Réglages › Affichage › Mise en veille';setTimeout(()=>$('#wake').textContent='Écran toujours allumé',6000)}}
$('#wake').addEventListener('click',async()=>{if(lock){try{await lock.release()}catch(e){}lock=null;$('#wake').classList.remove('on');try{localStorage.removeItem('wake')}catch(e){}return}await wake();try{localStorage.setItem('wake','1')}catch(e){}});
document.addEventListener('visibilitychange',()=>{let w=null;try{w=localStorage.getItem('wake')}catch(e){}if(!document.hidden&&w&&!lock)wake()});
$('#fs').addEventListener('click',async()=>{try{document.fullscreenElement?await document.exitFullscreen():await document.documentElement.requestFullscreen()}catch(e){$('#fs').textContent='Plein écran indisponible'}});

lockUI();rerender();renderWx();

/* ---------- mise à jour automatique : recharge la page quand une nouvelle version est en ligne ---------- */
{const APPV='46';
 async function chk(){try{const r=await fetch('version.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;const j=await r.json();
  if(j.v&&j.v!==APPV&&!editing&&$('#vo').hidden&&!document.querySelector('textarea:focus,input:focus')){location.replace(location.pathname+'?v='+encodeURIComponent(j.v)+location.hash)}}catch(e){}}
 setInterval(chk,3*60*1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)chk()});setTimeout(chk,4000)}
