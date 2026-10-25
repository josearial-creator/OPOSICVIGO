(() => {
'use strict';
const projectsRoot=document.getElementById('proyectos');
const metricsRoot=document.getElementById('metricas-personales');
if(!projectsRoot||!metricsRoot)return;
const KEY='rumbo-organizacion-v1';
const AREAS=['Trabajo y empleo','Estudio y oposiciones','Familia','Salud y ejercicio','Hogar y gestiones','Proyectos personales','Descanso'];
const PRIORITY=['Alta','Media','Baja'], STATUSES=['Activo','En pausa','Terminado'];
const $=id=>document.getElementById(id);
const make=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e;};
const btn=(text,action,style='secondary')=>{const b=make('button','button '+style,text);b.type='button';b.addEventListener('click',action);return b;};
const option=(text,val)=>{const n=make('option','',text);n.value=val===undefined?text:val;return n;};
const today=(d=new Date())=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const uuid=()=>crypto.randomUUID();
const formatMin=s=>{let m=Math.round(s/60);return m>=60?Math.floor(m/60)+' h '+m%60+' min':m+' min';};
function validDay(t){if(typeof t!=='string'||!/^\d{4}-\d\d-\d\d$/.test(t))return false;const [y,m,d]=t.split('-').map(Number);const a=new Date(Date.UTC(y,m-1,d));return a.getUTCFullYear()===y&&a.getUTCMonth()===m-1&&a.getUTCDate()===d;}
function monday(d=new Date()){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-(x.getDay()+6)%7);return today(x);}
const short=(s,max)=>typeof s==='string'&&s.length<=max;
const dateTime=s=>typeof s==='string'&&Number.isFinite(new Date(s).getTime());
function validate(d){
 const project=p=>p&&short(p.id,100)&&short(p.name,120)&&p.name.trim()&&AREAS.includes(p.area)&&short(p.next,250)&&STATUSES.includes(p.status)&&PRIORITY.includes(p.priority)&&(!p.due||validDay(p.due))&&dateTime(p.createdAt)&&Array.isArray(p.history)&&p.history.length<=500&&p.history.every(h=>h&&short(h.id,100)&&short(h.text,300)&&dateTime(h.at));
 const review=r=>r&&validDay(r.date)&&short(r.achieved,400)&&short(r.pending,400)&&short(r.tomorrow,400)&&(r.activation===null||(Number.isInteger(r.activation)&&r.activation>=0&&r.activation<=10));
 const plan=p=>p&&validDay(p.week)&&short(p.focus,240);
 const park=p=>p&&short(p.id,100)&&dateTime(p.at)&&short(p.title,120);
 return d?.version===1&&Array.isArray(d.projects)&&d.projects.length<=1000&&d.projects.every(project)&&Array.isArray(d.reviews)&&d.reviews.length<=2000&&d.reviews.every(review)&&Array.isArray(d.plans)&&d.plans.length<=500&&d.plans.every(plan)&&Array.isArray(d.parks)&&d.parks.length<=10000&&d.parks.every(park);
}
let state={version:1,projects:[],reviews:[],plans:[],parks:[]},locked=false;
try{const raw=localStorage.getItem(KEY);if(raw){const p=JSON.parse(raw);if(!validate(p))throw Error('invalid');state=p;}}catch{locked=true;}
function status(text){$('org-status').textContent=text;}
function save(){if(locked){status('No se ha sobrescrito una copia que no se puede leer. Exporta tus datos antes de modificarla.');return false;}try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{status('No se pudieron guardar los cambios. Comprueba el almacenamiento del navegador.');return false;}}
function projects(){return state.projects.map(p=>({id:p.id,name:p.name,area:p.area,status:p.status}));}
window.RumboOrganization={listProjects:projects};
const getAssistant=()=>{
 try{return window.RumboAssistant?.getSnapshot?.()||{items:[],sessions:[],priorityIds:[]};}
 catch{return {items:[],sessions:[],priorityIds:[]};}
};
function areaSelect(id){AREAS.forEach(s=>$(id).append(option(s)));}
function period(mode){
 const d=new Date(),start=new Date(d.getFullYear(),d.getMonth(),d.getDate());
 if(mode==='week')start.setDate(start.getDate()-(start.getDay()+6)%7);
 if(mode==='month')start.setDate(1);
 const end=new Date(start);
 if(mode==='day')end.setDate(end.getDate()+1);
 if(mode==='week')end.setDate(end.getDate()+7);
 if(mode==='month')end.setMonth(end.getMonth()+1);
 return {start:today(start),end:today(end)};
}
function inPeriod(t,r){return t>=r.start&&t<r.end;}
function titleDate(s){return s.split('-').reverse().join('/');}
projectsRoot.innerHTML=[
 '<div class="assistant-head"><div><div class="eyebrow">ORGANIZAR SIN MULTIPLICAR TAREAS</div><h2>Proyectos y planificación</h2><p>Un proyecto, un siguiente paso. No es necesario completarlo hoy.</p></div></div>',
 '<div class="assistant-body"><div class="org-summary" id="org-summary"></div>',
 '<div class="org-two-columns"><div class="assistant-card">',
 '<h3>Mis proyectos</h3><p class="assistant-muted">Guarda solamente lo que quieras seguir de cerca. El tiempo se suma solo si asignas un bloque a este proyecto.</p>',
 '<div id="org-projects"></div><details class="org-collapsible" id="org-new-project"><summary>+ Añadir proyecto</summary>',
 '<form id="org-project-form" class="org-form"><label>Objetivo<input name="name" required maxlength="120" placeholder="Ej.: Preparar una entrevista"></label>',
 '<label>Siguiente paso (10–15 minutos)<input name="next" maxlength="250" placeholder="Ej.: Escribir tres respuestas"></label>',
 '<div class="org-pair"><label>Área<select id="org-area" name="area"></select></label><label>Prioridad<select name="priority"><option>Media</option><option>Alta</option><option>Baja</option></select></label></div>',
 '<label>Fecha límite (solo si existe)<input name="due" type="date"></label><button type="submit" class="button primary">Guardar proyecto</button></form></details></div>',
 '<div class="assistant-card"><h3>Mi planificación</h3><p id="org-today-priorities" class="assistant-muted"></p>',
 '<a class="button secondary" href="#mi-dia">Elegir prioridades en Mi día</a>',
 '<details class="org-collapsible" id="org-daily-review"><summary>Revisión de hoy · 2 minutos</summary><form id="org-review-form" class="org-form">',
 '<label>¿Qué he conseguido?<input name="achieved" maxlength="400" placeholder="Una cosa basta"></label>',
 '<label>¿Qué queda pendiente?<input name="pending" maxlength="400" placeholder="Puedes dejarlo para después"></label>',
 '<label>¿Qué puedo dejar para mañana?<input name="tomorrow" maxlength="400"></label>',
 '<label>Activación percibida (opcional, 0–10)<select name="activation" id="org-activation"><option value="">Sin registrar</option></select></label>',
 '<button class="button primary" type="submit">Guardar revisión</button></form></details>',
 '<details class="org-collapsible" id="org-week-plan"><summary>Un foco para esta semana</summary><form id="org-week-form" class="org-form">',
 '<label>¿Qué merece atención esta semana?<input name="focus" maxlength="240" placeholder="Solo una intención concreta"></label>',
 '<button class="button primary" type="submit">Guardar foco</button></form></details>',
 '<p id="org-week-summary" class="assistant-muted"></p></div></div>',
 '<div class="assistant-tools"><button type="button" class="button secondary" id="org-export">Exportar organización JSON</button>',
 '<label class="button secondary">Importar organización<input type="file" accept=".json,application/json" id="org-import" hidden></label></div>',
 '<p class="assistant-status" id="org-status" role="status" aria-live="polite"></p></div>'
].join('');
metricsRoot.innerHTML=[
 '<div class="assistant-head"><div><div class="eyebrow">DATOS REALES, SIN PUNTUACIONES INVENTADAS</div><h2>Mi evolución · organización</h2>',
 '<p>Las medidas de actividad se diferencian de cómo te sientes. Sin registrar no significa cero capacidad.</p></div></div>',
 '<div class="assistant-body"><label class="org-period-label">Periodo<select id="org-period"><option value="day">Hoy</option><option value="week" selected>Esta semana</option><option value="month">Este mes</option></select></label>',
 '<div class="org-metric-grid" id="org-metrics"></div><h3 class="org-visual-title">Tiempo por áreas</h3>',
 '<div class="assistant-category-chart" id="org-time-chart"></div>',
 '<p class="assistant-muted">Tareas completadas: se cuenta la fecha de finalización cuando está disponible. Paradas: se cuentan las actividades aparcadas, no se mide una capacidad psicológica. Evaluación de atención: solo ejercicios prácticos; no es una prueba clínica.</p></div>'
].join('');
for(let n=0;n<=10;n++)$('org-activation').add(option(String(n),String(n)));
areaSelect('org-area');
function syncAssistant(){
 const a=getAssistant(),prior=a.priorityIds.map(id=>a.items.find(t=>t.id===id&&!t.done)).filter(Boolean).slice(0,3);
 const hint=prior.length?prior.map(x=>x.nextStep||x.text).join(' · '):'No has elegido prioridades hoy. Puedes hacerlo en «Mi día» sin añadir tareas nuevas.';
 $('org-today-priorities').textContent='Prioridades actuales: '+hint;
 const r=period('week'),ses=a.sessions.filter(x=>inPeriod(x.date,r));
 const taskCount=a.items.filter(t=>t.doneAt&&inPeriod(t.doneAt.slice(0,10),r)).length;
 $('org-week-summary').textContent='Esta semana: '+ses.length+' bloques registrados y '+taskCount+' tareas finalizadas con fecha. No hay obligación de alcanzar ninguna cifra.';
}
function projectTime(id){
 const a=getAssistant();
 return a.sessions.filter(s=>s.projectId===id).reduce((sum,s)=>sum+s.seconds,0);
}
function renderProjects(){
 const box=$('org-projects');box.replaceChildren();
 const ordered=state.projects.slice().sort((a,b)=>STATUSES.indexOf(a.status)-STATUSES.indexOf(b.status)||PRIORITY.indexOf(a.priority)-PRIORITY.indexOf(b.priority)||a.createdAt.localeCompare(b.createdAt));
 if(!ordered.length)box.append(make('p','assistant-muted','Aún no hay proyectos. Añade uno cuando te ayude a tener claro el siguiente paso.'));
 ordered.forEach(p=>{
  const card=make('article','org-project'),heading=make('div','org-project-heading');
  heading.append(make('strong','',p.name),make('span','assistant-pill',p.status));
  card.append(heading,make('p','assistant-muted',p.area+' · Prioridad '+p.priority+(p.due?' · Fecha límite '+titleDate(p.due):'')));
  card.append(make('p','', 'Siguiente paso: '+(p.next||'Por definir (opcional)')));
  card.append(make('p','assistant-muted','Tiempo asignado: '+formatMin(projectTime(p.id))+' · '+p.history.length+' avances anotados'));
  const row=make('div','org-actions');
  if(p.next&&p.status==='Activo')row.append(btn('Llevar a Mi día',()=>{
    const ok=window.RumboAssistant?.addTask?.(p.next,p.id);
    status(ok?'Paso enviado a la bandeja de Mi día. Elige allí si debe ser prioridad.':'No se pudo añadir. Comprueba el almacenamiento del navegador.');
  }));
  if(p.status!=='Terminado')row.append(btn('Terminar',()=>{p.status='Terminado';if(save()){renderAll();notify();status('Proyecto marcado como terminado.');}}));
  if(p.status==='Activo')row.append(btn('Aparcar',()=>{p.status='En pausa';if(save()){renderAll();notify();status('Proyecto aparcado.');}}));
  if(p.status==='En pausa')row.append(btn('Reanudar',()=>{p.status='Activo';if(save()){renderAll();notify();status('Proyecto reanudado.');}}));
  const details=make('details','org-collapsible'),summary=make('summary','', 'Editar o registrar avance');details.append(summary);
  const form=make('form','org-form'),editLabel=make('label','', 'Siguiente paso pequeño'),next=make('input');
  next.name='next';next.maxLength=250;next.value=p.next;editLabel.append(next);
  const priorityLabel=make('label','', 'Prioridad'),priority=make('select');
  priority.name='priority';PRIORITY.forEach(v=>priority.append(option(v)));priority.value=p.priority;priorityLabel.append(priority);
  const dueLabel=make('label','', 'Fecha límite (opcional)'),due=make('input');
  due.type='date';due.name='due';due.value=p.due;dueLabel.append(due);
  const progressLabel=make('label','', 'Avance realizado (opcional)'),progress=make('input');
  progress.name='progress';progress.maxLength=300;progress.placeholder='Ej.: Ya repasé el primer bloque';progressLabel.append(progress);
  form.append(editLabel,priorityLabel,dueLabel,progressLabel);
  const saveButton=make('button','button primary','Guardar cambios');saveButton.type='submit';form.append(saveButton);
  form.addEventListener('submit',e=>{
   e.preventDefault();const n=next.value.trim(),pr=progress.value.trim();
   if(due.value&&!validDay(due.value)){status('Revisa la fecha límite.');return;}
   p.next=n;p.priority=priority.value;p.due=due.value;
   if(pr)p.history.push({id:uuid(),at:new Date().toISOString(),text:pr});
   if(save()){renderAll();status('Proyecto actualizado.');}
  });
  details.append(form);
  if(p.history.length){
   const history=make('details','org-collapsible'),hlabel=make('summary','', 'Historial ('+p.history.length+')');history.append(hlabel);
   p.history.slice().reverse().slice(0,10).forEach(h=>history.append(make('p','assistant-muted',new Date(h.at).toLocaleDateString('es-ES')+' · '+h.text)));
   details.append(history);
  }
  row.append(details,btn('Eliminar',()=>{
   if(!confirm('¿Eliminar este proyecto? Los registros de tiempo seguirán guardados en Productividad.'))return;
   state.projects=state.projects.filter(x=>x.id!==p.id);
   if(save()){renderAll();notify();status('Proyecto eliminado; los bloques de tiempo anteriores se conservan.');}
  }));
  card.append(row);box.append(card);
 });
 const summary=$('org-summary');summary.replaceChildren();
 const active=state.projects.filter(p=>p.status==='Activo').length;
 summary.append(make('span','assistant-pill','Proyectos activos: '+active));
 summary.append(make('span','assistant-pill','Máximo tres prioridades en Mi día'));
}
function renderReview(){
 const r=state.reviews.find(x=>x.date===today()),f=$('org-review-form').elements;
 f.achieved.value=r?.achieved||'';f.pending.value=r?.pending||'';f.tomorrow.value=r?.tomorrow||'';f.activation.value=r?.activation===null||r?.activation===undefined?'':String(r.activation);
 const p=state.plans.find(x=>x.week===monday());
 $('org-week-form').elements.focus.value=p?.focus||'';
}
function loadEvolution(){
 try{
  const x=JSON.parse(localStorage.getItem('rumbo-evolucion-v1')||'null');
  return x?.version===1&&Array.isArray(x.sessions)?x.sessions:[];
 }catch{return [];}
}
function metric(title,value,caption){
 const n=make('article','org-metric');n.append(make('span','',title),make('strong','',value),make('small','',caption));return n;
}
function renderMetrics(){
 const range=period($('org-period').value), a=getAssistant();
 const sessions=a.sessions.filter(s=>inPeriod(s.date,range));
 const total=sessions.reduce((n,s)=>n+s.seconds,0),rest=sessions.filter(s=>s.area==='Descanso').reduce((n,s)=>n+s.seconds,0);
 const done=a.items.filter(x=>x.doneAt&&inPeriod(x.doneAt.slice(0,10),range)).length;
 const parks=state.parks.filter(x=>inPeriod(x.at.slice(0,10),range)).length;
 const reviews=state.reviews.filter(r=>inPeriod(r.date,range)&&r.activation!==null);
 const act=reviews.length?(reviews.reduce((s,r)=>s+r.activation,0)/reviews.length).toFixed(1).replace('.',',')+'/10':'—';
 const attention=loadEvolution().flatMap(s=>(s.date&&inPeriod(s.date.slice(0,10),range)&&s.source!=='aportada'&&s.completed)?(s.exercises||[]):[])
   .map(e=>e.skills?.[0]).filter(x=>Number.isFinite(x));
 const att=attention.length?(attention.reduce((a,b)=>a+b,0)/attention.length).toFixed(0)+'/100':'—';
 const selectedPriority=a.priorityIds.filter(id=>a.items.some(x=>x.id===id&&!x.done)).length;
 const grid=$('org-metrics');grid.replaceChildren(
  metric('Gestión del tiempo',formatMin(total),'Minutos registrados'),
  metric('Tareas terminadas',String(done),'Finalizaciones con fecha'),
  metric('Paradas registradas',String(parks),'Actividades aparcadas'),
  metric('Organización',String(selectedPriority)+'/3','Prioridades actuales, no puntuación'),
  metric('Activación declarada',act,reviews.length+' revisión(es) voluntarias'),
  metric('Atención en simulaciones',att,attention.length+' ejercicio(s) evaluados'),
  metric('Actividad',formatMin(total-rest),'Sin descanso'),
  metric('Descanso registrado',formatMin(rest),'Solo sesiones anotadas')
 );
 const chart=$('org-time-chart');chart.replaceChildren();
 const sums=AREAS.map(area=>({area,sec:sessions.filter(s=>s.area===area).reduce((n,s)=>n+s.seconds,0)})).filter(x=>x.sec>0).sort((a,b)=>b.sec-a.sec);
 if(!sums.length)chart.append(make('p','assistant-muted','Aún no hay tiempo registrado para este periodo.'));
 const max=Math.max(1,...sums.map(x=>x.sec));
 sums.forEach(x=>{
  const line=make('div','org-chart-item'),title=make('div','assistant-chart-line'),bar=make('div','assistant-chart-track'),fill=make('div','assistant-chart-fill');
  title.append(make('span','',x.area),make('strong','',formatMin(x.sec)));
  fill.style.width=(100*x.sec/max).toFixed(1)+'%';bar.append(fill);line.append(title,bar);chart.append(line);
 });
}
function renderAll(){renderProjects();syncAssistant();renderReview();renderMetrics();}
function notify(){window.dispatchEvent(new Event('rumbo:projects-updated'));}
$('org-project-form').addEventListener('submit',e=>{
 e.preventDefault();if(locked){status('Los datos guardados necesitan revisión antes de crear nuevos.');return;}
 const f=e.target.elements,name=f.name.value.trim(),next=f.next.value.trim(),due=f.due.value;
 if(!name||name.length>120||next.length>250||(due&&!validDay(due))){status('Comprueba los datos del proyecto.');return;}
 const p={id:uuid(),name,area:f.area.value,next,priority:f.priority.value,due,status:'Activo',createdAt:new Date().toISOString(),history:[]};
 state.projects.push(p);
 if(save()){e.target.reset();renderAll();notify();$('org-new-project').open=false;status('Proyecto guardado. Solo tienes que tener claro el siguiente paso.');}
});
$('org-review-form').addEventListener('submit',e=>{
 e.preventDefault();const f=e.target.elements;
 const r={date:today(),achieved:f.achieved.value.trim(),pending:f.pending.value.trim(),tomorrow:f.tomorrow.value.trim(),activation:f.activation.value===''?null:Number(f.activation.value)};
 if(!validate({...state,reviews:[r]})){status('Revisa tu anotación.');return;}
 state.reviews=state.reviews.filter(x=>x.date!==r.date).concat(r);
 if(save()){renderAll();$('org-daily-review').open=false;status('Revisión guardada. Lo pendiente puede esperar a mañana.');}
});
$('org-week-form').addEventListener('submit',e=>{
 e.preventDefault();const focus=e.target.elements.focus.value.trim();
 state.plans=state.plans.filter(x=>x.week!==monday()).concat({week:monday(),focus});
 if(save()){renderAll();$('org-week-plan').open=false;status('Foco de la semana guardado.');}
});
$('org-period').addEventListener('change',renderMetrics);
window.addEventListener('rumbo:assistant-changed',()=>{syncAssistant();renderProjects();renderMetrics();});
window.addEventListener('rumbo:activity-parked',e=>{
 if(locked)return;const title=String(e.detail?.title||'').slice(0,120);
 state.parks.push({id:uuid(),at:e.detail?.at||new Date().toISOString(),title});
 if(save())renderMetrics();
});
function download(name,content){const blob=new Blob([content],{type:'application/json'}),link=make('a'),url=URL.createObjectURL(blob);
 link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
$('org-export').addEventListener('click',()=>download('rumbo-organizacion.json',JSON.stringify(state,null,2)));
$('org-import').addEventListener('change',async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file)return;
 try{
  if(file.size>5e6)throw Error('Copia demasiado grande');
  const incoming=JSON.parse(await file.text());if(!validate(incoming))throw Error('Archivo no válido');
  if(!confirm('¿Incorporar proyectos, revisiones y avances nuevos sin borrar los actuales?'))return;
  const old=state;
  const merge=(existing,extra,id)=>{const ids=new Set(existing.map(x=>x[id]));return existing.concat(extra.filter(x=>!ids.has(x[id])));};
  const projects=merge(old.projects,incoming.projects,'id'),reviews=merge(old.reviews,incoming.reviews,'date'),plans=merge(old.plans,incoming.plans,'week'),parks=merge(old.parks,incoming.parks,'id');
  const next={version:1,projects,reviews,plans,parks};
  if(!validate(next))throw Error('La copia excede los límites permitidos');
  state=next;if(!save()){state=old;throw Error('No se pudo guardar');}
  renderAll();notify();status('Copia incorporada sin sobrescribir proyectos y revisiones actuales.');
 }catch(err){status('No se pudo importar: '+err.message);}
});
renderAll();notify();
if(locked)status('Una copia de organización no se puede leer; no será sobrescrita.');
})();