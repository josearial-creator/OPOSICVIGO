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
let state={version:1,items:[],priorityIds:[],sessions:[],timer:null,energy:'media',event:{title:'',at:''}},locked=false;
try{const saved=localStorage.getItem(KEY);if(saved){let p=JSON.parse(saved);if(!valid(p))throw Error('invalid');state=p;}}catch{locked=true;}
function note(s){$('assistant-message').textContent=s;}
function save(){if(locked){note('Hay una copia incompatible guardada. No la sobrescribiré; exporta los datos antes de continuar.');return false;}try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{note('No se pudo guardar. Revisa el almacenamiento del navegador.');return false;}}
function option(s,v){const x=el('option','',s);x.value=v===undefined?s:v;return x;}
function selectAreas(id){AREAS.forEach(a=>$(id).add(option(a)));}
function linkBtn(label,fn,style='secondary'){const x=el('button','button '+style,label);x.type='button';x.addEventListener('click',fn);return x;}
home.innerHTML=[
'<div class="assistant-head"><div><div class="eyebrow">UN PASO CADA VEZ</div><h2>Mi día</h2><p id="assistant-date"></p></div><a class="button secondary" href="#productividad">Empezar un bloque</a></div>',
'<div class="assistant-body"><div class="assistant-grid"><div class="assistant-card"><h3>Mis tres prioridades como máximo</h3>',
'<div id="assistant-priorities"></div><button id="assistant-what" type="button" class="button primary">¿Qué hago ahora?</button>',
'<div id="assistant-advice" class="assistant-recommendation" aria-live="polite">Una acción pequeña es suficiente para empezar.</div></div>',
'<div class="assistant-card"><h3>Captura rápida</h3><form id="assistant-capture" class="assistant-inline"><label>Escribe lo que necesitas recordar<input name="text" maxlength="1000" required placeholder="Ej.: Llamar al médico, preparar una entrevista..."></label><button class="button primary" type="submit">Guardar</button></form>',
'<p class="assistant-muted">Se guarda sin clasificar y sin enviar el texto a IA. Puedes organizarlo más tarde.</p>',
'<div class="assistant-inline"><label>Mi energía<select id="assistant-energy"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select></label>',
'<label>Próximo compromiso (opcional)<input type="datetime-local" id="assistant-event-at"></label></div>',
'<label style="margin-top:9px">Compromiso (opcional)<input id="assistant-event-title" maxlength="120" placeholder="Ej.: Recoger a los niños"></label>',
'<div class="assistant-status" id="assistant-time-available"></div></div></div>',
'<details class="assistant-inbox-details"><summary id="assistant-inbox-count">Bandeja de entrada</summary><div id="assistant-inbox"></div></details>',
'<p class="assistant-status" id="assistant-message" role="status" aria-live="polite"></p></div>'
].join('');
prod.innerHTML=[
'<div class="assistant-head"><div><div class="eyebrow">SIN PRESIÓN POR COMPLETARLO TODO</div><h2>Productividad</h2><p>Registra lo que haces, cuenta también el descanso y termina cuando lo necesites.</p></div></div>',
'<div class="assistant-body"><div class="assistant-grid"><div class="assistant-card">',
'<h3>Temporizador</h3><label>Actividad<input id="assistant-timer-title" maxlength="120" placeholder="Ej.: Preparar oposición"></label>',
'<div class="assistant-inline"><label>Área<select id="assistant-timer-area"></select></label>',
'<label>Duración<select id="assistant-duration"><option value="5">5 minutos</option><option value="10">10 minutos</option><option value="15" selected>15 minutos</option><option value="25">25 minutos</option><option value="45">45 minutos</option></select></label></div>',
'<div id="assistant-clock" class="assistant-clock">00:00:00</div><div id="assistant-timer-state" class="assistant-timer-state">El cronómetro empieza cuando tú quieras.</div>',
'<div class="assistant-button-row"><button id="assistant-start" class="button primary" type="button">Iniciar</button><button id="assistant-pause" class="button secondary" type="button">Pausar</button><button id="assistant-finish" class="button secondary" type="button">Finalizar</button><button id="assistant-park" class="button secondary" type="button">Aparcar actividad</button></div>',
'<p class="assistant-muted">Se detiene al completar el intervalo y te ofrece guardar el siguiente paso. Si sales de la página, se contabiliza hasta el límite previsto, nunca más.</p></div>',
'<div class="assistant-card"><h3>Añadir tiempo manualmente</h3><form id="assistant-manual">',
'<label>Actividad<input name="title" required maxlength="120" placeholder="Ej.: Organización del hogar"></label>',
'<div class="assistant-inline"><label>Área<select name="area" id="assistant-manual-area"></select></label><label>Fecha<input name="date" type="date" required></label><label>Minutos<input name="mins" type="number" min="1" max="1440" step="1" required></label></div>',
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
$('assistant-manual').elements.date.value=localDay();
$('assistant-date').textContent=new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
$('assistant-energy').value=state.energy;
$('assistant-event-at').value=state.event.at;
$('assistant-event-title').value=state.event.title;
function activeItem(){return state.priorityIds.map(id=>state.items.find(x=>x.id===id&&!x.done)).find(Boolean)||state.items.find(x=>!x.done);}
function updateAvailability(){
 const at=state.event.at,when=at?new Date(at).getTime():NaN,n=Math.ceil((when-Date.now())/60000);
 const output=$('assistant-time-available');
 output.textContent=!Number.isFinite(n)?'Sin próximo compromiso registrado.':n>0?'Quedan '+n+' min hasta '+(state.event.title||'el próximo compromiso')+'.':'El próximo compromiso registrado ya ha llegado o ha pasado.';
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
}
function commitRender(msg){if(save()){render();if(msg)note(msg);}}
function renderTasks(){
 const p=$('assistant-priorities');p.replaceChildren();
 const ids=state.priorityIds.filter(id=>state.items.some(t=>t.id===id&&!t.done));
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
  buttons.append(linkBtn('Hecha',()=>{t.done=true;state.priorityIds=state.priorityIds.filter(id=>id!==t.id);commitRender('Tarea marcada como hecha.');}));
  buttons.append(linkBtn('Eliminar',()=>{if(confirm('¿Eliminar este elemento de la bandeja?')){state.items=state.items.filter(x=>x.id!==t.id);state.priorityIds=state.priorityIds.filter(id=>id!==t.id);commitRender('Elemento eliminado.');}}));
  row.append(label,buttons);inbox.append(row);
 });
}
$('assistant-capture').addEventListener('submit',e=>{e.preventDefault();const input=e.target.elements.text,text=input.value.trim();
 if(!text)return;
 state.items.push({id:uid(),text,done:false,nextStep:'',createdAt:new Date().toISOString()});
 if(save()){input.value='';render();note('Guardado en tu bandeja. Puedes organizarlo cuando quieras.');}
});
$('assistant-energy').addEventListener('change',e=>{state.energy=e.target.value;commitRender();});
['assistant-event-at','assistant-event-title'].forEach(id=>$(id).addEventListener('change',()=>{
 state.event={at:$('assistant-event-at').value,title:$('assistant-event-title').value.slice(0,120)};
 commitRender();updateAvailability();
}));
$('assistant-what').addEventListener('click',chooseAdvice);
$('assistant-timer-area').value='Estudio y oposiciones';
function timerSeconds(t=state.timer){if(!t)return 0;return Math.min(t.target,t.elapsed+(t.startedAt===null?0:Math.max(0,Math.floor((Date.now()-t.startedAt)/1000))));}
function pauseTimer(){const t=state.timer;if(!t||t.startedAt===null)return;t.elapsed=timerSeconds(t);t.startedAt=null;commitRender('Temporizador en pausa.');}
function registerTimer(markDone){
 const t=state.timer,seconds=t?timerSeconds(t):0;
 if(t&&seconds>=60)state.sessions.push({id:uid(),title:t.title,area:t.area,date:localDay(),seconds,source:'temporizador'});
 if(t&&t.taskId&&markDone){const task=state.items.find(x=>x.id===t.taskId);if(task)task.done=true;state.priorityIds=state.priorityIds.filter(id=>id!==t.taskId);}
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
 if(t&&seconds>=60)state.sessions.push({id:uid(),title:t.title,area:t.area,date:localDay(),seconds,source:'temporizador'});
 const existing=t?.taskId?state.items.find(x=>x.id===t.taskId):state.items.find(x=>!x.done&&x.text===title);
 if(existing){existing.done=false;if(step)existing.nextStep=step;}
 else{state.items.push({id:uid(),text:title||step,done:false,nextStep:step,createdAt:new Date().toISOString()});}
 state.timer=null;
 if(save()){render();$('assistant-stop-dialog').close();note('Actividad aparcada. El siguiente paso queda guardado.');}
}
$('stop-park').addEventListener('click',parkActivity);
$('stop-done').addEventListener('click',()=>{
 const t=state.timer;
 if(!t){const a=state.items.find(x=>!x.done&&x.text===$('stop-current').value.trim());if(a){a.done=true;state.priorityIds=state.priorityIds.filter(id=>id!==a.id);commitRender('Tarea terminada.');}}
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
 ['assistant-timer-title','assistant-timer-area','assistant-duration'].forEach(id=>$(id).disabled=!!t);
 if(t){$('assistant-timer-title').value=t.title;$('assistant-timer-area').value=t.area;$('assistant-duration').value=String(t.target/60);}
}
$('assistant-start').addEventListener('click',()=>{
 if(state.timer){state.timer.startedAt=Date.now();commitRender('Temporizador reanudado.');return;}
 const title=$('assistant-timer-title').value.trim()||activeItem()?.text||'',area=$('assistant-timer-area').value,target=Number($('assistant-duration').value)*60;
 if(!title||title.length>120){note('Escribe el nombre de la actividad o selecciona una prioridad.');return;}
 if(!AREAS.includes(area)||![300,600,900,1500,2700].includes(target))return;
 const matched=state.items.find(x=>!x.done&&x.text===title);
 state.timer={title,area,target,elapsed:0,startedAt:Date.now(),warned:false,taskId:matched?.id||null};
 commitRender('Temporizador iniciado.');
});
$('assistant-pause').addEventListener('click',pauseTimer);
$('assistant-finish').addEventListener('click',()=>{if(state.timer)registerTimer(false);});
$('assistant-park').addEventListener('click',showStop);
$('assistant-manual').addEventListener('submit',e=>{
 e.preventDefault();const f=e.target.elements,title=f.title.value.trim(),area=f.area.value,date=f.date.value,mins=Number(f.mins.value);
 if(!title||title.length>120||!AREAS.includes(area)||!validDate(date)||!Number.isInteger(mins)||mins<1||mins>1440){note('Revisa la actividad, fecha y duración.');return;}
 state.sessions.push({id:uid(),title,area,date,seconds:mins*60,source:'manual'});
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