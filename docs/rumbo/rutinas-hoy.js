(() => {
'use strict';
// Panel independiente: no modifica los almacenes de Diario, oposiciones o Mi evolución.
// El experimento más largo del PR #22 utiliza otra clave y sigue siendo independiente.
const home=document.getElementById('mi-dia');if(!home)return;
const KEY='rumbo-rutinas-hoy-v1';
const TASKS=[['planificar','Planificar el día'],['estudiar','Realizar mi bloque de estudio'],['revisar','Revisar el día']];
const $=id=>document.getElementById(id);
const localDay=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const validDay=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Array.isArray(v.routines)&&v.routines.length<=TASKS.length&&v.routines.every(id=>TASKS.some(t=>t[0]===id))&&new Set(v.routines).size===v.routines.length&&Array.isArray(v.pauses)&&v.pauses.length<=100&&v.pauses.every(p=>p&&typeof p.at==='string'&&/^\d{4}-\d\d-\d\dT/.test(p.at)&&['seguir','cambiar'].includes(p.decision));
const validStore=s=>s&&s.version===1&&s.days&&typeof s.days==='object'&&!Array.isArray(s.days)&&Object.keys(s.days).length<=730&&Object.entries(s.days).every(([d,v])=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&validDay(v));
let savedRaw=null,state={version:1,days:{}},locked=false;
try{savedRaw=localStorage.getItem(KEY);if(savedRaw){const data=JSON.parse(savedRaw);if(!validStore(data))throw Error('incompatible');state=data;}}catch{locked=true;}
const panel=document.createElement('section');panel.className='routine-panel';panel.setAttribute('aria-label','Prioridad, rutinas y pausa');
panel.innerHTML=[
'<div class="routine-head"><div><p class="routine-eyebrow">HOY · UN PASO CADA VEZ</p><h3>Tu siguiente paso</h3><p id="routine-focus">Elige una prioridad en Mi día.</p></div><a class="button secondary" href="#productividad">Empezar un bloque</a></div>',
'<div class="routine-grid"><div><h4>Mis tres rutinas</h4><div id="routine-list" class="routine-list"></div></div>',
'<div><h4>Pausa de 10 segundos</h4><p class="routine-help">Antes de cambiar de tarea, observa el impulso y decide después.</p>',
'<div class="routine-actions"><button type="button" id="routine-start" class="button primary">Iniciar pausa</button><button type="button" id="routine-cancel" class="button secondary" hidden>Cancelar</button></div>',
'<strong id="routine-clock" class="routine-clock" aria-live="off"></strong><div id="routine-decisions" class="routine-actions" hidden>',
'<button type="button" id="routine-stay" class="button secondary">Continuar</button><button type="button" id="routine-switch" class="button secondary">Cambiar de tarea</button></div>',
'<p id="routine-count" class="routine-help"></p></div></div>',
'<p class="routine-footnote">Registro voluntario en este navegador. No es una evaluación clínica ni una alarma del dispositivo. Se incluye en las copias cifradas de Rumbo.</p>',
'<p id="routine-message" class="routine-message" role="status" aria-live="polite"></p>'
].join('');
home.prepend(panel);
const list=$('routine-list'),start=$('routine-start'),cancel=$('routine-cancel'),clock=$('routine-clock'),decisions=$('routine-decisions');
const checkboxes=new Map();
for(const [id,label] of TASKS){
 const row=document.createElement('label');row.className='routine-item';
 const input=document.createElement('input');input.type='checkbox';input.dataset.routine=id;input.disabled=locked;
 const span=document.createElement('span');span.textContent=label;row.append(input,span);list.append(row);checkboxes.set(id,input);
 input.addEventListener('change',()=>{
  const next=input.checked;
  if(!writeDay(day=>({...day,routines:next?[...day.routines,id]:day.routines.filter(x=>x!==id)})))input.checked=!next;
 });
}
let deadline=0,ticker=null;
function message(s){$('routine-message').textContent=s;}
function getDay(){return state.days[localDay()]||{routines:[],pauses:[]};}
function writeDay(transform){
 if(locked){message('Los datos guardados tienen un formato incompatible. No se sobrescribirán. Conserva una copia y revisa el almacenamiento.');return false;}
 try{
  if(localStorage.getItem(KEY)!==savedRaw)throw Error('Otra pestaña cambió las rutinas. Recarga antes de guardar para evitar pérdidas.');
  const day=localDay(),nextDay=transform(getDay());
  const next={version:1,days:{...state.days,[day]:nextDay}};
  if(!validStore(next))throw Error('El registro supera el límite seguro de almacenamiento.');
  const raw=JSON.stringify(next);
  localStorage.setItem(KEY,raw);
  if(localStorage.getItem(KEY)!==raw)throw Error('El navegador no confirmó el guardado.');
  savedRaw=raw;state=next;render();return true;
 }catch(e){message('No se guardó: '+e.message);return false;}
}
function renderFocus(){
 try{
  const saved=JSON.parse(localStorage.getItem('rumbo-asistente-v1')||'null');
  const tasks=Array.isArray(saved?.items)?saved.items:[];
  const ids=Array.isArray(saved?.priorityIds)?saved.priorityIds:[];
  const next=ids.map(id=>tasks.find(t=>t.id===id&&!t.done)).find(Boolean);
  $('routine-focus').textContent=next?String(next.nextStep||next.text).slice(0,250):'Elige una prioridad en Mi día.';
 }catch{$('routine-focus').textContent='Consulta tus prioridades en Mi día.';}
}
function render(){
 const today=getDay();
 for(const [id,input] of checkboxes)input.checked=today.routines.includes(id);
 $('routine-count').textContent='Pausas registradas hoy: '+today.pauses.length+'.';
 renderFocus();
}
function stopClock(){
 if(ticker!==null)clearInterval(ticker);ticker=null;deadline=0;cancel.hidden=true;
 start.hidden=false;decisions.hidden=true;clock.textContent='';
}
function tick(){
 const remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));
 clock.textContent=remaining?remaining+' segundos restantes':'Ya puedes elegir qué hacer';
 if(remaining===0){if(ticker!==null)clearInterval(ticker);ticker=null;decisions.hidden=false;cancel.hidden=false;}
}
start.addEventListener('click',()=>{
 if(locked){message('Hay datos incompatibles: no se iniciará un registro que pudiera sobrescribirlos.');return;}
 deadline=Date.now()+10000;start.hidden=true;cancel.hidden=false;decisions.hidden=true;message('');
 tick();ticker=setInterval(tick,250);
});
cancel.addEventListener('click',()=>{stopClock();message('Pausa cancelada sin registrar datos.');});
for(const [id,decision] of [['routine-stay','seguir'],['routine-switch','cambiar']]){
 $(id).addEventListener('click',()=>{
  if(!deadline||Date.now()<deadline)return;
  const day=getDay();
  if(day.pauses.length>=100){message('Límite diario de registros alcanzado. Puedes seguir sin registrar.');return;}
  if(writeDay(v=>({...v,pauses:[...v.pauses,{at:new Date().toISOString(),decision}]}))){
   stopClock();message(decision==='seguir'?'Pausa guardada: has decidido continuar.':'Pausa guardada: has decidido cambiar de tarea.');
  }
 });
}
window.addEventListener('rumbo:assistant-changed',renderFocus);
window.addEventListener('storage',e=>{if(e.key===KEY)message('Las rutinas han cambiado en otra pestaña. Recarga antes de editar.');if(e.key==='rumbo-asistente-v1')renderFocus();});
if(locked){start.disabled=true;message('Existe un registro incompatible. No se modificará ni borrará automáticamente.');}
render();
window.RumboTodayRoutines=Object.freeze({snapshot:()=>({day:localDay(),routines:[...getDay().routines],pauses:getDay().pauses.length,locked})});
})();