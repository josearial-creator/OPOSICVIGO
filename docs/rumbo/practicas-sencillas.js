/* Cuatro practicas breves de Rumbo: cada evento se guarda con ID propio.
 * Se conserva intacto el historial de sesiones y notas anterior. */
(() => {
'use strict';
const root=document.getElementById('mi-evolucion');
if(!root)return;
const prefix='rumbo-practicas-v1/event/';
const envelopePrefix='rumbo-practicas-v1/cipher/';
const syncPrefix='rumbo-practicas-v1/synced/';
const focusKey='rumbo-practicas-v1/foco-activo';
const endpoint='https://rumbo-entrenador.jose-arial.workers.dev/training';
const types={pause10:'Pausa de 10 segundos',steps5:'Detener, escuchar, pensar, procesar y actuar',focus25:'Una tarea · 25 minutos',return:'Detectar y regresar'};
const enc=new TextEncoder(),dec=new TextDecoder();
const $=id=>document.getElementById(id);
const idOk=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
let pauseEnd=0,pauseTimer=null,focusTimer=null,focus=null,password='',syncing=false,localAlert='',events=[];
const style=document.createElement('style');
style.textContent=[
 'body.rumbo-separated[data-rumbo-route="mi-evolucion"] #mi-evolucion > .panel-head{display:none!important}',
 'body.rumbo-separated[data-rumbo-route="mi-evolucion"] #mi-evolucion .ev-body > :not(#ev-training){display:none!important}',
 'body.rumbo-separated[data-rumbo-route="mi-evolucion"] #ev-training{display:block!important}',
 '#ev-training{margin-top:0!important;border-top:0!important;padding-top:0!important}',
 '#ps-app{color:#213b50;padding:4px 0 25px}',
 '#ps-app .ps-heading{font-size:1.45rem;margin:0 0 6px;font-weight:800}',
 '#ps-app .ps-intro{color:#52697b;line-height:1.55;margin:0 0 20px}',
 '#ps-app .ps-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}',
 '#ps-app .ps-card{border:1px solid #dbe6ed;border-radius:17px;background:#fff;padding:20px;min-width:0;box-shadow:0 3px 15px #142c4210}',
 '#ps-app .ps-card h4{font-size:1.1rem;line-height:1.4;margin:0 0 8px}',
 '#ps-app .ps-card p{line-height:1.5;margin:6px 0 12px;color:#52697b}',
 '#ps-app .ps-steps{font-size:.88rem;font-weight:650;color:#18675e!important}',
 '#ps-app .ps-ctrl{display:flex;align-items:center;gap:13px;flex-wrap:wrap;margin-top:12px}',
 '#ps-app .ps-plus{width:70px;height:70px;min-height:70px;border:0;border-radius:50%;background:#126b64;color:white;font-size:48px;line-height:1;cursor:pointer;flex:none}',
 '#ps-app button:disabled{opacity:.57;cursor:default}',
 '#ps-app .ps-counter strong{display:block;font-size:1.5rem;font-variant-numeric:tabular-nums}',
 '#ps-app .ps-counter small{display:block;color:#647687}',
 '#ps-app .ps-clock{font-size:2rem;font-weight:800;font-variant-numeric:tabular-nums;min-height:48px}',
 '#ps-app input[type=text],#ps-app input[type=password]{width:100%;min-height:44px;border:1px solid #b7c9d5;border-radius:10px;padding:11px;box-sizing:border-box;font:inherit}',
 '#ps-app .ps-buttons{display:flex;flex-wrap:wrap;gap:9px;margin-top:12px}',
 '#ps-app .ps-buttons button{min-height:44px}',
 '#ps-app .ps-message{font-size:.9rem;line-height:1.45;color:#355c68;margin-top:12px;min-height:23px}',
 '#ps-app .ps-log{margin:25px 0 0}',
 '#ps-app .ps-log ul{list-style:none;padding:0;margin:8px 0}',
 '#ps-app .ps-log li{padding:10px 0;border-bottom:1px solid #e4ebf0;display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}',
 '#ps-app .ps-log time{color:#617687;white-space:nowrap;font-size:.87rem}',
 '#ps-app details{margin-top:19px;border:1px solid #dce6ec;border-radius:12px;padding:15px}',
 '#ps-app details summary{cursor:pointer;font-weight:700}',
 '#ps-app .ps-caption{font-size:.84rem;color:#627382;line-height:1.5}',
 '#ps-app #ps-sync-status{min-height:1.2em}',
 '@media(max-width:700px){#ps-app .ps-grid{grid-template-columns:1fr}#ps-app .ps-card{padding:16px}#ps-app .ps-plus{width:68px;height:68px}}'
].join('\n');
document.head.appendChild(style);
function validEvent(v){
 if(!v||v.version!==1||!idOk(v.id)||!Object.hasOwn(types,v.kind)||typeof v.at!=='string'||!Number.isFinite(Date.parse(v.at)))return false;
 if(v.kind==='pause10'&&v.seconds!==10)return false;
 if(v.kind==='focus25'&&(v.seconds!==1500||typeof v.task!=='string'||v.task.length>120))return false;
 if(v.kind==='return'&&(typeof v.note!=='string'||v.note.length>300))return false;
 return true;
}
function loadEvents(){
 const found=[],seen=new Set();localAlert='';
 try{
  for(let i=0;i<localStorage.length;i++){
   const key=localStorage.key(i);
   if(!key?.startsWith(prefix))continue;
   const id=key.slice(prefix.length);
   let e;
   try{e=JSON.parse(localStorage.getItem(key));}catch{localAlert='Hay un registro antiguo ilegible: no se ha borrado.';continue;}
   if(!validEvent(e)||e.id!==id||seen.has(id)){localAlert='Existe un registro incompatible: se conserva sin modificar.';continue;}
   found.push(e);seen.add(id);
  }
 }catch{localAlert='El navegador no permite leer los registros. Comprueba sus permisos.';}
 return found.sort((a,b)=>b.at.localeCompare(a.at));
}
function saveEvent(event){
 if(!validEvent(event))return false;
 try{
  const key=prefix+event.id;
  if(localStorage.getItem(key)!==null)return false;
  const raw=JSON.stringify(event);
  localStorage.setItem(key,raw);
  return localStorage.getItem(key)===raw;
 }catch{return false;}
}
function atText(iso){return new Date(iso).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'});}
function sameDay(iso){return new Date(iso).toLocaleDateString('es-ES')===new Date().toLocaleDateString('es-ES');}
function message(id,text){const el=$(id);if(el)el.textContent=text;}
function refresh(){
 events=loadEvents();
 for(const [kind,name] of [['pause10','pause'],['steps5','steps'],['focus25','focus'],['return','return']]){
  const subset=events.filter(e=>e.kind===kind);
  if($('ps-'+name+'-today'))$('ps-'+name+'-today').textContent=String(subset.filter(e=>sameDay(e.at)).length);
  if($('ps-'+name+'-all'))$('ps-'+name+'-all').textContent=String(subset.length);
 }
 const list=$('ps-events');
 if(list){
  list.replaceChildren();
  if(!events.length){const li=document.createElement('li');li.textContent='Todavía no hay registros. Pulsa + al practicar.';list.append(li);}
  for(const e of events.slice(0,30)){
   const li=document.createElement('li'),main=document.createElement('span'),date=document.createElement('time');
   main.textContent=types[e.kind]+(e.kind==='return'&&e.note?' · '+e.note:e.kind==='focus25'&&e.task?' · '+e.task:'');
   date.dateTime=e.at;date.textContent=atText(e.at);
   li.append(main,date);list.append(li);
  }
 }
 if(localAlert)message('ps-storage',localAlert);
}
function add(kind,props={}){
 const e={version:1,id:crypto.randomUUID(),at:new Date().toISOString(),kind,...props};
 if(!saveEvent(e)){message('ps-storage','No se pudo guardar. No se ha contado el intento; comprueba el almacenamiento del navegador.');return false;}
 refresh();
 message('ps-storage','Registrado en este navegador.'+(password?' Intentando sincronizar con Cloudflare.':' Sincronización privada opcional.'));
 if(password)void syncNow();
 return true;
}
function stopPause(msg){
 if(pauseTimer!==null){clearInterval(pauseTimer);pauseTimer=null;}
 pauseEnd=0;
 if($('ps-pause-plus'))$('ps-pause-plus').disabled=false;
 if($('ps-pause-clock'))$('ps-pause-clock').textContent='10 s';
 if(msg)message('ps-pause-message',msg);
}
function tickPause(){
 if(!pauseEnd)return;
 if(document.hidden){stopPause('Pausa interrumpida: no contabilizada.');return;}
 const ms=pauseEnd-Date.now();
 if(ms<=0){
  stopPause();
  message('ps-pause-message',add('pause10',{seconds:10})?'Pausa de 10 segundos completada y registrada.':'Pausa terminada, pero el registro no se ha guardado.');
  return;
 }
 if($('ps-pause-clock'))$('ps-pause-clock').textContent=Math.ceil(ms/1000)+' s';
}
function startPause(){
 if(pauseEnd)return;
 pauseEnd=Date.now()+10000;
 $('ps-pause-plus').disabled=true;
 message('ps-pause-message','Detente antes de cambiar de actividad. Cuenta los 10 segundos.');
 tickPause();
 pauseTimer=setInterval(tickPause,180);
}
function restoreFocus(){
 try{
  const raw=localStorage.getItem(focusKey);
  if(!raw)return null;
  const v=JSON.parse(raw);
  if(!idOk(v.id)||!Number.isFinite(v.started)||!Number.isFinite(v.end)||v.end-v.started!==1500000||typeof v.task!=='string'||!v.task.trim()||v.task.length>120)throw Error('invalid');
  return v;
 }catch{message('ps-focus-message','Hay un periodo anterior incompatible. No se ha borrado.');return null;}
}
function focusControls(){
 if(!$('ps-focus-start'))return;
 $('ps-focus-start').hidden=!!focus;
 $('ps-focus-cancel').hidden=!focus;
 $('ps-focus-done').hidden=!focus||Date.now()<focus.end;
 $('ps-task').disabled=!!focus;
}
function tickFocus(){
 focusControls();
 if(!focus){message('ps-focus-clock','25:00');return;}
 const remaining=Math.max(0,Math.ceil((focus.end-Date.now())/1000));
 message('ps-focus-clock',String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0'));
 if(remaining===0)message('ps-focus-message','Han transcurrido 25 minutos. Confirma el periodo solo si mantuviste la tarea principal.');
}
function focusStart(){
 if(focus)return;
 const task=$('ps-task').value.trim();
 if(!task){message('ps-focus-message','Escribe la tarea que vas a realizar.');$('ps-task').focus();return;}
 focus={id:crypto.randomUUID(),task,started:Date.now(),end:Date.now()+1500000};
 try{localStorage.setItem(focusKey,JSON.stringify(focus));}catch{focus=null;message('ps-focus-message','No se pudo guardar el temporizador. Comprueba el almacenamiento.');return;}
 message('ps-focus-message','Una sola tarea. Deja Rumbo y otras actividades para después.');
 tickFocus();
}
function focusCancel(){
 if(!focus||!confirm('¿Cancelar este periodo sin contarlo?'))return;
 try{localStorage.removeItem(focusKey);}catch{}
 focus=null;message('ps-focus-message','Periodo cancelado; no se ha contado.');tickFocus();
}
function focusComplete(){
 if(!focus||Date.now()<focus.end)return;
 const event={version:1,id:focus.id,kind:'focus25',at:new Date(focus.end).toISOString(),seconds:1500,task:focus.task};
 // Guardar el periodo ANTES de quitar la sesión activa; evita perderlo ante una cuota agotada.
 if(!saveEvent(event)){message('ps-focus-message','No se pudo guardar el periodo; no se ha contado.');return;}
 try{localStorage.removeItem(focusKey);}catch{}
 focus=null;refresh();tickFocus();
 message('ps-focus-message','Periodo de 25 minutos registrado.');
 message('ps-storage','Periodo guardado en este navegador.');
 if(password)void syncNow();
}
function b64(bytes){return btoa(String.fromCharCode(...bytes));}
function un64(text){return Uint8Array.from(atob(text),c=>c.charCodeAt(0));}
function authorization(){return 'Rumbo '+b64(enc.encode(password));}
async function api(method='GET',body=null){
 const res=await fetch(endpoint,{method,headers:{Authorization:authorization(),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error('Servidor HTTP '+res.status);
 return data;
}
async function cryptKey(salt){
 const base=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:180000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function seal(event){
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await cryptKey(salt);
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(event)));
 return {version:1,id:event.id,date:event.at,salt:b64(salt),iv:b64(iv),cipher:b64(new Uint8Array(cipher))};
}
async function openRecord(record){
 const key=await cryptKey(un64(record.salt));
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(record.iv)},key,un64(record.cipher));
 return JSON.parse(dec.decode(plain));
}
async function syncNow(){
 if(!password||syncing)return;
 syncing=true;
 message('ps-sync-status','Comprobando registros cifrados de Cloudflare…');
 $('ps-sync').disabled=true;
 try{
  const data=await api();
  if(!Array.isArray(data.records))throw Error('La API no devolvió registros válidos');
  const serverIds=new Set();
  for(const row of data.records){
   if(!idOk(row.id))continue;
   serverIds.add(row.id);
   let value;
   try{value=await openRecord(row);}catch{throw Error('Hay un registro que no puede descifrarse con esta contraseña. No se han sobrescrito datos.');}
   if(validEvent(value)&&value.id===row.id){
    try{
     if(!localStorage.getItem(prefix+value.id))saveEvent(value);
     localStorage.setItem(syncPrefix+value.id,'1');
    }catch{throw Error('No se pudieron guardar todos los registros recibidos en este navegador.');}
   }
  }
  refresh();
  const pending=events.filter(e=>!serverIds.has(e.id));
  let uploaded=0;
  for(const e of pending){
   let envelope;
   try{
    const cached=localStorage.getItem(envelopePrefix+e.id);
    envelope=cached?JSON.parse(cached):await seal(e);
    if(!cached)localStorage.setItem(envelopePrefix+e.id,JSON.stringify(envelope));
   }catch{throw Error('No se pudo guardar la copia cifrada pendiente en este navegador.');}
   const response=await api('POST',envelope);
   if(!response.record||response.record.id!==e.id)throw Error('El servidor no confirmó el registro '+e.id);
   localStorage.setItem(syncPrefix+e.id,'1');
   uploaded++;
  }
  message('ps-sync-status','Sincronización confirmada: '+events.length+' registros de prácticas en este navegador; '+uploaded+' enviados.');
 }catch(err){
  message('ps-sync-status','Sincronización no confirmada: '+err.message+'. Los registros locales se mantienen.');
 }finally{syncing=false;if($('ps-sync'))$('ps-sync').disabled=false;}
}
function exportBackup(){
 events=loadEvents();
 const raw=JSON.stringify({version:1,exportedAt:new Date().toISOString(),records:events},null,2);
 const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='rumbo-practicas-'+new Date().toISOString().slice(0,10)+'.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
 message('ps-storage','Copia descargada. Contiene notas sin cifrar: guárdala en un lugar privado.');
}
async function importBackup(file){
 if(!file||file.size>2000000){message('ps-storage','Archivo no válido o superior a 2 MB.');return;}
 try{
  const data=JSON.parse(await file.text());
  if(data.version!==1||!Array.isArray(data.records)||data.records.length>10000||!data.records.every(validEvent))throw Error('Formato incompatible');
  let inserted=0;
  for(const e of data.records){
   if(localStorage.getItem(prefix+e.id)===null){if(!saveEvent(e))throw Error('No se pudo guardar toda la copia');inserted++;}
  }
  refresh();message('ps-storage','Copia incorporada: '+inserted+' nuevos registros. No se han sustituido los anteriores.');
  if(password)void syncNow();
 }catch(err){message('ps-storage','Importación no completada: '+err.message);}
}
function mount(){
 const host=$('ev-training');
 if(!host||$('ps-app'))return;
 host.innerHTML='<div id="ps-app">'+
  '<h3 class="ps-heading">Mis cuatro prácticas</h3>'+
  '<p class="ps-intro">Un gesto sencillo cada vez. Registrar una práctica no es una evaluación clínica ni exige hacerlo perfecto.</p>'+
  '<div class="ps-grid">'+
  '<article class="ps-card"><h4>1. Pausa de 10 segundos</h4><p>Cuando cambies de actividad, pulsa +, detente y espera 10 segundos antes de continuar.</p>'+
  '<div class="ps-ctrl"><button id="ps-pause-plus" class="ps-plus" type="button" aria-label="Iniciar pausa de 10 segundos">+</button><div class="ps-counter"><strong id="ps-pause-today">0</strong><small>Hoy · <span id="ps-pause-all">0</span> en total</small></div></div>'+
  '<div id="ps-pause-clock" class="ps-clock">10 s</div><p id="ps-pause-message" class="ps-message" role="status" aria-live="polite"></p></article>'+
  '<article class="ps-card"><h4>2. Detener, escuchar, pensar, procesar y actuar</h4>'+
  '<p>Después de realizar los cinco pasos, pulsa + para registrar ese momento.</p><p class="ps-steps">Detener → Escuchar → Pensar → Procesar → Actuar</p>'+
  '<div class="ps-ctrl"><button id="ps-steps-plus" class="ps-plus" type="button" aria-label="Registrar la secuencia de cinco pasos">+</button><div class="ps-counter"><strong id="ps-steps-today">0</strong><small>Hoy · <span id="ps-steps-all">0</span> en total</small></div></div>'+
  '<p id="ps-steps-message" class="ps-message" role="status" aria-live="polite"></p></article>'+
  '<article class="ps-card"><h4>3. Una sola tarea · 25 minutos</h4>'+
  '<p>Elige una tarea y mantén el foco. Cuenta únicamente los periodos que confirmes haber completado.</p>'+
  '<label for="ps-task">Mi tarea</label><input id="ps-task" type="text" maxlength="120" placeholder="Ejemplo: estudiar un tema" autocomplete="off">'+
  '<div id="ps-focus-clock" class="ps-clock">25:00</div><div class="ps-buttons"><button class="button primary" id="ps-focus-start" type="button">Empezar 25 minutos</button>'+
  '<button class="button secondary" id="ps-focus-cancel" type="button" hidden>Cancelar</button>'+
  '<button class="button primary" id="ps-focus-done" type="button" hidden>Confirmar periodo</button></div>'+
  '<p class="ps-counter"><strong id="ps-focus-today">0</strong><small>Periodos hoy · <span id="ps-focus-all">0</span> en total</small></p>'+
  '<p id="ps-focus-message" class="ps-message" role="status" aria-live="polite"></p></article>'+
  '<article class="ps-card"><h4>4. Detectar y regresar</h4>'+
  '<p>Detecta la interferencia, anótala si quieres y vuelve a la tarea sin resolverla ahora. Pulsa + para contarla.</p>'+
  '<label for="ps-return-note">¿Qué me distrajo? (opcional)</label><input id="ps-return-note" type="text" maxlength="300" placeholder="Ejemplo: idea para modificar la web" autocomplete="off">'+
  '<div class="ps-ctrl"><button id="ps-return-plus" class="ps-plus" type="button" aria-label="Registrar interferencia detectada y regreso a la tarea">+</button><div class="ps-counter"><strong id="ps-return-today">0</strong><small>Hoy · <span id="ps-return-all">0</span> en total</small></div></div>'+
  '<p id="ps-return-message" class="ps-message" role="status" aria-live="polite"></p></article></div>'+
  '<section class="ps-log" aria-label="Historial de prácticas"><h4>Últimos registros</h4><ul id="ps-events"></ul>'+
  '<p id="ps-storage" class="ps-message" role="status" aria-live="polite">Los registros se guardan en este navegador. Puedes exportar una copia y sincronizar más adelante.</p></section>'+
  '<details><summary>Copias y sincronización privada</summary>'+
  '<p class="ps-caption">Descarga una copia de tus registros. La copia JSON no está cifrada: consérvala en un lugar privado. Puedes importarla sin sustituir datos anteriores.</p>'+
  '<div class="ps-buttons"><button class="button secondary" id="ps-export" type="button">Exportar copia JSON</button>'+
  '<label class="button secondary" for="ps-import">Importar copia</label><input type="file" id="ps-import" accept=".json,application/json" hidden></div>'+
  '<p class="ps-caption">La sincronización necesita que el backend privado /training esté publicado. La contraseña solo permanece en la memoria de esta pestaña y los datos se cifran antes de enviarse.</p>'+
  '<label for="ps-password">Contraseña privada de Rumbo</label><input id="ps-password" type="password" autocomplete="off" placeholder="Contraseña privada">'+
  '<div class="ps-buttons"><button class="button secondary" id="ps-sync" type="button">Conectar y sincronizar</button>'+
  '<button class="button secondary" id="ps-lock" type="button">Desconectar</button></div>'+
  '<p id="ps-sync-status" class="ps-message" role="status" aria-live="polite">La sincronización es opcional y no está activada.</p></details></div>';
 $('ps-pause-plus').onclick=startPause;
 $('ps-steps-plus').onclick=()=>message('ps-steps-message',add('steps5')?'Secuencia registrada.':'No se pudo guardar.');
 $('ps-return-plus').onclick=()=>{
  const note=$('ps-return-note').value.trim();
  if(add('return',{note})){$('ps-return-note').value='';message('ps-return-message','Interferencia anotada. Vuelve a la tarea.');}
  else message('ps-return-message','No se pudo guardar la interferencia.');
 };
 $('ps-focus-start').onclick=focusStart;
 $('ps-focus-cancel').onclick=focusCancel;
 $('ps-focus-done').onclick=focusComplete;
 $('ps-export').onclick=exportBackup;
 $('ps-import').onchange=e=>{void importBackup(e.target.files?.[0]);e.target.value='';};
 $('ps-sync').onclick=()=>{
  const value=$('ps-password').value;
  if(!value){message('ps-sync-status','Introduce la contraseña privada para conectar.');return;}
  password=value;$('ps-password').value='';
  void syncNow();
 };
 $('ps-lock').onclick=()=>{password='';$('ps-password').value='';message('ps-sync-status','Desconectado. Tus registros locales se conservan.');};
 focus=restoreFocus();
 if(focus)$('ps-task').value=focus.task;
 refresh();tickFocus();
}
mount();
new MutationObserver(()=>{if(!$('ps-app'))mount();}).observe(root,{childList:true,subtree:false});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&pauseEnd)stopPause('Pausa interrumpida: no contabilizada.');tickFocus();});
window.addEventListener('storage',e=>{if(e.key?.startsWith(prefix)){refresh();}else if(e.key===focusKey){focus=restoreFocus();tickFocus();}});
setInterval(()=>{if(pauseEnd)tickPause();tickFocus();},250);
})();