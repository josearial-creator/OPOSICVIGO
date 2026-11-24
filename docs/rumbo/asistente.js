(() => {
'use strict';
const home=document.getElementById('mi-dia'),prod=document.getElementById('productividad');
if(!home||!prod)return;
const KEY='rumbo-asistente-v1';
const AREAS=['Trabajo y empleo','Estudio y oposiciones','Familia','Salud y ejercicio','Hogar y gestiones','Proyectos personales','Descanso'];
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=String(text);return x;};
const uid=()=>crypto.randomUUID();
const localDay=(d=new Date())=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const minutes=s=>{const n=Math.floor(s/60);return n>=60?Math.floor(n/60)+' h '+n%60+' min':n+' min';};
const clock=s=>[Math.floor(s/3600),Math.floor(s%3600/60),Math.floor(s%60)].map(x=>String(x).padStart(2,'0')).join(':');
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(new Date(d+'T12:00:00').valueOf());
const validItem=x=>x&&typeof x.id==='string'&&typeof x.text==='string'&&x.text.length>0&&x.text.length<=1000&&typeof x.done==='boolean'&&typeof x.nextStep==='string'&&x.nextStep.length<=250&&typeof x.createdAt==='string';
const validSession=x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&x.title.length>0&&x.title.length<=120&&AREAS.includes(x.area)&&validDate(x.date)&&Number.isInteger(x.seconds)&&x.seconds>=60&&x.seconds<=86400&&['temporizador','manual'].includes(x.source);
const validTimer=t=>t===null||(t&&typeof t.title==='string'&&t.title.trim()&&t.title.length<=120&&AREAS.includes(t.area)&&Number.isInteger(t.target)&&[300,600,900,1500,2700].includes(t.target)&&Number.isFinite(t.elapsed)&&t.elapsed>=0&&t.elapsed<=t.target&&(t.startedAt===null||(Number.isFinite(t.startedAt)&&t.startedAt>0))&&typeof t.warned==='boolean'&&(t.taskId===null||typeof t.taskId==='string'));
const valid=d=>d&&d.version===1&&Array.isArray(d.items)&&d.items.length<=10000&&d.items.every(validItem)&&Array.isArray(d.priorityIds)&&d.priorityIds.length<=3&&d.priorityIds.every(x=>typeof x==='string')&&Array.isArray(d.sessions)&&d.sessions.length<=15000&&d.sessions.every(validSession)&&validTimer(d.timer)&&['baja','media','alta'].includes(d.energy)&&d.event&&typeof d.event.title==='string'&&typeof d.event.at==='string';
let state={version:1,items:[],priorityIds:[],sessions:[],timer:null,energy:'media',event:{title:'',at:''}},locked=false,savedRaw=null,preparedTaskId=null,preparedTitle='';
try{savedRaw=localStorage.getItem(KEY);if(savedRaw){const p=JSON.parse(savedRaw);if(!valid(p))throw Error('invalid');state=p;}}catch{locked=true;}
function note(s){$('assistant-message').textContent=s;}
function save(){
 if(locked){note('No se puede guardar sin revisar los datos existentes. Conserva una copia y recarga la página.');return false;}
 try{
  if(localStorage.getItem(KEY)!==savedRaw){locked=true;note('Otra pestaña modificó Mi día o Productividad. No se sobrescribió nada. Recarga la página para continuar.');return false;}
  const raw=JSON.stringify(state);localStorage.setItem(KEY,raw);savedRaw=raw;
  window.dispatchEvent(new Event('rumbo:assistant-changed'));return true;
 }catch{note('No se pudo guardar. Revisa el almacenamiento del navegador.');return false;}
}
function option(s,v){const x=el('option','',s);x.value=v===undefined?s:v;return x;}
function selectAreas(id){AREAS.forEach(a=>$(id).add(option(a)));}
function linkBtn(label,fn,style='secondary'){const x=el('button','button '+style,label);x.type='button';x.addEventListener('click',fn);return x;}
home.innerHTML=[
'<div class="assistant-head"><div><div class="eyebrow">UN PASO CADA VEZ</div><h2>Mi día</h2><p id="assistant-date"></p></div></div>',
'<div class="assistant-body">',
'<section class="assistant-now-card" aria-labelledby="assistant-now-heading">',
'<div class="assistant-now-top"><span class="assistant-now-eyebrow">LO IMPORTANTE AHORA</span><span id="assistant-now-state" class="assistant-now-state"></span></div>',
'<h3 id="assistant-now-heading">Tu siguiente acción</h3>',
'<p id="assistant-now-task" class="assistant-now-task">Elige una tarea para empezar.</p>',
'<p id="assistant-now-step" class="assistant-now-step"></p>',
'<form id="assistant-step-form" class="assistant-step-form" aria-label="Editar siguiente paso"><label for="assistant-step-input">Escribe el siguiente paso concreto</label><div class="assistant-step-controls"><input id="assistant-step-input" name="step" maxlength="250" placeholder="Ej.: Abrir el tema 3 y leer el primer apartado" autocomplete="off"><button id="assistant-step-save" class="button secondary" type="submit">Guardar paso</button></div><p id="assistant-step-status" class="assistant-step-status" role="status" aria-live="polite"></p></form>',
'<p id="assistant-time-available" class="assistant-time-available" hidden></p>',
'<div class="assistant-next-actions"><button id="assistant-quick-start" type="button" class="button primary">Empezar 10 minutos</button><button id="assistant-focus-next" type="button" class="button secondary">Preparar un bloque</button><button id="assistant-what" type="button" class="button secondary">¿Qué hago ahora?</button></div>',
'<p id="assistant-advice" class="assistant-recommendation" role="status" aria-live="polite" hidden></p>',
'</section>',
'<div class="assistant-today-grid">',
'<section class="assistant-card assistant-capture-card" aria-labelledby="assistant-capture-heading"><h3 id="assistant-capture-heading">Nueva tarea</h3>',
'<form id="assistant-capture" class="assistant-inline"><label>¿Qué tienes que hacer?<input name="text" maxlength="1000" required placeholder="Ej.: Repasar el tema 3"></label><button class="button primary" type="submit">Crear tarea</button></form>',
'<p class="assistant-muted">Las tareas que crees aquí aparecerán en la bandeja de entrada.</p>',
'<p class="assistant-status" id="assistant-message" role="status" aria-live="polite"></p></section>',
'<section class="assistant-card assistant-options-card" aria-labelledby="assistant-options-heading"><h3 id="assistant-options-heading">Organizar cuando quieras</h3>',
'<details id="assistant-priority-details" class="assistant-disclosure"><summary>Mis prioridades <span id="assistant-priority-count"></span></summary><div id="assistant-priorities"></div></details>',
'<details id="assistant-planning-details" class="assistant-disclosure"><summary>Energía y compromisos</summary>',
'<div class="assistant-inline"><label>Mi energía<select id="assistant-energy"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select></label>',
'<label>Próximo compromiso (opcional)<input type="datetime-local" id="assistant-event-at"></label></div>',
'<label class="assistant-event-label">Compromiso (opcional)<input id="assistant-event-title" maxlength="120" placeholder="Ej.: Recoger a los niños"></label></details>',
'</section></div>',
'<details class="assistant-inbox-details"><summary id="assistant-inbox-count">Bandeja de entrada</summary><div id="assistant-inbox"></div></details>',
'</div>'
].join('');
prod.innerHTML=[
'<div class="assistant-head"><div><div class="eyebrow">SIN PRESIÓN POR COMPLETARLO TODO</div><h2>Productividad</h2><p>Registra lo que haces, cuenta también el descanso y termina cuando lo necesites.</p></div></div>',
'<div class="assistant-body"><div class="assistant-grid"><div class="assistant-card">',
'<h3>Temporizador</h3><label>Actividad<input id="assistant-timer-title" maxlength="120" placeholder="Ej.: Preparar oposición"></label><p id="assistant-task-hint" class="assistant-muted" role="status" aria-live="polite"></p>',
'<div class="assistant-inline"><label>Área<select id="assistant-timer-area"></select></label><label>Proyecto (opcional)<select id="assistant-project"><option value="">Sin proyecto</option></select></label>',
'<label>Duración<select id="assistant-duration"><option value="5">5 minutos</option><option value="10">10 minutos</option><option value="15" selected>15 minutos</option><option value="25">25 minutos</option><option value="45">45 minutos</option></select></label></div>',
'<div id="assistant-clock" class="assistant-clock">00:00:00</div><div id="assistant-timer-state" class="assistant-timer-state">El cronómetro empieza cuando tú quieras.</div>',
'<div class="assistant-button-row"><button id="assistant-start" class="button primary" type="button">Iniciar</button><button id="assistant-pause" class="button secondary" type="button">Pausar</button><button id="assistant-finish" class="button secondary" type="button">Finalizar</button><button id="assistant-park" class="button secondary" type="button">Aparcar actividad</button></div>',
'<p class="assistant-muted">Se detiene al completar el intervalo y te ofrece guardar el siguiente paso. Si sales de la página, se contabiliza hasta el límite previsto, nunca más.</p></div>',
'<div class="assistant-card"><h3>Añadir tiempo manualmente</h3><form id="assistant-manual">',
'<label>Actividad<input name="title" required maxlength="120" placeholder="Ej.: Organización del hogar"></label>',
'<div class="assistant-inline"><label>Área<select name="area" id="assistant-manual-area"></select></label><label>Proyecto (opcional)<select name="project" id="assistant-manual-project"><option value="">Sin proyecto</option></select></label><label>Fecha<input name="date" type="date" required></label><label>Minutos<input name="mins" type="number" min="1" max="1440" step="1" required></label></div>',
'<button class="button primary" type="submit">Guardar actividad</button></form></div></div>',
'<div class="assistant-inline" style="margin:18px 0 0"><label>Periodo<select id="assistant-period"><option value="day">Hoy</option><option value="week" selected>Esta semana</option><option value="month">Este mes</option></select></label></div>',
'<div class="assistant-kpis"><article><strong id="assistant-total">0 min</strong><span>Tiempo registrado</span></article><article><strong id="assistant-activity">0 min</strong><span>Actividades</span></article><article><strong id="assistant-rest">0 min</strong><span>Descanso</span></article></div>',
'<h3>Reparto de tiempo por área</h3><div id="assistant-chart" class="assistant-category-chart"></div>',
'<section class="assistant-history"><h3>Sesiones registradas</h3><div id="assistant-history"></div></section>',
'<div class="assistant-tools"><button id="assistant-export-json" class="button secondary" type="button">Exportar JSON</button>',
'<button id="assistant-export-csv" class="button secondary" type="button">Exportar CSV</button>',
'<label class="button secondary">Recuperar copia JSON<input id="assistant-import" type="file" accept=".json,application/json" hidden></label></div>',
'<p class="assistant-muted">Datos guardados solamente en este navegador. No se sincronizan entre dispositivos ni se envían a Gemini. No incluye los datos privados guardados en ChatGPT Sites.</p></div>'
].join('');
selectAreas('assistant-timer-area');selectAreas('assistant-manual-area');
function refreshProjectOptions(){
 const options=window.RumboOrganization?.listProjects?.()||[];
 for(const id of ['assistant-project','assistant-manual-project']){
  const box=$(id),selected=box.value;
  box.replaceChildren(option('Sin proyecto',''));
  options.filter(p=>p.status!=='Terminado').forEach(p=>box.add(option(p.name,p.id)));
  if([...box.options].some(x=>x.value===selected))box.value=selected;
 }
}
window.addEventListener('rumbo:projects-updated',refreshProjectOptions);
refreshProjectOptions();
$('assistant-manual').elements.date.value=localDay();
$('assistant-date').textContent=new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
$('assistant-energy').value=state.energy;
$('assistant-event-at').value=state.event.at;
$('assistant-event-title').value=state.event.title;
function activeItem(){return state.priorityIds.map(id=>state.items.find(x=>x.id===id&&!x.done)).find(Boolean)||state.items.find(x=>!x.done);}
function updateAvailability(){
 const at=state.event.at,when=at?new Date(at).getTime():NaN,n=Math.ceil((when-Date.now())/60000);
 const output=$('assistant-time-available');
 output.hidden=!Number.isFinite(n);
 output.textContent=!Number.isFinite(n)?'':n>0?'Próximo compromiso: '+(state.event.title||'sin título')+' en '+n+' min.':'El compromiso registrado ya ha llegado o ha pasado.';
}
function chooseAdvice(){
 const current=state.timer;
 let msg;
 if(current){const left=Math.max(0,Math.ceil((current.target-timerSeconds(current))/60));msg=left?'Continúa con «'+current.title+'» durante '+left+' min. Al terminar puedes aparcarla.':'El intervalo ha terminado. Puedes aparcarlo y cambiar de actividad.';}
 else {
  const next=activeItem(),at=state.event.at,ms=at?new Date(at).getTime()-Date.now():Infinity;
  if(ms>0&&ms<10*60000)msg='Tu siguiente compromiso está cerca. Prepara lo necesario o utiliza estos minutos para descansar.';
  else if(next)msg='Una acción: dedica '+(state.energy==='baja'?'5':state.energy==='alta'?'15':'10')+' minutos a «'+(next.nextStep||next.text)+'». Puedes dejar lo demás para después.';
  else msg='No tienes prioridades pendientes. Puedes descansar o guardar una idea en la bandeja de entrada.';
 }
 $('assistant-advice').textContent=msg;
 $('assistant-advice').hidden=false;
}
function commitRender(msg){if(save()){render();if(msg)note(msg);}}
function renderTasks(){
 const next=activeItem(),focus=$('assistant-focus-next');
 const ids=state.priorityIds.filter(id=>state.items.some(t=>t.id===id&&!t.done));
 const running=state.timer,task=$('assistant-now-task'),step=$('assistant-now-step'),tag=$('assistant-now-state');
 focus.disabled=locked||!running&&!next;
 focus.textContent=running?'Ver mi bloque':'Preparar un bloque';
 const quick=$('assistant-quick-start');
 quick.disabled=locked||Boolean(running)||!next;
 quick.textContent=running?'Bloque en curso':'Empezar 10 minutos';
 $('assistant-priority-count').textContent=ids.length+'/3';
 if(running){
  task.textContent=running.title;
  tag.textContent=running.startedAt!==null?'Bloque en curso':running.warned?'Intervalo cumplido':'Bloque en pausa';
  const linked=state.items.find(item=>item.id===running.taskId);
  step.textContent=linked?.nextStep?'Siguiente paso: '+linked.nextStep:'Puedes continuar o aparcar esta actividad.';
 }else if(next){
  task.textContent=next.text;
  tag.textContent=ids.length?'Prioridad elegida':'De tu bandeja';
  step.textContent=next.nextStep?'Siguiente paso: '+next.nextStep:'Empieza con una acción pequeña; no necesitas terminarlo todo.';
 }else{
  task.textContent='Todavía no hay una tarea pendiente.';
  tag.textContent='Sin pendiente';
  step.textContent='Anota una tarea abajo. Aparecerá aquí para que puedas empezar.';
 }
 const selected=running?state.items.find(item=>item.id===running.taskId&&!item.done):next;
 const stepForm=$('assistant-step-form'),stepInput=$('assistant-step-input'),stepSave=$('assistant-step-save');
 const selectedId=selected?.id||'';
 if(stepForm.dataset.taskId!==selectedId){
  stepForm.dataset.taskId=selectedId;
  stepInput.value=selected?.nextStep||'';
  $('assistant-step-status').textContent='';
 }
 stepInput.disabled=locked||!selected;
 stepSave.disabled=locked||!selected;
 stepForm.hidden=!selected;
 $('assistant-advice').hidden=true;
 const p=$('assistant-priorities');p.replaceChildren();
 if(ids.length===0)p.append(el('p','assistant-muted','Sin prioridades elegidas. Selecciona una desde tu bandeja.'));
 ids.forEach((id,i)=>{const t=state.items.find(x=>x.id===id),box=el('div','assistant-priority');
  box.append(el('strong','',i===0?'Principal':'Secundaria'),el('span','',t.nextStep||t.text));
  box.append(linkBtn('Quitar',()=>{state.priorityIds=state.priorityIds.filter(x=>x!==id);commitRender('Prioridad retirada.');}));
  p.append(box);
 });
 const inbox=$('assistant-inbox');inbox.replaceChildren();
 const items=state.items.filter(x=>!x.done).slice().reverse();
 $('assistant-inbox-count').textContent='Bandeja de entrada · '+items.length+' pendientes';
 if(!items.length)inbox.append(el('p','assistant-muted','No hay elementos pendientes.'));
 items.forEach(t=>{
  const row=el('div','assistant-entry'),label=el('div','assistant-entry-text'),buttons=el('div','assistant-entry-actions');
  label.append(el('span','',t.text));if(t.nextStep)label.append(el('small','', 'Siguiente paso: '+t.nextStep));
  if(!state.priorityIds.includes(t.id))buttons.append(linkBtn('Priorizar',()=>{
   if(state.priorityIds.length>=3){note('Ya hay tres prioridades. Quita una antes de añadir otra.');return;}
   state.priorityIds.push(t.id);commitRender('Prioridad añadida.');
  }));
  buttons.append(linkBtn('Hecha',()=>{t.done=true;t.doneAt=new Date().toISOString();state.priorityIds=state.priorityIds.filter(id=>id!==t.id);commitRender('Tarea marcada como hecha.');}));
  buttons.append(linkBtn('Eliminar',()=>{if(confirm('¿Eliminar este elemento de la bandeja?')){state.items=state.items.filter(x=>x.id!==t.id);state.priorityIds=state.priorityIds.filter(id=>id!==t.id);commitRender('Elemento eliminado.');}}));
  row.append(label,buttons);inbox.append(row);
 });
}
$('assistant-step-form').addEventListener('submit',e=>{
 e.preventDefault();
 const form=e.currentTarget,input=$('assistant-step-input'),selectedId=form.dataset.taskId;
 const item=state.items.find(x=>x.id===selectedId&&!x.done);
 if(locked||!item){
  $('assistant-step-status').textContent='No se puede modificar esta tarea ahora.';
  return;
 }
 const nextStep=input.value.trim();
 if(nextStep.length>250){
  $('assistant-step-status').textContent='El siguiente paso puede tener como máximo 250 caracteres.';
  return;
 }
 if(item.nextStep===nextStep){
  $('assistant-step-status').textContent='El siguiente paso ya está guardado.';
  return;
 }
 const previous=item.nextStep;
 item.nextStep=nextStep;
 if(!save()){
  item.nextStep=previous;
  $('assistant-step-status').textContent='No se guardó el cambio. Recarga la página si hubo cambios en otra pestaña.';
  return;
 }
 render();
 $('assistant-step-status').textContent=nextStep?'Siguiente paso guardado.':'Siguiente paso eliminado.';
});
$('assistant-capture').addEventListener('submit',e=>{e.preventDefault();const input=e.target.elements.text,text=input.value.trim();
 if(!text)return;
 state.items.push({id:uid(),text,done:false,nextStep:'',createdAt:new Date().toISOString()});
 if(save()){input.value='';render();note('Tarea creada en tu bandeja de entrada.');}
});
$('assistant-energy').addEventListener('change',e=>{state.energy=e.target.value;commitRender();});
['assistant-event-at','assistant-event-title'].forEach(id=>$(id).addEventListener('change',()=>{
 state.event={at:$('assistant-event-at').value,title:$('assistant-event-title').value.slice(0,120)};
 commitRender();updateAvailability();
}));
$('assistant-what').addEventListener('click',chooseAdvice);
$('assistant-focus-next').addEventListener('click',()=>{
 if(!state.timer){
  const item=activeItem();if(!item)return;
  preparedTaskId=item.id;preparedTitle=item.text.slice(0,120);
  $('assistant-timer-title').value=preparedTitle;
  $('assistant-task-hint').textContent=item.nextStep?'Siguiente paso: '+item.nextStep:'Actividad preparada: elige la duración y pulsa Iniciar.';
  // Preselección reversible: la sesión comienza solo al pulsar Iniciar.
  $('assistant-duration').value=state.energy==='baja'?'5':state.energy==='alta'?'15':'10';
  const project=$('assistant-project');
  if(item.projectId&&[...project.options].some(o=>o.value===item.projectId))project.value=item.projectId;
 }
 if(!window.RumboNavigation?.go('productividad'))location.hash='#productividad';
});
$('assistant-quick-start').addEventListener('click',()=>{
 // Un solo gesto explícito, reutilizando las validaciones y el vínculo con la tarea.
 if(locked||state.timer||!activeItem())return;
 $('assistant-focus-next').click();
 $('assistant-duration').value='10';
 $('assistant-start').click();
});
$('assistant-timer-title').addEventListener('input',()=>{
 if($('assistant-timer-title').value!==preparedTitle){
  preparedTaskId=null;preparedTitle='';$('assistant-task-hint').textContent='';
 }
});
$('assistant-timer-area').value='Estudio y oposiciones';
function timerSeconds(t=state.timer){if(!t)return 0;return Math.min(t.target,t.elapsed+(t.startedAt===null?0:Math.max(0,Math.floor((Date.now()-t.startedAt)/1000))));}
function pauseTimer(){const t=state.timer;if(!t||t.startedAt===null)return;t.elapsed=timerSeconds(t);t.startedAt=null;commitRender('Temporizador en pausa.');}
function registerTimer(markDone){
 const t=state.timer,seconds=t?timerSeconds(t):0;
 if(t&&seconds>=60)state.sessions.push({id:uid(),title:t.title,area:t.area,date:localDay(),seconds,source:'temporizador',...(t.projectId?{projectId:t.projectId}:{})});
 if(t&&t.taskId&&markDone){const task=state.items.find(x=>x.id===t.taskId);if(task){task.done=true;task.doneAt=new Date().toISOString();}state.priorityIds=state.priorityIds.filter(id=>id!==t.taskId);}
 state.timer=null;commitRender(t&&seconds>=60?'Sesión guardada: '+minutes(seconds)+'.':'Actividad cerrada sin registrar minutos.');
}
function showStop(){
 const t=state.timer,current=t?.title||activeItem()?.text||'';
 $('stop-current').value=current.slice(0,120);
 $('stop-next').value=t?.taskId?state.items.find(x=>x.id===t.taskId)?.nextStep||'':'';
 if(!$('assistant-stop-dialog').open)$('assistant-stop-dialog').showModal();
}
function parkActivity(){
 const title=$('stop-current').value.trim(),step=$('stop-next').value.trim();
 const t=state.timer,seconds=timerSeconds(t);
 if(!title&&!step){$('stop-current').focus();return;}
 if(t&&seconds>=60)state.sessions.push({id:uid(),title:t.title,area:t.area,date:localDay(),seconds,source:'temporizador',...(t.projectId?{projectId:t.projectId}:{})});
 const existing=t?.taskId?state.items.find(x=>x.id===t.taskId):state.items.find(x=>!x.done&&x.text===title);
 if(existing){existing.done=false;if(step)existing.nextStep=step;}
 else{state.items.push({id:uid(),text:title||step,done:false,nextStep:step,createdAt:new Date().toISOString()});}
 state.timer=null;
 if(save()){render();$('assistant-stop-dialog').close();window.dispatchEvent(new CustomEvent('rumbo:activity-parked',{detail:{title:title||t?.title||'',at:new Date().toISOString()}}));note('Actividad aparcada. El siguiente paso queda guardado.');}
}
$('stop-park').addEventListener('click',parkActivity);
$('stop-done').addEventListener('click',()=>{
 const t=state.timer;
 if(!t){const a=state.items.find(x=>!x.done&&x.text===$('stop-current').value.trim());if(a){a.done=true;a.doneAt=new Date().toISOString();state.priorityIds=state.priorityIds.filter(id=>id!==a.id);commitRender('Tarea terminada.');}}
 else registerTimer(true);
 $('assistant-stop-dialog').close();
});
$('stop-close').addEventListener('click',()=>$('assistant-stop-dialog').close());
$('need-stop').addEventListener('click',showStop);
function expiry(){
 const t=state.timer;
 if(!t||t.startedAt===null||timerSeconds(t)<t.target)return;
 t.elapsed=t.target;t.startedAt=null;t.warned=true;
 if(save()){render();note('Intervalo terminado. Puedes finalizar o aparcar la actividad.');if(!$('assistant-stop-dialog').open)showStop();}
}
function renderTimer(){
 const t=state.timer,running=t&&t.startedAt!==null;
 $('assistant-clock').textContent=clock(timerSeconds());
 $('assistant-timer-state').textContent=!t?'Sin actividad en curso.':running?'Trabajando en: '+t.title:t.warned?'Tiempo previsto cumplido: puedes aparcarla.':'En pausa: '+t.title;
 $('assistant-start').textContent=t?'Reanudar':'Iniciar';
 $('assistant-start').disabled=locked||!!running||!!(t&&t.elapsed>=t.target);
 $('assistant-pause').disabled=locked||!running;
 $('assistant-finish').disabled=locked||!t;
 $('assistant-park').disabled=locked||!t;
 ['assistant-timer-title','assistant-timer-area','assistant-project','assistant-duration'].forEach(id=>$(id).disabled=!!t);
 if(t){$('assistant-timer-title').value=t.title;$('assistant-timer-area').value=t.area;$('assistant-duration').value=String(t.target/60);$('assistant-project').value=t.projectId||'';}
}
$('assistant-start').addEventListener('click',()=>{
 if(state.timer){state.timer.startedAt=Date.now();commitRender('Temporizador reanudado.');return;}
 const title=$('assistant-timer-title').value.trim()||activeItem()?.text||'',area=$('assistant-timer-area').value,target=Number($('assistant-duration').value)*60;
 if(!title||title.length>120){note('Escribe el nombre de la actividad o selecciona una prioridad.');return;}
 if(!AREAS.includes(area)||![300,600,900,1500,2700].includes(target))return;
 // Un título de captura puede superar el límite visual de 120 caracteres.
 const matched=preparedTaskId&&title===preparedTitle
  ?state.items.find(x=>!x.done&&x.id===preparedTaskId)
  :state.items.find(x=>!x.done&&x.text===title);
 preparedTaskId=null;preparedTitle='';
 state.timer={title,area,target,elapsed:0,startedAt:Date.now(),warned:false,taskId:matched?.id||null,projectId:$('assistant-project').value||matched?.projectId||null};
 commitRender('Temporizador iniciado.');
});
$('assistant-pause').addEventListener('click',pauseTimer);
$('assistant-finish').addEventListener('click',()=>{if(state.timer)registerTimer(false);});
$('assistant-park').addEventListener('click',showStop);
$('assistant-manual').addEventListener('submit',e=>{
 e.preventDefault();const f=e.target.elements,title=f.title.value.trim(),area=f.area.value,date=f.date.value,mins=Number(f.mins.value);
 if(!title||title.length>120||!AREAS.includes(area)||!validDate(date)||!Number.isInteger(mins)||mins<1||mins>1440){note('Revisa la actividad, fecha y duración.');return;}
 state.sessions.push({id:uid(),title,area,date,seconds:mins*60,source:'manual',...(f.project.value?{projectId:f.project.value}:{})});
 if(save()){e.target.reset();e.target.elements.date.value=localDay();render();note('Tiempo añadido correctamente.');}
});
$('assistant-period').addEventListener('change',render);
function periodRange(){
 const now=new Date(),d=new Date(now.getFullYear(),now.getMonth(),now.getDate()),mode=$('assistant-period').value;
 if(mode==='week')d.setDate(d.getDate()-(d.getDay()+6)%7);
 if(mode==='month')d.setDate(1);
 const end=new Date(d);
 if(mode==='day')end.setDate(end.getDate()+1);
 if(mode==='week')end.setDate(end.getDate()+7);
 if(mode==='month')end.setMonth(end.getMonth()+1);
 return [localDay(d),localDay(end)];
}
function renderProductivity(){
 const [start,end]=periodRange(),sessions=state.sessions.filter(s=>s.date>=start&&s.date<end);
 const total=sessions.reduce((n,s)=>n+s.seconds,0),rest=sessions.filter(s=>s.area==='Descanso').reduce((n,s)=>n+s.seconds,0);
 $('assistant-total').textContent=minutes(total);$('assistant-rest').textContent=minutes(rest);$('assistant-activity').textContent=minutes(total-rest);
 const sums=AREAS.map(a=>({area:a,seconds:sessions.filter(s=>s.area===a).reduce((n,s)=>n+s.seconds,0)})).filter(x=>x.seconds);
 const chart=$('assistant-chart');chart.replaceChildren();
 if(!sums.length)chart.append(el('p','assistant-muted','No hay actividades registradas para este periodo.'));
 const max=Math.max(1,...sums.map(x=>x.seconds));
 sums.sort((a,b)=>b.seconds-a.seconds).forEach(x=>{
  const wrap=el('div'),label=el('div','assistant-chart-line'),track=el('div','assistant-chart-track'),fill=el('div','assistant-chart-fill');
  label.append(el('span','',x.area),el('strong','',minutes(x.seconds)));fill.style.width=(100*x.seconds/max).toFixed(1)+'%';
  track.append(fill);wrap.append(label,track);chart.append(wrap);
 });
 const hist=$('assistant-history');hist.replaceChildren();
 if(!sessions.length)hist.append(el('p','assistant-muted','Sin sesiones registradas.'));
 sessions.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30).forEach(s=>{
  const row=el('div','assistant-history-row'),text=el('span','',s.date.split('-').reverse().join('/')+' · '+s.title+' · '+s.area+' · '+minutes(s.seconds));
  row.append(text,linkBtn('Eliminar',()=>{if(!confirm('¿Eliminar este tiempo registrado?'))return;state.sessions=state.sessions.filter(x=>x.id!==s.id);commitRender('Sesión eliminada.');}));
  hist.append(row);
 });
}
function render(){renderTasks();renderTimer();renderProductivity();updateAvailability();}
window.RumboAssistant={
 getSnapshot:()=>JSON.parse(JSON.stringify(state)),
 getTimerSnapshot:()=>state.timer?{...state.timer,seconds:timerSeconds()}:null,
 addTask:(text,projectId)=>{
  const title=String(text||'').trim();
  if(locked||!title||title.length>1000)return false;
  const item={id:uid(),text:title,done:false,nextStep:'',createdAt:new Date().toISOString()};
  if(typeof projectId==='string'&&projectId)item.projectId=projectId;
  state.items.push(item);
  if(!save()){state.items.pop();return false;}
  render();note('Siguiente paso añadido a tu bandeja.');
  return true;
 }
};
function download(filename,data,type){const b=new Blob([data],{type}),url=URL.createObjectURL(b),a=el('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('assistant-export-json').addEventListener('click',()=>download('rumbo-asistente.json',JSON.stringify(state,null,2),'application/json'));
const csvCell=value=>{let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
$('assistant-export-csv').addEventListener('click',()=>{
 const lines=[['fecha','actividad','area','minutos','origen'],...state.sessions.map(s=>[s.date,s.title,s.area,Math.round(s.seconds/60),s.source])];
 download('rumbo-productividad.csv','\ufeff'+lines.map(r=>r.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');
});
$('assistant-import').addEventListener('change',async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file)return;
 try{
  if(file.size>5*1024*1024)throw Error('Archivo demasiado grande');
  const incoming=JSON.parse(await file.text());if(!valid(incoming))throw Error('La copia no tiene la estructura esperada');
  if(!confirm('Se incorporarán tareas y sesiones nuevas sin borrar los registros actuales. ¿Continuar?'))return;
  const existingIds=new Set(state.items.map(x=>x.id)),existingSessions=new Set(state.sessions.map(x=>x.id));
  const items=[...state.items,...incoming.items.filter(x=>!existingIds.has(x.id))];
  const sessions=[...state.sessions,...incoming.sessions.filter(x=>!existingSessions.has(x.id))];
  const old=state;state={...state,items,sessions,priorityIds:[...new Set([...state.priorityIds,...incoming.priorityIds.filter(id=>items.some(x=>x.id===id&&!x.done))])].slice(0,3)};
  if(!valid(state)||!save()){state=old;throw Error('No se pudo guardar la copia');}
  render();note('Copia incorporada. No se reemplazaron tareas ni sesiones existentes.');
 }catch(err){note('No se pudo importar: '+err.message);}
});
render();
if(locked)note('Almacenamiento incompatible: no se sobrescribirán los datos existentes.');
if(state.timer&&state.timer.startedAt!==null&&timerSeconds()>=state.timer.target)expiry();
else if(state.timer?.warned)note('Quedó una actividad sin finalizar. Puedes aparcarla cuando quieras.');
setInterval(()=>{if(state.timer&&state.timer.startedAt!==null){expiry();renderTimer();}updateAvailability();},1000);
})();