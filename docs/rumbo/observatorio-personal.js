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
const RULES=[
['animo',/\b(?:estoy triste|me siento bien|estoy desanimad[oa]|me siento vací[oa])\b/iu],
['ansiedad',/\b(?:tengo ansiedad|estoy ansios[oa]|tengo miedo|estoy nervios[oa])\b/iu],
['frustracion',/\b(?:estoy frustrad[oa]|me enfada|siento rabia)\b/iu],
['disfrute',/\b(?:disfruto|no disfruto|no me apetece nada)\b/iu],
['ilusion',/\b(?:estoy ilusionad[oa]|tengo ilusión|no tengo ilusión)\b/iu],
['indefension',/\b(?:me siento derrotad[oa]|me siento indefens[oa]|no puedo cambiar nada)\b/iu],
['urgencia',/\b(?:necesito resolverlo ya|urgencia por terminar|necesito hacerlo inmediatamente)\b/iu],
['rumiacion',/\b(?:le doy vueltas|no puedo dejar de pensar|pensamientos repetitivos)\b/iu],
['incertidumbre',/\b(?:no tolero la incertidumbre|necesito tener certeza|no soporto no saber)\b/iu],
['atencion',/\b(?:no consigo concentrarme|me he concentrado|pierdo la atención)\b/iu],
['flexibilidad',/\b(?:cambié de estrategia|no consigo cambiar de estrategia)\b/iu],
['inhibicion',/\b(?:actué sin pensar|conseguí detenerme|me contuve antes de responder)\b/iu],
['evitacion',/\b(?:estoy evitando|no me atrevo a|he evitado)\b/iu],
['presencia',/\b(?:estuve presente|no consigo estar presente)\b/iu],
['autoestima',/\b(?:no valgo|me siento inútil|me siento valios[oa])\b/iu],
['autoeficacia',/\b(?:soy capaz de|no soy capaz de|confío en mi capacidad)\b/iu],
['control',/\b(?:siento que controlo|he perdido el control|puedo decidir)\b/iu],
['trabajo',/\b(?:el trabajo me afecta|problemas laborales)\b/iu],
['familia',/\b(?:he disfrutado con mis hijos|no dedico tiempo a mi familia)\b/iu],
['autocuidado',/\b(?:he dormido bien|duermo mal|he salido a correr)\b/iu]
];
const $=id=>document.getElementById(id);
const node=(tag,cls,value)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(value!==undefined)x.textContent=String(value);return x;};
const day=()=>new Date().toLocaleDateString('sv-SE');
const en=new TextEncoder(),de=new TextDecoder();
let historyCandidates=[],historyBusy=false;
let key=null,salt=null,locked=true,records={version:1,entries:[],questionnaires:[],hypotheses:[]};
const title=id=>DIM.find(x=>x[0]===id)?.[1]||id;
const say=text=>{$('obs-status').textContent=text;};
const dateOK=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00'));
const empty=()=>({version:1,entries:[],questionnaires:[],hypotheses:[]});
function valid(d){
 return d&&d.version===1&&Array.isArray(d.entries)&&d.entries.length<=2000&&d.entries.every(e=>
  typeof e.id==='string'&&dateOK(e.date)&&DIM.some(x=>x[0]===e.dimension)&&
  ['texto','autovaloracion'].includes(e.source)&&(e.value===null||(Number.isInteger(e.value)&&e.value>=0&&e.value<=4))&&
  typeof e.evidence==='string'&&e.evidence.length<=300&&typeof e.context==='string'&&e.context.length<=160)&&
  Array.isArray(d.questionnaires)&&d.questionnaires.length<=300&&d.questionnaires.every(q=>
  dateOK(q.date)&&['PHQ-9','GAD-7','WHO-5','OCI-R','WSAS'].includes(q.instrument)&&Number.isInteger(q.total)&&q.total>=0&&q.total<=150)&&
  (d.historySeen===undefined||(Array.isArray(d.historySeen)&&d.historySeen.length<=100000&&d.historySeen.every(x=>typeof x==='string'&&/^history-[a-f0-9]{64}-[a-z]+$/.test(x))))&&
  Array.isArray(d.hypotheses)&&d.hypotheses.length<=100&&d.hypotheses.every(h=>
  typeof h.text==='string'&&h.text.length<=300&&typeof h.plan==='string'&&h.plan.length<=500);
}
function to64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
function from64(s){return Uint8Array.from(atob(s),x=>x.charCodeAt(0));}
async function derive(pass,s){const base=await crypto.subtle.importKey('raw',en.encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:s,iterations:220000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function save(next){
 if(locked||!key||!valid(next))throw Error('Bóveda cerrada o datos no válidos');
 const previous=records,activeKey=key;
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const crypt=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,en.encode(JSON.stringify(next))));
 if(locked||key!==activeKey||records!==previous)throw Error('La bóveda cambió durante el guardado; vuelve a intentarlo.');
 localStorage.setItem(STORAGE,JSON.stringify({version:1,salt:to64(salt),iv:to64(iv),cipher:to64(crypt)}));
 records=next;render();
}
function toggle(value){
 locked=value;$('obs-locked').hidden=!value;$('obs-private').hidden=value;
 if(value){key=null;salt=null;records=empty();historyCandidates=[];$('obs-history-list')?.replaceChildren();if($('obs-history-status'))$('obs-history-status').textContent='';if($('obs-history-save'))$('obs-history-save').hidden=true;for(const id of ['obs-metrics','obs-entries','obs-questionnaires','obs-hypotheses','obs-suggestions'])$(id)?.replaceChildren();if($('obs-text'))$('obs-text').value='';if($('obs-report-text')){$('obs-report-text').value='';$('obs-report-text').hidden=true;$('obs-report-download').hidden=true;$('obs-report-evidence').checked=false;$('obs-report-hypotheses').checked=false;}}
}
async function unlock(){
 const pass=$('obs-password').value;
 if(pass.length<12){say('La contraseña debe tener al menos 12 caracteres. No se guarda.');return;}
 try{
  const stored=localStorage.getItem(STORAGE);
  if(stored){
   const blob=JSON.parse(stored),tempSalt=from64(blob.salt),candidate=await derive(pass,tempSalt);
   const text=de.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(blob.iv)},candidate,from64(blob.cipher)));
   const decoded=JSON.parse(text);if(!valid(decoded))throw Error('Datos inválidos');
   key=candidate;salt=tempSalt;records=decoded;toggle(false);
  }else{
   salt=crypto.getRandomValues(new Uint8Array(16));key=await derive(pass,salt);toggle(false);await save(empty());
  }
  $('obs-password').value='';render();say('Bóveda abierta. Los datos están cifrados en este dispositivo.');
 }catch{toggle(true);say('No se pudo abrir la bóveda. Comprueba la contraseña. No se han borrado datos.');}
}
function classify(text){
 return RULES.flatMap(([dimension,re])=>{
  const match=re.exec(text);if(!match)return[];
  const start=Math.max(0,match.index-45),end=Math.min(text.length,match.index+match[0].length+45);
  return [{dimension,evidence:text.slice(start,end).trim().slice(0,300)}];
 });
}
function series(id,all=records.entries){
 const days=new Map();
 for(const e of all){
  if(e.dimension!==id||e.source!=='autovaloracion'||e.value===null)continue;
  days.set(e.date,[...(days.get(e.date)||[]),e.value]);
 }
 return [...days].sort((a,b)=>a[0].localeCompare(b[0])).map(([day,v])=>({day,value:v.slice().sort((a,b)=>a-b)[Math.floor(v.length/2)]}));
}
function trend(points){
 if(points.length<6)return 'Sin tendencia suficiente';
 const median=a=>{const x=a.map(p=>p.value).sort((b,c)=>b-c);return x[1];};
 const diff=median(points.slice(-3))-median(points.slice(-6,-3));
 return diff===0?'Sin cambio en la mediana':diff>0?'Sube la mediana':'Baja la mediana';
}
function miniChart(points){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 310 110');svg.setAttribute('role','img');
 svg.setAttribute('aria-label',points.slice(-10).map(p=>p.day+' '+p.value.toFixed(1)).join('; ')||'Sin autovaloraciones');
 const last=points.slice(-10);
 if(!last.length)return svg;
 const poly=document.createElementNS(svg.namespaceURI,'polyline');
 poly.setAttribute('fill','none');poly.setAttribute('stroke','#0b6e64');poly.setAttribute('stroke-width','3');
 poly.setAttribute('points',last.map((p,i)=>(12+(last.length===1?0:i*286/(last.length-1)))+','+(98-p.value*22)).join(' '));svg.append(poly);
 return svg;
}
function render(){
 if(locked)return;
 $('obs-count').textContent=records.entries.length+' indicadores · '+records.questionnaires.length+' cuestionarios · '+records.hypotheses.length+' hipótesis';
 const cards=$('obs-metrics');cards.replaceChildren();
 for(const id of PRIOR){
  const points=series(id),card=node('article','obs-metric');
  card.append(node('strong','',title(id)),node('span','obs-trend',trend(points)),miniChart(points),node('small','',points.length+' días con autovaloración'));
  cards.append(card);
 }
 const list=$('obs-entries');list.replaceChildren();
 const recent=[...records.entries].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,40);
 if(!recent.length)list.append(node('p','obs-empty','Sin registros todavía. Puedes empezar con una frase o una autovaloración.'));
 for(const entry of recent){
  const card=node('article','obs-entry');
  card.append(node('strong','',title(entry.dimension)+' · '+entry.date),
   node('small','',entry.source==='texto'?'Observación textual · sin puntuación':'Autovaloración · '+(entry.value===null?'Sin dato':entry.value+'/4')),
   node('p','',entry.evidence||'Sin frase asociada'),node('small','',entry.context));
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
 for(const item of records.hypotheses){const box=node('article','obs-entry');box.append(node('strong','',item.text),node('p','',item.plan));h.append(box);}
}
root.innerHTML=[
'<section class="obs-head"><div class="eyebrow">MI EVOLUCIÓN · INVESTIGACIÓN PERSONAL</div><h2>Observatorio emocional</h2>',
'<p>Analiza reflexiones, registra autovaloraciones y observa tendencias sin convertir el lenguaje en diagnósticos.</p>',
'<p class="obs-disclaimer">Solo texto que aportes voluntariamente. No accede automáticamente a ChatGPT. No mencionar un síntoma no equivale a intensidad cero.</p></section>',
'<div id="obs-locked" class="obs-vault"><h3>Bóveda cifrada en este dispositivo</h3>',
'<p>Contraseña propia de al menos 12 caracteres, cifrado AES-GCM y PBKDF2. Sin sincronización entre dispositivos. Si olvidas la contraseña, los registros no se pueden recuperar.</p>',
'<label for="obs-password">Contraseña de la bóveda</label><div class="obs-inline"><input type="password" id="obs-password" autocomplete="off" placeholder="Contraseña privada"><button type="button" class="button primary" id="obs-open">Abrir observatorio</button></div></div>',
'<div id="obs-private" hidden>',
'<div class="obs-toolbar"><span id="obs-count"></span><button type="button" class="button secondary" id="obs-lock">Cerrar bóveda</button><button type="button" class="button secondary" id="obs-backup">Exportar copia cifrada</button></div>',
'<section class="obs-block"><h3>Seis indicadores prioritarios</h3><p>Las gráficas utilizan únicamente autovaloraciones declaradas. Una subida no implica siempre mejoría.</p><div id="obs-metrics" class="obs-metrics"></div></section>',
'<section class="obs-block"><h3>Registrar cómo me encuentro</h3><p>Escala ordinal: 0 significa ausencia expresamente indicada; 1 leve, 2 moderada, 3 alta, 4 muy alta. Sin dato no es cero.</p>',
'<form id="obs-self-form" class="obs-form"><label>Fecha<input name="day" type="date" required></label>',
'<label>Dimensión<select name="dimension"></select></label>',
'<label>Intensidad declarada<select name="value"><option value="">Sin dato</option><option value="0">0 · Ausencia indicada</option><option value="1">1 · Leve</option><option value="2">2 · Moderada</option><option value="3">3 · Alta</option><option value="4">4 · Muy alta</option></select></label>',
'<label>Mis palabras (opcional)<textarea name="evidence" maxlength="300" rows="2" placeholder="Hoy me he sentido…"></textarea></label>',
'<label>Contexto (opcional)<input name="context" maxlength="160" placeholder="Trabajo, estudio, ejercicio…"></label><button type="submit" class="button primary">Guardar autovaloración</button></form></section>',
'<section class="obs-block"><h3>Clasificar una reflexión</h3><p>El texto se analiza en este navegador mediante coincidencias literales, sin enviar nada a servicios externos. Se guarda solo si eliges hacerlo. Cada observación conserva una frase, pero no recibe una puntuación inventada.</p>',
'<label for="obs-text">Fragmento de conversación o diario</label><textarea id="obs-text" maxlength="6000" rows="5" placeholder="Pega el fragmento que quieras clasificar, sin datos de terceros."></textarea>',
'<div class="obs-inline"><button class="button primary" id="obs-analyze" type="button">Identificar indicadores</button><button class="button secondary" id="obs-clear" type="button">Limpiar</button></div><div id="obs-suggestions" class="obs-suggestions"></div></section>',
'<section class="obs-block"><h3>Analizar mi historial recuperado</h3><p>Lee solo las reflexiones y situaciones ya importadas en este navegador. Las coincidencias se buscan en tus palabras, no en los resúmenes de IA. Revisa las propuestas antes de guardar. No se modifica el historial original ni se envía texto a otro servicio.</p>',
'<div class="obs-form"><label>Desde (opcional)<input type="date" id="obs-history-from"></label><label>Hasta (opcional)<input type="date" id="obs-history-to"></label></div>',
'<div class="obs-inline"><button type="button" id="obs-history-scan" class="button primary">Revisar historial</button><button type="button" id="obs-history-save" class="button secondary" hidden>Guardar seleccionados sin puntuación</button></div>',
'<p id="obs-history-status" role="status" aria-live="polite"></p><div id="obs-history-list" class="obs-suggestions"></div></section>',
'<section class="obs-block"><h3>Historial de evidencias</h3><div id="obs-entries" class="obs-entry-list"></div></section>',
'<section class="obs-block"><h3>Resultados de cuestionarios</h3><p>Registro manual de instrumentos realizados fuera de Rumbo. Los resultados no se interpretan clínicamente. WHO-5: escala original 0–25.</p>',
'<form class="obs-form" id="obs-q-form"><label>Instrumento<select name="instrument"><option>PHQ-9</option><option>GAD-7</option><option>WHO-5</option><option>OCI-R</option><option>WSAS</option></select></label>',
'<label>Fecha<input name="day" type="date" required></label><label>Puntuación total<input type="number" name="total" min="0" max="150" step="1" required></label><button type="submit" class="button secondary">Registrar puntuación</button></form><div id="obs-questionnaires"></div></section>',
'<section class="obs-block"><h3>Hipótesis y experimentos</h3><p>Contrasta relaciones considerando explicaciones alternativas. Una correlación no demuestra causalidad.</p>',
'<form class="obs-form" id="obs-h-form"><label>Hipótesis<input name="text" maxlength="300" required placeholder="El ejercicio se relaciona con un mejor estado de ánimo"></label>',
'<label>Cómo probarla<textarea name="plan" rows="3" maxlength="500" required placeholder="Registrar antes/después, contrastar con días sin ejercicio y controlar sueño."></textarea></label><button type="submit" class="button secondary">Guardar hipótesis</button></form><div id="obs-hypotheses"></div></section>',
'<section class="obs-block"><h3>Informe para la consulta</h3><p>Selecciona el periodo desde tu última consulta. Revisa y edita el informe antes de compartirlo. No se envía automáticamente ni sustituye una valoración clínica.</p>',
'<div class="obs-form"><label>Desde<input id="obs-report-from" type="date"></label><label>Hasta<input id="obs-report-to" type="date"></label>',
'<label><input type="checkbox" id="obs-report-evidence"> Incluir frases originales y contexto (opcional)</label><label><input type="checkbox" id="obs-report-hypotheses"> Incluir hipótesis y planes sin fecha (opcional)</label></div>',
'<div class="obs-inline"><button id="obs-report" class="button primary" type="button">Preparar informe</button><button id="obs-report-download" class="button secondary" type="button" hidden>Exportar texto revisado</button></div>',
'<textarea id="obs-report-text" rows="14" hidden aria-label="Informe descriptivo" autocomplete="off" spellcheck="false"></textarea><p>La exportación es un archivo de texto sin cifrar. Compártelo únicamente por un canal seguro con el profesional que elijas.</p></section></div>',
'<p id="obs-status" role="status" aria-live="polite"></p>'
].join('');
$('obs-open').addEventListener('click',()=>void unlock());
$('obs-password').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void unlock();}});
$('obs-lock').addEventListener('click',()=>{toggle(true);$('obs-text').value='';$('obs-suggestions').replaceChildren();$('obs-report-text').value='';$('obs-report-text').hidden=true;say('Bóveda cerrada.');});
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
 const text=$('obs-text').value.trim(),box=$('obs-suggestions');box.replaceChildren();
 if(!text){say('Pega primero un fragmento.');return;}
 const found=classify(text);
 if(!found.length){box.append(node('p','obs-empty','No hay coincidencias explícitas. No se asigna ninguna puntuación.'));return;}
 for(const result of found){
  const div=node('article','obs-suggestion');
  div.append(node('strong','',title(result.dimension)),node('p','',result.evidence),node('small','','Posible indicador · coincidencia literal; requiere revisión.'));
  const button=node('button','button secondary','Guardar sin puntuación');button.type='button';
  button.addEventListener('click',async()=>{
   try{const entry={id:crypto.randomUUID(),date:day(),dimension:result.dimension,source:'texto',value:null,evidence:result.evidence,context:'Fragmento aportado voluntariamente'};
    await save({...records,entries:[...records.entries,entry]});button.disabled=true;say('Observación guardada sin puntuación.');
   }catch{say('No se pudo guardar.');}
  });div.append(button);box.append(div);
 }
});
$('obs-clear').addEventListener('click',()=>{$('obs-text').value='';$('obs-suggestions').replaceChildren();});
$('obs-q-form').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.currentTarget.elements,n=Number(f.total.value),max={'PHQ-9':27,'GAD-7':21,'WHO-5':25,'OCI-R':72,'WSAS':40};
 if(!dateOK(f.day.value)||!Number.isInteger(n)||n<0||n>max[f.instrument.value]){say('Fecha o puntuación fuera del rango del instrumento.');return;}
 try{await save({...records,questionnaires:[...records.questionnaires,{id:crypto.randomUUID(),date:f.day.value,instrument:f.instrument.value,total:n}]});f.total.value='';say('Resultado manual registrado sin interpretación clínica.');}
 catch{say('No se pudo guardar.');}
});
$('obs-h-form').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.currentTarget.elements,h={id:crypto.randomUUID(),text:f.text.value.trim().slice(0,300),plan:f.plan.value.trim().slice(0,500)};
 if(!h.text||!h.plan)return;
 try{await save({...records,hypotheses:[...records.hypotheses,h]});f.text.value='';f.plan.value='';say('Hipótesis por contrastar guardada.');}
 catch{say('No se pudo guardar.');}
});

const historyStatus=t=>{$('obs-history-status').textContent=t;};
function resetHistory(){
 historyCandidates=[];$('obs-history-list').replaceChildren();$('obs-history-save').hidden=true;
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
$('obs-history-scan').addEventListener('click',async()=>{
 if(locked||historyBusy)return;
 resetHistory();historyBusy=true;$('obs-history-scan').disabled=true;
 const active=key,from=$('obs-history-from').value,to=$('obs-history-to').value;
 try{
  if((from&&!strictDay(from))||(to&&!strictDay(to))||(from&&to&&from>to))throw Error('Selecciona fechas válidas.');
  const raw=localStorage.getItem('rumbo-historial-importado-v1');
  if(!raw){historyStatus('No hay historial recuperado en este navegador. Importa o recupera primero tu historial en Rumbo.');return;}
  const store=JSON.parse(raw);
  if(!window.RumboHistoryVault?.validStore(store))throw Error('El historial tiene un formato incompatible; no se ha modificado.');
  const seen=new Set([...(records.historySeen||[]),...records.entries.map(e=>e.id)]);
  const proposed=[],limit=200;let missing=0,matched=0;
  for(const item of [...store.entries].sort((a,b)=>b.date.localeCompare(a.date))){
   const p=item.payload;
   // No usar el resumen de IA como si fueran palabras del usuario.
   const text=item.kind==='reflection'?p.reported:p.text;
   // No atribuir al acontecimiento una fecha de importación. Si solo existe recordedAt,
   // se indica explícitamente que es la fecha registrada, no la del suceso.
   const original=item.kind==='reflection'?historicalDate(p.date):historicalDate(item.date);
   const date=original||(item.kind==='reflection'?historicalDate(p.recordedAt):'');
   if(typeof text!=='string'||!text.trim()||!date){missing++;continue;}
   if((from&&date<from)||(to&&date>to))continue;
   const source=item.kind==='reflection'&&typeof p.sourceReference==='string'&&p.sourceReference.trim()?'reflection:'+p.sourceReference:item.id;
   for(const hit of classify(text.slice(0,12000))){
    const id=await historyId(source,hit.dimension);
    if(seen.has(id))continue;
    seen.add(id);matched++;
    if(proposed.length>=limit)continue;
    proposed.push({id,date,dimension:hit.dimension,source:'texto',value:null,evidence:hit.evidence,context:original?'Historial recuperado · palabras atribuidas al usuario':'Historial recuperado · fecha del registro, no necesariamente del suceso'});
   }
  }
  if(locked||key!==active||from!==$('obs-history-from').value||to!==$('obs-history-to').value)return;
  historyCandidates=proposed;
  for(const entry of proposed){
   const card=node('article','obs-suggestion'),label=node('label',''),check=node('input','');
   check.type='checkbox';check.dataset.historyId=entry.id;
   label.append(check,document.createTextNode(' '+title(entry.dimension)+' · '+entry.date));
   card.append(label,node('p','',entry.evidence),node('small','',entry.context+' · coincidencia literal; no diagnóstico'));
   $('obs-history-list').append(card);
  }
  $('obs-history-save').hidden=!proposed.length;
  historyStatus(matched+' propuestas nuevas; '+proposed.length+' visibles. '+missing+' registros sin texto atribuible o fecha válida (no clasificados). '+(matched>limit?'Acota las fechas para revisar las restantes. ':'')+'Selecciona solo las que consideres pertinentes.');
 }catch(e){if(!locked&&key===active)historyStatus(e.message||'No se pudo revisar el historial.');}
 finally{historyBusy=false;$('obs-history-scan').disabled=false;}
});
$('obs-history-save').addEventListener('click',async()=>{
 if(locked||historyBusy)return;
 const chosen=new Set(Array.from($('obs-history-list').querySelectorAll('input:checked'),x=>x.dataset.historyId));
 const seen=new Set([...(records.historySeen||[]),...records.entries.map(e=>e.id)]);
 const selected=historyCandidates.filter(e=>chosen.has(e.id)&&!seen.has(e.id));
 if(!selected.length){historyStatus('Selecciona al menos una propuesta nueva.');return;}
 if(records.entries.length+selected.length>2000){historyStatus('Se supera el límite de 2.000 indicadores; selecciona menos.');return;}
 historyBusy=true;$('obs-history-save').disabled=true;const active=key;
 try{
  await save({...records,entries:[...records.entries,...selected],historySeen:[...new Set([...(records.historySeen||[]),...selected.map(e=>e.id)])]});
  if(locked||key!==active)return;
  historyCandidates=historyCandidates.filter(x=>!chosen.has(x.id));
  for(const input of $('obs-history-list').querySelectorAll('input:checked'))input.closest('article').remove();
  $('obs-history-save').hidden=!historyCandidates.length;
  historyStatus(selected.length+' observaciones guardadas cifradas, sin puntuación. No se modifica el historial original.');
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
 'Observaciones textuales sin puntuación: '+observed.length,
 'Los días sin registro no equivalen a ausencia de síntomas.',
 '', '2. EVOLUCIÓN DECLARADA (escala ordinal 0–4, intensidad; no siempre una subida es mejoría)'];
 for(const [id,label] of DIM){
  const p=series(id,e);if(!p.length)continue;
  lines.push(label+': '+p.length+' días · primera '+p[0].value+'/4 ('+p[0].day+') · última '+p[p.length-1].value+'/4 ('+p[p.length-1].day+') · '+trend(p)+'.');
 }
 if(!self.some(x=>x.value!==null))lines.push('Sin autovaloraciones numéricas en este periodo.');
 lines.push('', '3. TEMAS MENCIONADOS (coincidencias textuales revisables; no frecuencia de síntomas)');
 for(const [id,label] of DIM){
  const matches=observed.filter(x=>x.dimension===id);
  if(matches.length)lines.push(label+': '+matches.length+' registros en '+new Set(matches.map(x=>x.date)).size+' días.');
 }
 if(!observed.length)lines.push('Sin observaciones textuales guardadas.');
 lines.push('', '4. CUESTIONARIOS (puntuación manual, sin interpretación)');
 const q=records.questionnaires.filter(inPeriod).sort((a,b)=>a.date.localeCompare(b.date));
 lines.push(...(q.length?q.map(x=>x.date+' · '+x.instrument+': '+x.total):['Sin resultados registrados.']));
 if($('obs-report-evidence').checked){
  lines.push('', '5. FRAGMENTOS Y CONTEXTO (revisar antes de compartir)');
  const examples=e.filter(x=>x.evidence||x.context).sort((a,b)=>b.date.localeCompare(a.date));
  lines.push(...(examples.length?examples.slice(0,20).map(x=>x.date+' · '+title(x.dimension)+' · '+(x.source==='texto'?'observación sin puntuación':'autovaloración')+(x.evidence?': '+x.evidence:'')+(x.context?' | Contexto: '+x.context:'')):['Sin fragmentos asociados.']));
  if(examples.length>20)lines.push('Se muestran los 20 registros más recientes de '+examples.length+'.');
 }
 if($('obs-report-hypotheses').checked){
  lines.push('', 'HIPÓTESIS Y EXPERIMENTOS (sin fecha; no necesariamente del periodo)');
  lines.push(...(records.hypotheses.length?records.hypotheses.map(h=>h.text+' | Plan: '+h.plan):['Sin hipótesis guardadas.']));
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
})();