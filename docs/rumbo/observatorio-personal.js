(() => {
'use strict';
const root=document.getElementById('observatorio-personal');if(!root)return;
const STORAGE='rumbo-observatorio-encrypted-v1';
const DIM=[
['animo','Estado de ánimo','Emocional'],['ansiedad','Ansiedad','Emocional'],['frustracion','Frustración','Emocional'],
['disfrute','Disfrute','Emocional'],['ilusion','Ilusión','Emocional'],['indefension','Indefensión','Emocional'],
['urgencia','Urgencia','Cognitiva'],['rumiacion','Rumiación','Cognitiva'],['incertidumbre','Incertidumbre','Cognitiva'],
['atencion','Atención','Cognitiva'],['flexibilidad','Flexibilidad','Cognitiva'],['inhibicion','Control inhibitorio','Conductual'],
['evitacion','Evitación','Conductual'],['presencia','Presencia','Conductual'],['autoestima','Autoestima','Personal'],
['autoeficacia','Autoeficacia','Personal'],['control','Control percibido','Personal'],['trabajo','Impacto laboral','Funcional'],
['familia','Impacto familiar','Funcional'],['autocuidado','Autocuidado','Funcional']
];
const PRIOR=['animo','ansiedad','urgencia','atencion','autoeficacia','disfrute'];
const engine=window.RumboPsychEngine;
let interview=null;
const $=id=>document.getElementById(id);
const node=(tag,cls,value)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(value!==undefined)x.textContent=String(value);return x;};
const day=()=>new Date().toLocaleDateString('sv-SE');
const en=new TextEncoder(),de=new TextDecoder();
let historyCandidates=[],historyBusy=false,historyMode='imported',historyGeneration=0;
let key=null,salt=null,locked=true,records={version:1,entries:[],questionnaires:[],hypotheses:[]};
const title=id=>DIM.find(x=>x[0]===id)?.[1]||id;
const say=text=>{$('obs-status').textContent=text;};
const dateOK=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00'));
const exerciseDay=(start,days)=>{const d=new Date(start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days-1);return d.toISOString().slice(0,10);};
const exerciseState=(h,today)=>!h.exercise?'legacy':(h.outcomes||[]).some(o=>o.rating==='peor')?'stopped':(h.outcomes||[]).some(o=>o.date>exerciseDay(h.exercise.start,h.exercise.days))?'completed':today>exerciseDay(h.exercise.start,h.exercise.days)?'review':'active';
const empty=()=>({version:1,entries:[],questionnaires:[],hypotheses:[]});
function valid(d){
 return d&&d.version===1&&Array.isArray(d.entries)&&d.entries.length<=2000&&d.entries.every(e=>
  typeof e.id==='string'&&dateOK(e.date)&&DIM.some(x=>x[0]===e.dimension)&&
  ['texto','autovaloracion'].includes(e.source)&&(e.value===null||(Number.isInteger(e.value)&&e.value>=0&&e.value<=4))&&
  typeof e.evidence==='string'&&e.evidence.length<=300&&typeof e.context==='string'&&e.context.length<=160&&validAnalysis(e.analysis))&&
  Array.isArray(d.questionnaires)&&d.questionnaires.length<=300&&d.questionnaires.every(q=>
  dateOK(q.date)&&['PHQ-9','GAD-7','WHO-5','OCI-R','WSAS'].includes(q.instrument)&&Number.isInteger(q.total)&&q.total>=0&&q.total<=150)&&
  (d.historySeen===undefined||(Array.isArray(d.historySeen)&&d.historySeen.length<=100000&&d.historySeen.every(x=>typeof x==='string'&&/^history-[a-f0-9]{64}-[a-z]+$/.test(x))))&&
  Array.isArray(d.hypotheses)&&d.hypotheses.length<=100&&d.hypotheses.every(h=>
  (h.exercise===undefined||(h.exercise&&dateOK(h.exercise.start)&&Number.isInteger(h.exercise.days)&&h.exercise.days>=1&&h.exercise.days<=30))&&
  typeof h.text==='string'&&h.text.length<=300&&typeof h.plan==='string'&&h.plan.length<=500&&(h.outcomes===undefined||(Array.isArray(h.outcomes)&&h.outcomes.length<=30&&h.outcomes.every(o=>o&&dateOK(o.date)&&['util','sin cambio','peor','incierto'].includes(o.rating)&&typeof o.note==='string'&&o.note.length<=500))));
}
function to64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
function from64(s){return Uint8Array.from(atob(s),x=>x.charCodeAt(0));}
async function derive(pass,s){const base=await crypto.subtle.importKey('raw',en.encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:s,iterations:220000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function save(next,stillValid=()=>true){
 if(locked||!key||!valid(next))throw Error('Bóveda cerrada o datos no válidos');
 const previous=records,activeKey=key;
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const crypt=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,en.encode(JSON.stringify(next))));
 if(locked||key!==activeKey||records!==previous||!stillValid())throw Error('La bóveda cambió durante el guardado; vuelve a intentarlo.');
 localStorage.setItem(STORAGE,JSON.stringify({version:1,salt:to64(salt),iv:to64(iv),cipher:to64(crypt)}));
 records=next;render();
}
function toggle(value){
 locked=value;$('obs-locked').hidden=!value;$('obs-private').hidden=value;
 if(value)interview?.reset();
 if(value){key=null;salt=null;records=empty();historyGeneration++;historyCandidates=[];if($('obs-diary-auto'))$('obs-diary-auto').checked=false;$('obs-history-list')?.replaceChildren();if($('obs-history-status'))$('obs-history-status').textContent='';if($('obs-history-save'))$('obs-history-save').hidden=true;if($('obs-history-select-all'))$('obs-history-select-all').disabled=true;for(const id of ['obs-patterns','obs-metrics','obs-entries','obs-questionnaires','obs-hypotheses','obs-suggestions'])$(id)?.replaceChildren();if($('obs-text'))$('obs-text').value='';if($('obs-h-form'))$('obs-h-form').reset();if($('obs-exercises'))$('obs-exercises').open=false;if($('obs-report-text')){$('obs-report-text').value='';$('obs-report-text').hidden=true;$('obs-report-download').hidden=true;$('obs-report-evidence').checked=false;$('obs-report-hypotheses').checked=false;}}
}
// Recordar una clave CryptoKey no exportable, nunca la contraseña ni texto descifrado.
const DEVICE_MARK='rumbo-observatorio-device-v1';
let sessionEpoch=0,opening=false;
function deviceStore(action,value){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open('rumbo-observatorio-device',1);
  req.onupgradeneeded=()=>req.result.createObjectStore('session');
  req.onerror=()=>reject(req.error);
  req.onblocked=()=>reject(Error('Almacenamiento de dispositivo bloqueado'));
  req.onsuccess=()=>{
   const db=req.result;
   try{
    const tx=db.transaction('session',action==='get'?'readonly':'readwrite'),store=tx.objectStore('session');
    const op=action==='get'?store.get('key'):action==='put'?store.put(value,'key'):store.delete('key');
    tx.oncomplete=()=>{db.close();resolve(op.result);};
    tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||Error('Almacenamiento no disponible'));};
   }catch(e){db.close();reject(e);}
  };
 });
}
async function rememberDevice(epoch){
 const token=crypto.randomUUID(),active=key,salt64=to64(salt);
 await deviceStore('put',{key:active,salt:salt64,token});
 if(epoch!==sessionEpoch||locked||key!==active)return false;
 localStorage.setItem(DEVICE_MARK,token);
 return true;
}
async function closeDevice(){
 sessionEpoch++;
 toggle(true);
 // Invalidar primero el marcador evita recuperar una clave residual.
 localStorage.removeItem(DEVICE_MARK);
 try{await deviceStore('delete');}catch{/* sin marcador no se restaura */}
 say('Bóveda cerrada. La próxima vez se solicitará la contraseña.');
 return true;
}
window.RumboObservatory=Object.freeze({close:closeDevice});
window.addEventListener('storage',event=>{
 if(event.key===DEVICE_MARK||event.key===null){
  sessionEpoch++;toggle(true);
  say('Acceso recordado cambiado en otra pestaña. Recarga para volver a abrir.');
 }
});
async function restoreDevice(){
 if(opening)return;
 const epoch=sessionEpoch;opening=true;$('obs-open').disabled=true;
 try{
  const token=localStorage.getItem(DEVICE_MARK),raw=localStorage.getItem(STORAGE);
  if(!token||!raw)return;
  const saved=await deviceStore('get'),blob=JSON.parse(raw);
  if(!saved||saved.token!==token||saved.salt!==blob.salt||!saved.key||saved.key.extractable!==false)throw Error('Acceso recordado no válido');
  const decoded=JSON.parse(de.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(blob.iv)},saved.key,from64(blob.cipher))));
  if(!valid(decoded))throw Error('Datos inválidos');
  if(epoch!==sessionEpoch||localStorage.getItem(DEVICE_MARK)!==token)return;
  key=saved.key;salt=from64(blob.salt);records=decoded;toggle(false);render();
  say('Bóveda abierta en este dispositivo recordado.');
 }catch{
  if(epoch===sessionEpoch){toggle(true);say('No se pudo restaurar el acceso recordado. Introduce tu contraseña; los datos se conservan.');}
 }finally{opening=false;$('obs-open').disabled=false;}
}
async function unlock(){
 if(opening)return;
 const pass=$('obs-password').value;
 if(pass.length<12){say('La contraseña debe tener al menos 12 caracteres. No se guarda.');return;}
 const epoch=sessionEpoch;opening=true;$('obs-open').disabled=true;
 try{
  const stored=localStorage.getItem(STORAGE);
  if(stored){
   const blob=JSON.parse(stored),tempSalt=from64(blob.salt),candidate=await derive(pass,tempSalt);
   const text=de.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(blob.iv)},candidate,from64(blob.cipher)));
   const decoded=JSON.parse(text);if(!valid(decoded))throw Error('Datos inválidos');
   if(epoch!==sessionEpoch)return;
   key=candidate;salt=tempSalt;records=decoded;toggle(false);
  }else{
   const tempSalt=crypto.getRandomValues(new Uint8Array(16)),candidate=await derive(pass,tempSalt);
   if(epoch!==sessionEpoch)return;
   salt=tempSalt;key=candidate;toggle(false);await save(empty());
  }
  if(epoch!==sessionEpoch)return;
  $('obs-password').value='';render();
  try{
   if($('obs-remember').checked){if(await rememberDevice(epoch))say('Bóveda abierta y recordada en este dispositivo.');}
   else{localStorage.removeItem(DEVICE_MARK);await deviceStore('delete');if(epoch===sessionEpoch)say('Bóveda abierta solo para esta sesión.');}
  }catch{if(epoch===sessionEpoch)say('Bóveda abierta, pero no se pudo recordar este dispositivo.');}
 }catch{if(epoch===sessionEpoch){toggle(true);say('No se pudo abrir la bóveda. Comprueba la contraseña. No se han borrado datos.');}}
 finally{opening=false;$('obs-open').disabled=false;}
}
function classify(text){return engine?.uniqueByDimension(text)||[];}
function metadata(hit,dateBasis){return {method:hit.method,direction:hit.direction,kind:hit.kind,temporal:hit.temporal,dateBasis,index:hit.index,end:hit.end,match:hit.match,additionalEvidence:hit.additionalEvidence||null};}
function analysisLabel(a){return a?a.kind+' · '+a.direction+' · '+a.temporal+' · '+a.method:'Sin análisis contextual (registro anterior)';}
function validAnalysis(a){return a===undefined||(a&&a.method==='reglas-contextuales-1.0'&&['malestar','dificultad','recurso','ausencia referida','mixto'].includes(a.direction)&&['emoción','pensamiento','conducta','funcionamiento'].includes(a.kind)&&['pasado referido','hoy referido','no especificado'].includes(a.temporal)&&['registro original','fecha de registro','fecha de anotación'].includes(a.dateBasis)&&Number.isInteger(a.index)&&a.index>=0&&Number.isInteger(a.end)&&a.end>a.index&&a.end<=12000&&typeof a.match==='string'&&a.match.length===a.end-a.index&&(a.additionalEvidence===null||(a.additionalEvidence&&Number.isInteger(a.additionalEvidence.index)&&a.additionalEvidence.index>=0&&Number.isInteger(a.additionalEvidence.end)&&a.additionalEvidence.end>a.additionalEvidence.index&&a.additionalEvidence.end<=12000&&typeof a.additionalEvidence.match==='string'&&a.additionalEvidence.match.length===a.additionalEvidence.end-a.additionalEvidence.index)));}
function series(id,all=records.entries){
 const days=new Map();
 for(const e of all){
  if(e.dimension!==id||e.source!=='autovaloracion'||e.value===null)continue;
  days.set(e.date,[...(days.get(e.date)||[]),e.value]);
 }
 return [...days].sort((a,b)=>a[0].localeCompare(b[0])).map(([day,v])=>({day,value:v.slice().sort((a,b)=>a-b)[Math.floor(v.length/2)]}));
}
function assessment(e){return e.source==='texto'&&e.analysis?engine?.evidenceAssessment({...e.analysis,dimension:e.dimension}):null;}
function textualLabel(e){
 const a=assessment(e);
 if(!a)return 'Sin índice textual asignable';
 return (a.level===null?'Evidencia mixta; sin grado':'Índice textual de evidencia '+a.level+'/3')+' · '+a.reason+(a.rating?' · Intensidad declarada '+a.rating.value+'/'+a.rating.max:'')+' · No es gravedad clínica';
}
function dimensionEvidence(id,all=records.entries){
 const days=new Map();
 for(const e of all){
  if(e.dimension!==id)continue;
  const a=assessment(e);if(!a)continue;
  if(!days.has(e.date))days.set(e.date,{day:e.date,levels:new Set(),directions:new Set(),ratings:new Set(),uncertain:false});
  const d=days.get(e.date);if(a.level!==null)d.levels.add(a.level);
  d.directions.add(e.analysis.direction);
  if(e.analysis.temporal==='pasado referido'||e.analysis.dateBasis!=='registro original')d.uncertain=true;
  if(a.rating)d.ratings.add(a.rating.value+'/'+a.rating.max);
 }
 return [...days.values()].sort((a,b)=>a.day.localeCompare(b.day));
}
function dayEvidenceLabel(d){
 const level=d.levels.size?Math.max(...d.levels):null;
 const dirs=[...d.directions],negative=dirs.includes('dificultad')||dirs.includes('malestar');
 const mixed=dirs.includes('mixto')||(negative&&(dirs.includes('recurso')||dirs.includes('ausencia referida')));
 return (mixed?'Orientación mixta':dirs.join(' / '))+' · '+(level===null?'sin grado de evidencia':'mayor grado de evidencia '+level+'/3')+(d.ratings.size===1&&!mixed?' · intensidad declarada '+[...d.ratings][0]:d.ratings.size>1?' · puntuaciones distintas, sin combinar':'')+(d.uncertain?' · fecha del suceso no confirmada':'');
}
// Puntuaciones originales: solo un valor compatible por día y denominador.
// Puntos sin líneas: no interpolar fechas ni inferir una evolución clínica.
function ratingPoints(days,max){
 return days.filter(d=>!d.uncertain&&d.ratings.size===1&&!d.directions.has('mixto')&&!(d.directions.has('ausencia referida')&&(d.directions.has('dificultad')||d.directions.has('malestar')))&&!(d.directions.has('recurso')&&(d.directions.has('dificultad')||d.directions.has('malestar'))))
 .map(d=>({day:d.day,parts:[...d.ratings][0].split('/').map(Number)}))
 .filter(d=>d.parts[1]===max).map(d=>({day:d.day,value:d.parts[0]}));
}
function ratingChart(points,max){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 310 110');svg.setAttribute('role','img');
 const last=points.slice(-30),t=d=>Date.parse(d+'T12:00:00Z'),a=t(last[0].day),b=t(last[last.length-1].day);
 svg.setAttribute('aria-label','Intensidades declaradas en conversaciones, fecha de registro, escala 0–'+max+': '+last.map(p=>p.day+' '+p.value+'/'+max).join('; '));
 for(const p of last){const dot=document.createElementNS(svg.namespaceURI,'circle'),label=document.createElementNS(svg.namespaceURI,'title');dot.setAttribute('cx',12+(b===a?0:(t(p.day)-a)/(b-a)*286));dot.setAttribute('cy',98-p.value/max*88);dot.setAttribute('r','4');dot.setAttribute('fill','#9a5a12');label.textContent=p.day+': '+p.value+'/'+max;dot.append(label);svg.append(dot);}
 return svg;
}
function trend(points){
 if(points.length<6)return 'Sin tendencia suficiente';
 const median=a=>{const x=a.map(p=>p.value).sort((b,c)=>b-c);return x[1];};
 const diff=median(points.slice(-3))-median(points.slice(-6,-3));
 return diff===0?'Sin cambio en la mediana':diff>0?'Sube la mediana':'Baja la mediana';
}
function miniChart(points,source='autovaloraciones'){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 310 110');svg.setAttribute('role','img');
 svg.setAttribute('aria-label',points.slice(-10).map(p=>p.day+' '+p.value.toFixed(1)).join('; ')||'Sin '+source);
 const last=points.slice(-10);
 if(!last.length)return svg;
 const poly=document.createElementNS(svg.namespaceURI,'polyline');
 poly.setAttribute('fill','none');poly.setAttribute('stroke',source==='estimaciones textuales'?'#9a5a12':'#0b6e64');poly.setAttribute('stroke-width','3');
 poly.setAttribute('points',last.map((p,i)=>(12+(last.length===1?0:i*286/(last.length-1)))+','+(98-p.value*22)).join(' '));svg.append(poly);
 for(let i=0;i<last.length;i++){
  const dot=document.createElementNS(svg.namespaceURI,'circle');
  dot.setAttribute('cx',12+(last.length===1?0:i*286/(last.length-1)));dot.setAttribute('cy',98-last[i].value*22);
  dot.setAttribute('r','3.5');dot.setAttribute('fill',source==='estimaciones textuales'?'#9a5a12':'#0b6e64');svg.append(dot);
 }
 return svg;
}
const ACTIONS={
 'urgencia:atencion':{idea:'Reducir demandas simultáneas: preparar una sola acción concreta, con material listo y sin notificaciones.',measure:'Observar en una actividad habitual si resulta más fácil empezar y continuar; anotar también obstáculos externos.',topic:'Consultar apoyos psicológicos estructurados para dificultades ejecutivas, si procede.',url:'https://www.nice.org.uk/guidance/ng87/chapter/recommendations'},
 'urgencia:inhibicion':{idea:'Preparar una transición de bajo esfuerzo: dejar anotado el siguiente paso antes de pasar a otra actividad habitual.',measure:'Valorar si facilita el cambio sin aumentar la tensión ni las comprobaciones. No usar como ritual.',topic:'Explorar con el profesional la función de la urgencia; valorar EPR si existe TOC y está indicada. No iniciar exposición por cuenta propia.',url:'https://www.nice.org.uk/guidance/cg31/chapter/Recommendations'},
 'autoeficacia:animo':{idea:'Elegir una actividad cotidiana pequeña y significativa cuyo resultado sea observable, sin exigir que mejore el ánimo.',measure:'Anotar qué se pudo hacer y si la experiencia fue útil, neutra o costosa; observar también circunstancias externas.',topic:'Valorar activación conductual o TCC con el profesional si existe indicación.',url:'https://www.nice.org.uk/guidance/ng222/chapter/recommendations'},
 'autocuidado:disfrute':{idea:'Proteger tiempo para una actividad cotidiana agradable y viable, sin forzarse a disfrutar ni superar marcas.',measure:'Observar si aporta disfrute o recuperación y qué factores pueden influir; adaptar a la salud y energía.',topic:'Valorar activación conductual y equilibrio entre actividades con el profesional.',url:'https://www.nice.org.uk/guidance/ng222/chapter/recommendations'},
 'incertidumbre:rumiacion':{idea:'Preparar para consulta un ejemplo breve del contexto y de la respuesta habitual, sin revisar repetidamente el registro.',measure:'Acordar con el profesional qué respuesta alternativa evaluar; suspender si el registro fomenta comprobaciones.',topic:'Valorar con el profesional si la EPR es pertinente; no iniciar ejercicios de exposición sin acordarlos.',url:'https://www.nice.org.uk/guidance/cg31/chapter/Recommendations'}
};
function actionFor(p){return ACTIONS[p.a+':'+p.b]||ACTIONS[p.b+':'+p.a];}

function render(){
 if(locked)return;
 $('obs-count').textContent=records.entries.length+' indicadores · '+records.questionnaires.length+' cuestionarios · '+records.hypotheses.length+' hipótesis';
 const cards=$('obs-metrics');cards.replaceChildren();
 for(const [id] of [...DIM].sort((a,b)=>(PRIOR.includes(a[0])?0:1)-(PRIOR.includes(b[0])?0:1))){
  const points=series(id),estimated=dimensionEvidence(id),card=node('article','obs-metric');
  if(!PRIOR.includes(id)&&!points.length&&!estimated.length)continue;
  card.append(node('strong','',title(id)));
  if(estimated.length){
   const latest=estimated[estimated.length-1];
   card.append(node('strong','obs-estimated-value',dayEvidenceLabel(latest)),node('small','',latest.day+' · '+estimated.length+' días con evidencia textual'));
  }else card.append(node('small','','Sin datos textuales; no equivale a cero'));
  for(const max of [4,10]){
   const rated=ratingPoints(estimated,max);
   if(rated.length)card.append(node('small','','Conversaciones · escala 0–'+max+' · '+rated.length+' días con valor explícito · último '+rated[rated.length-1].value+'/'+max),ratingChart(rated,max));
  }
  card.append(node('small','',points.length?points.length+' días con autovaloración declarada':'Sin autovaloración declarada'));
   if(estimated.length){const daily=node('details','obs-daily-evidence');daily.append(node('summary','','Valoración por día ('+estimated.length+')'));for(const d of [...estimated].reverse())daily.append(node('p','',d.day+' · '+dayEvidenceLabel(d)));card.append(daily);}
  if(points.length)card.append(node('span','obs-trend',trend(points)),miniChart(points));
  cards.append(card);
 }
 const patternBox=$('obs-patterns');patternBox.replaceChildren();
 const patterns=engine?.patterns(records.entries)||[];
 if(!patterns.length)patternBox.append(node('p','obs-empty','Aún no hay tres días con co-menciones de los pares explorados. No se concluye ausencia de relación.'));
 for(const p of patterns){
  const card=node('article','obs-entry');
  card.append(node('strong','',p.question),node('p','','Co-menciones: '+p.both+' días; solo '+title(p.a)+': '+p.onlyA+'; solo '+title(p.b)+': '+p.onlyB+'; '+p.days+' días con observaciones contextuales elegibles.'),
   node('small','','Ejemplos de fechas: '+p.examples.join(', ')+'. Son fechas de registros, no necesariamente de los acontecimientos.'),
   node('p','','Alternativas: circunstancias compartidas, cambios en hábitos de registro o en el contexto. No hay evidencia causal. Pregunta para consulta: ¿qué ocurrió antes y después?'));
  const idea=actionFor(p);
  if(idea){
   card.append(node('strong','','Posible actuación para explorar (no tratamiento personalizado)'),node('p','',idea.idea),node('p','','Qué observar: '+idea.measure),node('p','',idea.topic));
   const link=node('a','','Guía clínica de referencia (NICE)');link.href=idea.url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);
   const add=node('button','button secondary','Preparar hipótesis y actuación');add.type='button';
   add.addEventListener('click',()=>{if(locked)return;const f=$('obs-h-form').elements;if((f.text.value||f.plan.value)&&!confirm('¿Sustituir el borrador de hipótesis?'))return;$('obs-exercises').open=true;f.text.value=p.question;f.plan.value=('Actuación: '+idea.idea+' Qué observar: '+idea.measure+' Revisar con el profesional si corresponde; detener si aumenta malestar.').slice(0,500);f.text.focus();});
   card.append(add);
  }
  patternBox.append(card);
 }
 const list=$('obs-entries');list.replaceChildren();
 const recent=[...records.entries].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,40);
 if(!recent.length)list.append(node('p','obs-empty','Sin registros todavía. Puedes empezar con una frase o una autovaloración.'));
 for(const entry of recent){
  const card=node('article','obs-entry');
  card.append(node('strong','',title(entry.dimension)+' · '+entry.date),
   node('small','',entry.source==='texto'?'Observación textual · '+textualLabel(entry):'Autovaloración · '+(entry.value===null?'Sin dato':entry.value+'/4')),
   node('p','',entry.evidence||'Sin frase asociada'),node('small','',entry.context));
  if(entry.analysis){card.append(node('small','',analysisLabel(entry.analysis)));if(entry.analysis.additionalEvidence)card.append(node('p','','Otra expresión del mismo registro: '+entry.analysis.additionalEvidence.match));}
  const del=node('button','button secondary','Eliminar');del.type='button';
  del.addEventListener('click',async()=>{
   if(!confirm('¿Eliminar este registro?'))return;
   try{await save({...records,entries:records.entries.filter(x=>x.id!==entry.id)});say('Registro eliminado.');}
   catch{say('No se pudo actualizar la bóveda.');}
  });card.append(del);list.append(card);
 }
 const q=$('obs-questionnaires');q.replaceChildren();
 for(const item of [...records.questionnaires].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12)){
  q.append(node('p','obs-entry',item.instrument+' · '+item.date+' · '+item.total+' (introducido manualmente, no interpretado)'));
 }
 const h=$('obs-hypotheses');h.replaceChildren();
 for(const item of [...records.hypotheses].reverse()){
  const state=exerciseState(item,day());
  const box=node('article','obs-entry');box.append(node('strong','',item.text),node('p','',item.plan));
  if(item.exercise){
   const end=exerciseDay(item.exercise.start,item.exercise.days),observed=new Set((item.outcomes||[]).filter(o=>o.date>=item.exercise.start&&o.date<=end).map(o=>o.date)).size;
   box.append(node('p','',item.exercise.start+' a '+end+' · '+observed+'/'+item.exercise.days+' días con registro (no equivale a cumplimiento)'),
    node('strong','',state==='stopped'?'Suspendido por malestar':state==='completed'?'Revisión final registrada':state==='review'?'Periodo finalizado · revisar resultados':'En seguimiento'));
   if(state==='review')box.append(node('p','','Revisa qué cambió y qué más pudo influir. Los días sin datos no cuentan como éxitos ni fallos.'));
  }
  for(const o of item.outcomes||[]){box.append(node('small','',o.date+' · '+o.rating+' (resultado percibido; no causalidad)'),node('p','',o.note));}
  if(state==='completed'){h.append(box);continue;}
  if(state==='stopped'){box.append(node('p','','No continúes por obligación. Puedes comentar el resultado con tu profesional.'));h.append(box);continue;}
  if(state==='active'&&(item.outcomes||[]).some(o=>o.date===day())){box.append(node('small','','Ya hay un resultado registrado hoy.'));h.append(box);continue;}
  const form=node('form','obs-form'),label=node('label','',state==='review'?'Valoración final':'Resultado observado (opcional)'),select=node('select','');
  for(const [v,t] of [['','Seleccionar'],['util','Me resultó útil'],['sin cambio','No noté cambio'],['peor','Me produjo malestar o empeoré'],['incierto','No puedo determinarlo']]){const opt=node('option','',t);opt.value=v;select.append(opt);}
  select.required=true;label.append(select);const noteLabel=node('label','','Qué pasó y qué más pudo influir'),note=node('textarea','');note.maxLength=500;note.rows=2;noteLabel.append(note);
  const submit=node('button','button secondary','Guardar resultado');submit.type='submit';form.append(label,noteLabel,submit);
  form.addEventListener('submit',async e=>{e.preventDefault();if(locked||!select.value)return;const rating=select.value;if(!['util','sin cambio','peor','incierto'].includes(rating))return;
   const current=records.hypotheses.find(x=>x.id===item.id);if(!current)return;
   const currentState=exerciseState(current,day());if(currentState==='completed'||currentState==='stopped'||(currentState==='active'&&(current.outcomes||[]).some(o=>o.date===day())))return;if((current.outcomes||[]).length>=30){say('Límite de 30 resultados para esta hipótesis.');return;}
   const next={...current,outcomes:[...(current.outcomes||[]),{date:day(),rating,note:note.value.trim().slice(0,500)}]};
   try{await save({...records,hypotheses:records.hypotheses.map(x=>x.id===item.id?next:x)});say(rating==='peor'?'Resultado guardado. No insistas en la actuación; revísala con tu profesional.':'Resultado guardado. No demuestra por sí solo que la actuación causó el cambio.');}catch{say('No se pudo guardar el resultado.');}
  });box.append(form);h.append(box);
 }
}
root.innerHTML=[
'<section class="obs-head"><div class="eyebrow">MI EVOLUCIÓN · INVESTIGACIÓN PERSONAL</div><h2>Observatorio emocional</h2>',
'<p>Analiza reflexiones, registra autovaloraciones y observa tendencias sin convertir el lenguaje en diagnósticos.</p>',
'<p class="obs-disclaimer">Solo texto que aportes voluntariamente. No accede automáticamente a ChatGPT. No mencionar un síntoma no equivale a intensidad cero.</p></section>',
'<div id="obs-locked" class="obs-vault"><h3>Bóveda cifrada en este dispositivo</h3>',
'<p>Contraseña propia de al menos 12 caracteres, cifrado AES-GCM y PBKDF2. Sin sincronización entre dispositivos. Conserva la contraseña y una copia cifrada. Borrar el almacenamiento del navegador puede eliminar también los registros.</p>',
'<label for="obs-password">Contraseña de la bóveda</label><div class="obs-inline"><input type="password" id="obs-password" autocomplete="off" placeholder="Contraseña privada"><button type="button" class="button primary" id="obs-open">Abrir observatorio</button></div><label><input type="checkbox" id="obs-remember" checked> Recordar este dispositivo</label><p>Solo en dispositivos personales. Cualquier persona con acceso a este perfil del navegador podrá abrir el observatorio hasta que cierres la bóveda.</p></div>',
'<div id="obs-private" hidden>',
'<div class="obs-toolbar"><span id="obs-count"></span><button type="button" class="button secondary" id="obs-lock">Cerrar bóveda</button><button type="button" class="button secondary" id="obs-backup">Exportar copia cifrada</button></div>',
'<section class="obs-block"><h3>Indicadores psicológicos y funcionales</h3><p>Ámbar: grado de evidencia textual (1 estado expresado, 2 magnitud o acción concreta referida, 3 consecuencia funcional vinculada explícitamente). No es gravedad ni certeza clínica. Las puntuaciones escritas se conservan en su escala original; verde: autovaloraciones manuales. No se mezclan. Los seis indicadores prioritarios siempre aparecen; los demás, cuando hay datos. Las fechas son las del registro, no necesariamente del suceso.</p><div id="obs-metrics" class="obs-metrics"></div></section>',
'<section class="obs-block"><h3>Registrar cómo me encuentro</h3><p>Escala ordinal: 0 significa ausencia expresamente indicada; 1 leve, 2 moderada, 3 alta, 4 muy alta. Sin dato no es cero.</p>',
'<form id="obs-self-form" class="obs-form"><label>Fecha<input name="day" type="date" required></label>',
'<label>Dimensión<select name="dimension"></select></label>',
'<label>Intensidad declarada<select name="value"><option value="">Sin dato</option><option value="0">0 · Ausencia indicada</option><option value="1">1 · Leve</option><option value="2">2 · Moderada</option><option value="3">3 · Alta</option><option value="4">4 · Muy alta</option></select></label>',
'<label>Mis palabras (opcional)<textarea name="evidence" maxlength="300" rows="2" placeholder="Hoy me he sentido…"></textarea></label>',
'<label>Contexto (opcional)<input name="context" maxlength="160" placeholder="Trabajo, estudio, ejercicio…"></label><button type="submit" class="button primary">Guardar autovaloración</button></form></section>',
'<section class="obs-block" id="obs-interview"><h3>Comprender una situación · Psicología</h3><p>Entrevista guiada experimental. No es una evaluación clínica. Puedes finalizar en cualquier momento; las respuestas solo permanecen en esta pantalla hasta que decidas trasladarlas.</p>',
'<div data-field="intro"><label>¿Qué situación quieres comprender?<textarea data-field="context" rows="4" maxlength="2400" autocomplete="off"></textarea></label><button type="button" class="button secondary" data-field="preview">Identificar información ya expresada</button><div data-field="hints" aria-live="polite"></div><details><summary>Información que ya he explicado (opcional)</summary><div data-field="known" class="obs-form"></div></details><label><input type="checkbox" data-field="contrast"> Quiero explorar posibles interpretaciones alternativas.</label><button type="button" class="button primary" data-field="start">Comenzar revisión</button></div>',
'<div data-field="active" hidden><p><strong data-field="question"></strong></p><label>Mi respuesta (opcional)<textarea data-field="answer" maxlength="600" rows="3" autocomplete="off"></textarea></label><div class="obs-inline"><button type="button" class="button primary" data-field="next">Continuar</button><button type="button" class="button secondary" data-field="skip">Pasar</button><button type="button" class="button secondary" data-field="finish">Finalizar y revisar</button><button type="button" class="button secondary" data-stop>Salir sin guardar</button></div></div>',
'<div data-field="summary" hidden><label>Revisa y edita tus palabras<textarea data-field="result" maxlength="6000" rows="6" autocomplete="off"></textarea></label><p>Solo se trasladan tus palabras, no las preguntas ni interpretaciones de IA. Se prepararán propuestas de valoración. Tú decides cuáles guardar en la bóveda.</p><div class="obs-inline"><button type="button" class="button primary" data-field="transfer">Trasladar al análisis</button><button type="button" class="button secondary" data-stop>Descartar</button></div></div><p data-field="notice" role="status" aria-live="polite"></p></section>',
'<section class="obs-block"><h3>Clasificar una reflexión</h3><p>El motor local aplica reglas contextuales, distingue dificultades, recursos y negaciones explícitas, y evita algunos casos ambiguos. No es IA generativa ni una evaluación clínica validada. No se envía texto a servicios externos. Se guarda solo si eliges hacerlo. Cada observación conserva una frase y, cuando es elegible, muestra un grado de evidencia textual separado de la intensidad declarada.</p>',
'<label for="obs-text">Fragmento de conversación o diario</label><textarea id="obs-text" maxlength="6000" rows="5" placeholder="Pega el fragmento que quieras clasificar, sin datos de terceros."></textarea>',
'<div class="obs-inline"><button class="button primary" id="obs-analyze" type="button">Identificar indicadores</button><button class="button secondary" id="obs-clear" type="button">Limpiar</button></div><div id="obs-suggestions" class="obs-suggestions"></div></section>',
'<section class="obs-block"><h3>Analizar mi historial recuperado</h3><p>Lee solo las reflexiones y situaciones ya importadas en este navegador. Las reglas contextuales se aplican a las palabras atribuidas a ti, no a los resúmenes de IA. Revisa las propuestas antes de guardar. No se modifica el historial original ni se envía texto a otro servicio.</p>',
'<div class="obs-form"><label>Desde (opcional)<input type="date" id="obs-history-from"></label><label>Hasta (opcional)<input type="date" id="obs-history-to"></label></div>',
'<div class="obs-inline"><button type="button" id="obs-all-scan" class="button primary">Revisar todos los registros disponibles</button><button type="button" id="obs-history-scan" class="button secondary">Revisar historial importado</button><button type="button" id="obs-diary-scan" class="button secondary">Revisar diario privado</button><button type="button" id="obs-history-select-all" class="button secondary" disabled>Seleccionar todos</button><button type="button" id="obs-history-save" class="button secondary" hidden>Guardar seleccionados y calcular índice textual</button></div>',
'<p>La revisión conjunta usa el historial de este navegador y el diario ya abierto. No consulta tus chats de ChatGPT directamente. Para revisar el diario privado, abre Mi espacio e inicia sesión primero. Las notas pueden contener citas o resúmenes: se clasifican como texto del diario, no como palabras verificadas tuyas. El análisis no cambia ni elimina las notas.</p>',
'<label><input type="checkbox" id="obs-diary-auto"> Preparar propuestas al guardar notas (solo mientras ambas sesiones estén abiertas; no guarda observaciones sin revisión)</label>',
'<p id="obs-history-status" role="status" aria-live="polite"></p><div id="obs-history-list" class="obs-suggestions"></div></section>',
'<section class="obs-block"><h3>Patrones para investigar</h3><p>Co-menciones en días de registro; no son correlaciones ni prevalencia de síntomas. Una mención aislada no demuestra nada.</p><div id="obs-patterns" class="obs-entry-list"></div></section>',
'<section class="obs-block"><h3>Historial de evidencias</h3><div id="obs-entries" class="obs-entry-list"></div></section>',
'<section class="obs-block"><h3>Resultados de cuestionarios</h3><p>Registro manual de instrumentos realizados fuera de Rumbo. Los resultados no se interpretan clínicamente. WHO-5: escala original 0–25.</p>',
'<form class="obs-form" id="obs-q-form"><label>Instrumento<select name="instrument"><option>PHQ-9</option><option>GAD-7</option><option>WHO-5</option><option>OCI-R</option><option>WSAS</option></select></label>',
'<label>Fecha<input name="day" type="date" required></label><label>Puntuación total<input type="number" name="total" min="0" max="150" step="1" required></label><button type="submit" class="button secondary">Registrar puntuación</button></form><div id="obs-questionnaires"></div></section>',
'<details class="obs-block" id="obs-exercises"><summary><strong>Ejercicios</strong> · seguimiento de estrategias</summary><p>Contrasta relaciones considerando explicaciones alternativas. Una correlación no demuestra causalidad. Registra solo resultados que te resulten útiles; no es obligatorio hacerlo a diario. Si una actuación aumenta el malestar o la necesidad de comprobar, déjala y coméntala en consulta.</p>',
'<form class="obs-form" id="obs-h-form"><label>Hipótesis<input name="text" maxlength="300" required placeholder="El ejercicio se relaciona con un mejor estado de ánimo"></label>',
'<label>Cómo probarla<textarea name="plan" rows="3" maxlength="500" required placeholder="Registrar antes/después, contrastar con días sin ejercicio y controlar sueño."></textarea></label><label>Duración (días)<input name="duration" type="number" min="1" max="30" step="1" value="7" required></label><button type="submit" class="button secondary">Guardar hipótesis</button></form><div id="obs-hypotheses"></div></details>',
'<section class="obs-block"><h3>Informe para la consulta</h3><p>Selecciona el periodo desde tu última consulta. Revisa y edita el informe antes de compartirlo. No se envía automáticamente ni sustituye una valoración clínica.</p>',
'<div class="obs-form"><label>Desde<input id="obs-report-from" type="date"></label><label>Hasta<input id="obs-report-to" type="date"></label>',
'<label><input type="checkbox" id="obs-report-evidence"> Incluir frases originales y contexto (opcional)</label><label><input type="checkbox" id="obs-report-hypotheses"> Incluir hipótesis y planes sin fecha (opcional)</label></div>',
'<div class="obs-inline"><button id="obs-report" class="button primary" type="button">Preparar informe</button><button id="obs-report-download" class="button secondary" type="button" hidden>Exportar texto revisado</button></div>',
'<textarea id="obs-report-text" rows="14" hidden aria-label="Informe descriptivo" autocomplete="off" spellcheck="false"></textarea><p>La exportación es un archivo de texto sin cifrar. Compártelo únicamente por un canal seguro con el profesional que elijas.</p></section></div>',
'<p id="obs-status" role="status" aria-live="polite"></p>'
].join('');
interview=window.RumboInterview?.mount($('obs-interview'),{
 isOpen:()=>!locked,
 inspect:text=>window.RumboPsychCoordinator?.inspect(text,engine)??{hints:[]},
 transfer:text=>{
  if(locked)return false;
  const field=$('obs-text');
  if(field.value.trim()&&!confirm('¿Sustituir el borrador del clasificador por las palabras de esta revisión?'))return false;
  field.value=text;$('obs-suggestions').replaceChildren();$('obs-analyze').click();field.focus();return true;
 }
});
$('obs-open').addEventListener('click',()=>void unlock());
$('obs-password').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void unlock();}});
$('obs-lock').addEventListener('click',()=>{void closeDevice().catch(()=>say('No se pudo confirmar el cierre del acceso recordado.'));});
$('obs-backup').addEventListener('click',()=>{
 const raw=localStorage.getItem(STORAGE);if(!raw)return;
 const blob=new Blob([raw],{type:'application/json'}),link=document.createElement('a');
 link.href=URL.createObjectURL(blob);link.download='rumbo-observatorio-cifrado-'+day()+'.json';link.click();
 setTimeout(()=>URL.revokeObjectURL(link.href),5000);say('Copia cifrada preparada. Conserva la contraseña por separado.');
});
for(const id of ['obs-self-form','obs-q-form'])$(id).elements.day.value=day();
const selector=$('obs-self-form').elements.dimension;
for(const [id,label] of DIM){const o=node('option','',label);o.value=id;selector.append(o);}
$('obs-self-form').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.currentTarget.elements,value=f.value.value===''?null:Number(f.value.value);
 const evidence=f.evidence.value.trim(),context=f.context.value.trim();
 if(!dateOK(f.day.value)||!DIM.some(x=>x[0]===f.dimension.value)||!((value===null)||Number.isInteger(value)&&value>=0&&value<=4)){say('Valores inválidos.');return;}
 if(value===null&&!evidence){say('Indica una autovaloración o una frase; la ausencia de datos no es cero.');return;}
 const entry={id:crypto.randomUUID(),date:f.day.value,dimension:f.dimension.value,source:'autovaloracion',value,evidence:evidence.slice(0,300),context:context.slice(0,160)};
 try{await save({...records,entries:[...records.entries,entry]});f.value.value='';f.evidence.value='';f.context.value='';say('Autovaloración guardada cifrada.');}
 catch{say('No se pudo guardar.');}
});
$('obs-analyze').addEventListener('click',()=>{
 if(locked)return;
 const text=$('obs-text').value.trim(),box=$('obs-suggestions');box.replaceChildren();
 if(!text){say('Pega primero un fragmento.');return;}
 if(!engine){say('El motor no está disponible. Recarga la aplicación.');return;}
 const found=classify(text);
 if(!found.length){box.append(node('p','obs-empty','No hay coincidencias explícitas. No se asigna ninguna puntuación.'));return;}
 for(const result of found){
  const div=node('article','obs-suggestion');
  div.append(node('strong','',title(result.dimension)),node('p','',result.evidence),node('small','','Propuesta contextual · '+analysisLabel(result)+' · '+textualLabel({source:'texto',dimension:result.dimension,analysis:result})+' · requiere revisión.'));
  if(result.additionalEvidence)div.append(node('p','','Otra expresión: '+result.additionalEvidence.match));
  const button=node('button','button secondary','Guardar observación');button.type='button';
  button.addEventListener('click',async()=>{
   if(locked||$('obs-text').value.trim()!==text||!div.isConnected)return;
   button.disabled=true;
   try{const entry={id:crypto.randomUUID(),date:day(),dimension:result.dimension,source:'texto',value:null,evidence:result.evidence,context:'Fragmento aportado voluntariamente',analysis:metadata(result,'fecha de anotación')};
    await save({...records,entries:[...records.entries,entry]});button.disabled=true;say('Observación guardada. Se calcula el índice textual si existe evidencia suficiente.');
   }catch{button.disabled=false;say('No se pudo guardar.');}
  });div.append(button);box.append(div);
 }
});
$('obs-text').addEventListener('input',()=>{$('obs-suggestions').replaceChildren();});
$('obs-clear').addEventListener('click',()=>{$('obs-text').value='';$('obs-suggestions').replaceChildren();});
$('obs-q-form').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.currentTarget.elements,n=Number(f.total.value),max={'PHQ-9':27,'GAD-7':21,'WHO-5':25,'OCI-R':72,'WSAS':40};
 if(!dateOK(f.day.value)||!Number.isInteger(n)||n<0||n>max[f.instrument.value]){say('Fecha o puntuación fuera del rango del instrumento.');return;}
 try{await save({...records,questionnaires:[...records.questionnaires,{id:crypto.randomUUID(),date:f.day.value,instrument:f.instrument.value,total:n}]});f.total.value='';say('Resultado manual registrado sin interpretación clínica.');}
 catch{say('No se pudo guardar.');}
});
$('obs-h-form').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.currentTarget.elements,h={id:crypto.randomUUID(),text:f.text.value.trim().slice(0,300),plan:f.plan.value.trim().slice(0,500),exercise:{start:day(),days:Number(f.duration.value)}};
 if(!h.text||!h.plan||!Number.isInteger(h.exercise.days)||h.exercise.days<1||h.exercise.days>30)return;
 try{await save({...records,hypotheses:[...records.hypotheses,h]});f.text.value='';f.plan.value='';say('Hipótesis por contrastar guardada.');}
 catch{say('No se pudo guardar.');}
});

const historyStatus=t=>{$('obs-history-status').textContent=t;};
function resetHistory(){
 historyGeneration++;historyCandidates=[];$('obs-history-list').replaceChildren();$('obs-history-save').hidden=true;$('obs-history-select-all').disabled=true;
}
for(const id of ['obs-history-from','obs-history-to'])$(id).addEventListener('change',()=>{resetHistory();historyStatus('Vuelve a revisar el periodo.');});
const strictDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&dateOK(s)&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
function historicalDate(value){
 if(typeof value!=='string')return '';
 if(strictDay(value))return value;
 if(!/^\d{4}-\d{2}-\d{2}T/.test(value)||!/(?:Z|[+-]\d{2}:\d{2})$/.test(value))return '';
 const t=new Date(value);if(!Number.isFinite(t.getTime()))return '';
 return t.toLocaleDateString('sv-SE',{timeZone:'Europe/Madrid'});
}
async function historyId(source,dimension){
 const digest=await crypto.subtle.digest('SHA-256',en.encode(source));
 return 'history-'+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')+'-'+dimension;
}
async function scanHistory(mode='imported'){
 if(locked||historyBusy)return;
 resetHistory();historyMode=mode;historyBusy=true;$('obs-history-scan').disabled=true;$('obs-diary-scan').disabled=true;$('obs-all-scan').disabled=true;
 const active=key,generation=historyGeneration,from=$('obs-history-from').value,to=$('obs-history-to').value;
 try{
  if((from&&!strictDay(from))||(to&&!strictDay(to))||(from&&to&&from>to))throw Error('Selecciona fechas válidas.');
  const items=[],sources=[],unavailable=[];
  if(mode==='diary'||mode==='all'){
   const notes=window.RumboPrivateSpace?.readForObservatory();
   if(!notes){unavailable.push('diario privado no abierto');}
   else{
    const rows=notes.slice(0,1000).filter(n=>n&&typeof n.id==='string'&&typeof n.text==='string')
     .map(n=>({id:'diary:'+n.id,date:n.createdAt,kind:'diary',payload:{text:n.text,edited:n.updatedAt!==n.createdAt}}));
    items.push(...rows);sources.push('diario privado: '+rows.length+' notas cargadas');
   }
  }
  if(mode==='imported'||mode==='all'){
   const raw=localStorage.getItem('rumbo-historial-importado-v1');
   if(!raw)unavailable.push('historial importado no disponible');
   else{
    try{const store=JSON.parse(raw);if(!window.RumboHistoryVault?.validStore(store))throw Error('Formato incompatible');
     items.push(...store.entries);sources.push('historial importado: '+store.entries.length+' registros');
    }catch{unavailable.push('historial importado incompatible, sin modificar');}
   }
  }
  if(!sources.length){historyStatus('Sin fuentes disponibles. '+unavailable.join('; ')+'. Abre Mi espacio o recupera el historial.');return;}
  const coverage=sources.join('; ')+(unavailable.length?' | No incluido: '+unavailable.join('; '):'');
  const seen=new Set([...(records.historySeen||[]),...records.entries.map(e=>e.id)]);
  if(!engine)throw Error('El motor no está disponible. Recarga la aplicación.');
  const proposed=[],limit=200;let missing=0,matched=0,reviewed=0,withoutMatches=0,outside=0,already=0;
  for(const item of [...items].sort((a,b)=>b.date.localeCompare(a.date))){
   const p=item.payload;
   // No usar el resumen de IA como si fueran palabras del usuario.
   const text=item.kind==='reflection'?p.reported:p.text;
   // No atribuir al acontecimiento una fecha de importación. Si solo existe recordedAt,
   // se indica explícitamente que es la fecha registrada, no la del suceso.
   const original=item.kind==='reflection'?historicalDate(p.date):historicalDate(item.date);
   const date=original||(item.kind==='reflection'?historicalDate(p.recordedAt):'');
   if(typeof text!=='string'||!text.trim()||!date){missing++;continue;}
   if((from&&date<from)||(to&&date>to)){outside++;continue;}
    reviewed++;
   const source=item.kind==='reflection'&&typeof p.sourceReference==='string'&&p.sourceReference.trim()?'reflection:'+p.sourceReference:item.id;
   const hits=classify(text.slice(0,12000));if(!hits.length)withoutMatches++;
    for(const hit of hits){
    const id=await historyId(source,hit.dimension);
    if(seen.has(id)){already++;continue;}
     seen.add(id);matched++;
    if(proposed.length>=limit)continue;
    proposed.push({id,date,dimension:hit.dimension,source:'texto',value:null,evidence:hit.evidence,context:item.kind==='diary'?'Diario privado · fecha de creación; autoría y fecha del suceso sin verificar':original?'Historial recuperado · palabras atribuidas al usuario':'Historial recuperado · fecha del registro, no necesariamente del suceso',analysis:metadata(hit,item.kind==='diary'?'fecha de anotación':original?'registro original':'fecha de registro')});
   }
  }
  if(locked||key!==active||generation!==historyGeneration||from!==$('obs-history-from').value||to!==$('obs-history-to').value)return;
  if((mode==='diary'||mode==='all')&&sources.some(x=>x.startsWith('diario privado:'))&&!window.RumboPrivateSpace?.readForObservatory())return;
  historyCandidates=proposed;
  for(const entry of proposed){
   const card=node('article','obs-suggestion'),label=node('label',''),check=node('input','');
   check.type='checkbox';check.dataset.historyId=entry.id;
   label.append(check,document.createTextNode(' '+title(entry.dimension)+' · '+entry.date));
   card.append(label,node('p','',entry.evidence),node('small','',entry.context+' · '+analysisLabel(entry.analysis)+' · '+textualLabel(entry)+' · no diagnóstico'));
   if(entry.analysis.additionalEvidence)card.append(node('p','','Otra expresión: '+entry.analysis.additionalEvidence.match));
   $('obs-history-list').append(card);
  }
  $('obs-history-save').hidden=!proposed.length;$('obs-history-select-all').disabled=!proposed.length;
  historyStatus(coverage+'. '+reviewed+' registros analizados; '+withoutMatches+' sin coincidencias; '+already+' observaciones ya incorporadas o repetidas; '+missing+' sin texto o fecha válida; '+outside+' fuera del periodo. '+matched+' propuestas nuevas; '+proposed.length+' visibles. '+(matched>limit?'Tras guardar, vuelve a revisar para incorporar las siguientes. ':'')+'Selecciona las propuestas pertinentes. Sin evidencia no equivale a cero.');
 }catch(e){if(!locked&&key===active&&generation===historyGeneration)historyStatus(e.message||'No se pudo revisar el historial.');}
 finally{historyBusy=false;$('obs-history-scan').disabled=false;$('obs-diary-scan').disabled=false;$('obs-all-scan').disabled=false;}
}
$('obs-all-scan').addEventListener('click',()=>void scanHistory('all'));
$('obs-history-scan').addEventListener('click',()=>void scanHistory('imported'));
$('obs-diary-scan').addEventListener('click',()=>void scanHistory('diary'));
function invalidateDiary(){if(historyMode==='diary'||historyMode==='all'){resetHistory();if(!locked)historyStatus('El diario cambió. Vuelve a revisarlo; las observaciones ya guardadas se conservan.');}}
window.addEventListener('rumbo:diario-cerrado',()=>{invalidateDiary();$('obs-diary-auto').checked=false;});
window.addEventListener('rumbo:diario-cambiado',invalidateDiary);
window.addEventListener('rumbo:diario-guardado',()=>{
 if(locked)return;
 invalidateDiary();
 if(!$('obs-diary-auto').checked)return;
 if(historyBusy||historyCandidates.length){historyStatus('Hay una revisión pendiente. Puedes revisar el diario después.');return;}
 void scanHistory('diary');
});
$('obs-history-select-all').addEventListener('click',()=>{if(!locked&&!historyBusy){const checks=[...$('obs-history-list').querySelectorAll('input[type=checkbox]')];for(const c of checks)c.checked=true;historyStatus(checks.length+' propuestas seleccionadas. Pulsa Guardar seleccionados y calcular índice textual.');}});
$('obs-history-save').addEventListener('click',async()=>{
 if(locked||historyBusy)return;
 if((historyMode==='diary'||historyMode==='all')&&!window.RumboPrivateSpace?.readForObservatory()&&historyCandidates.some(e=>e.context.startsWith('Diario privado'))){invalidateDiary();return;}
 const chosen=new Set(Array.from($('obs-history-list').querySelectorAll('input:checked'),x=>x.dataset.historyId));
 const seen=new Set([...(records.historySeen||[]),...records.entries.map(e=>e.id)]);
 const selected=historyCandidates.filter(e=>chosen.has(e.id)&&!seen.has(e.id));
 if(!selected.length){historyStatus('Selecciona al menos una propuesta nueva.');return;}
 if(records.entries.length+selected.length>2000){historyStatus('Se supera el límite de 2.000 indicadores; selecciona menos.');return;}
 historyBusy=true;$('obs-history-save').disabled=true;const active=key;
 try{
  const scanGeneration=historyGeneration;
  await save({...records,entries:[...records.entries,...selected],historySeen:[...new Set([...(records.historySeen||[]),...selected.map(e=>e.id)])]},()=>scanGeneration===historyGeneration);
  if(locked||key!==active)return;
  historyCandidates=historyCandidates.filter(x=>!chosen.has(x.id));
  for(const input of $('obs-history-list').querySelectorAll('input:checked'))input.closest('article').remove();
  $('obs-history-save').hidden=!historyCandidates.length;$('obs-history-select-all').disabled=!historyCandidates.length;
  historyStatus(selected.length+' observaciones guardadas cifradas. Índice textual actualizado cuando procede. No se modifica el historial original.');
 }catch(e){if(!locked&&key===active)historyStatus('No se ha confirmado el guardado. Vuelve a revisar.');}
 finally{historyBusy=false;$('obs-history-save').disabled=false;}
});

const reportStart=new Date();reportStart.setDate(reportStart.getDate()-29);
$('obs-report-from').value=reportStart.toLocaleDateString('sv-SE');
$('obs-report-to').value=day();
function clearReport(){
 $('obs-report-text').value='';$('obs-report-text').hidden=true;$('obs-report-download').hidden=true;
}
for(const id of ['obs-report-from','obs-report-to','obs-report-evidence','obs-report-hypotheses'])$(id).addEventListener('change',clearReport);
$('obs-report').addEventListener('click',()=>{
 if(locked)return;
 clearReport();
 const from=$('obs-report-from').value,to=$('obs-report-to').value;
 if(!dateOK(from)||!dateOK(to)||from>to||to>day()){say('Selecciona un periodo válido, sin fechas futuras.');return;}
 const inPeriod=x=>x.date>=from&&x.date<=to;
 const e=records.entries.filter(inPeriod);
 const self=e.filter(x=>x.source==='autovaloracion'),observed=e.filter(x=>x.source==='texto');
 const distinct=new Set(e.map(x=>x.date)).size;
 const lines=['RUMBO · INFORME DESCRIPTIVO PARA CONSULTA','Periodo: '+from+' a '+to+' (inclusive)',
 'Elaborado a partir de registros personales; no constituye diagnóstico ni seguimiento sanitario permanente.',
 '', '1. COBERTURA DE LOS DATOS',
 'Días con algún registro: '+distinct,'Autovaloraciones: '+self.length+' (incluyen '+self.filter(x=>x.value===null).length+' sin puntuación)',
 'Observaciones textuales (sin intensidad declarada): '+observed.length,
 'Los días sin registro no equivalen a ausencia de síntomas.',
 '', '2. EVOLUCIÓN DECLARADA (escala ordinal 0–4, intensidad; no siempre una subida es mejoría)'];
 for(const [id,label] of DIM){
  const p=series(id,e);if(!p.length)continue;
  lines.push(label+': '+p.length+' días · primera '+p[0].value+'/4 ('+p[0].day+') · última '+p[p.length-1].value+'/4 ('+p[p.length-1].day+') · '+trend(p)+'.');
 }
 if(!self.some(x=>x.value!==null))lines.push('Sin autovaloraciones numéricas en este periodo.');
 lines.push('', '3. TEMAS MENCIONADOS (observaciones textuales revisables; no frecuencia de síntomas)');
 for(const [id,label] of DIM){
  const matches=observed.filter(x=>x.dimension===id);
  if(matches.length)lines.push(label+': '+matches.length+' registros en '+new Set(matches.map(x=>x.date)).size+' días.');
 }
 if(!observed.length)lines.push('Sin observaciones textuales guardadas.');
 lines.push('', 'EVIDENCIA TEXTUAL E INTENSIDAD DECLARADA EN CONVERSACIONES (evidencia-1.0: 1 estado, 2 magnitud/acción concreta, 3 consecuencia funcional vinculada; no mide gravedad)');
 for(const [id,label] of DIM){const p=dimensionEvidence(id,e);if(p.length)lines.push(label+': '+p.length+' días de registro · último '+dayEvidenceLabel(p[p.length-1])+' ('+p[p.length-1].day+').');}
 lines.push('Las puntuaciones declaradas en conversaciones no se incorporan a la serie de autovaloración manual. No se promedian escalas ni se imputan valores por ausencia de menciones.');
 const patterns=engine?.patterns(e)||[];
 if(patterns.length){lines.push('', 'PATRONES EXPLORATORIOS (co-menciones por fecha de registro; no causalidad)');for(const p of patterns)lines.push(p.question+' '+p.both+' días con ambas menciones; '+p.onlyA+' solo la primera; '+p.onlyB+' solo la segunda. Explorar circunstancias compartidas y hábitos de registro.');}
 lines.push('', '4. CUESTIONARIOS (puntuación manual, sin interpretación)');
 const q=records.questionnaires.filter(inPeriod).sort((a,b)=>a.date.localeCompare(b.date));
 lines.push(...(q.length?q.map(x=>x.date+' · '+x.instrument+': '+x.total):['Sin resultados registrados.']));
 if($('obs-report-evidence').checked){
  lines.push('', '5. FRAGMENTOS Y CONTEXTO (revisar antes de compartir)');
  const examples=e.filter(x=>x.evidence||x.context).sort((a,b)=>b.date.localeCompare(a.date));
  lines.push(...(examples.length?examples.slice(0,20).map(x=>x.date+' · '+title(x.dimension)+' · '+(x.source==='texto'?textualLabel(x):'autovaloración')+(x.evidence?': '+x.evidence:'')+(x.context?' | Contexto: '+x.context:'')+(x.analysis?' | '+analysisLabel(x.analysis)+(x.analysis.additionalEvidence?' | Otra expresión: '+x.analysis.additionalEvidence.match:''):'')):['Sin fragmentos asociados.']));
  if(examples.length>20)lines.push('Se muestran los 20 registros más recientes de '+examples.length+'.');
 }
 if($('obs-report-hypotheses').checked){
  lines.push('', 'HIPÓTESIS Y EXPERIMENTOS (sin fecha; no necesariamente del periodo)');
  lines.push(...(records.hypotheses.length?records.hypotheses.map(h=>h.text+' | Plan: '+h.plan+(h.exercise?' | Periodo: '+h.exercise.start+' a '+exerciseDay(h.exercise.start,h.exercise.days):'')+((h.outcomes||[]).length?' | Resultados del periodo (percibidos): '+h.outcomes.filter(o=>o.date>=from&&o.date<=to).map(o=>o.date+' '+o.rating+(o.note?' — '+o.note:'')).join('; '):'')):['Sin hipótesis guardadas.']));
 }
 lines.push('', 'NOTAS PARA LA CONSULTA (completar voluntariamente)','Acontecimientos relevantes: ','Repercusión en la vida diaria: ','Cambios de tratamiento percibidos: ','Estrategias y resultados observados: ','Preguntas para el profesional: ','','Los patrones no demuestran causalidad. Revisar junto al profesional.');
 $('obs-report-text').value=lines.join('\n');$('obs-report-text').hidden=false;$('obs-report-download').hidden=false;$('obs-report-text').focus();say('Informe preparado. Puedes editarlo y retirar información antes de exportar.');
});
$('obs-report-download').addEventListener('click',()=>{
 if(locked||$('obs-report-text').hidden||!$('obs-report-text').value.trim())return;
 if(!confirm('El archivo de texto no estará cifrado. ¿Exportar únicamente el informe que has revisado?'))return;
 const url=URL.createObjectURL(new Blob([$('obs-report-text').value],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');
 a.href=url;a.download='rumbo-informe-consulta-'+day()+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
 say('Exportación solicitada. El archivo no está cifrado.');
});
toggle(true);
void restoreDevice();
})();