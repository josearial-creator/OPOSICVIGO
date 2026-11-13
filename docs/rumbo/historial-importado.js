(() => {
'use strict';
const root=document.getElementById('historial-rumbo'); if(!root)return;
const KEY='rumbo-historial-importado-v1',MAX_FILE=8*1024*1024,MAX_RECORDS=5000;
const vault=window.RumboHistoryVault;
const $=id=>document.getElementById(id);
const categories={reflection:'Reflexión de ChatGPT',situation:'Situación del diario',quick:'Apunte del diario'};
const cleanText=v=>typeof v==='string'?v:'';
const cleanDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v)?v.slice(0,30):'';
const dateLabel=d=>{const v=new Date(d);return Number.isFinite(v.getTime())?v.toLocaleDateString('es-ES'):'Sin fecha'};
const empty=()=>({version:1,entries:[]});
function validRecord(x){return x&&typeof x==='object'&&['reflection','situation','quick'].includes(x.kind)&&typeof x.id==='string'&&x.id.length>0&&x.id.length<=260&&typeof x.date==='string'&&typeof x.title==='string'&&x.payload&&typeof x.payload==='object'&&!Array.isArray(x.payload);}
function validStore(x){return x?.version===1&&Array.isArray(x.entries)&&x.entries.length<=MAX_RECORDS&&x.entries.every(validRecord)&&new Set(x.entries.map(y=>y.id)).size===x.entries.length;}
let state=empty(),locked=false;
try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(!validStore(parsed))throw Error('Copia incompatible');state=parsed;}}catch{locked=true;}
const message=s=>{
 $('historic-status').textContent=s;
 const homeStatus=document.getElementById('history-home-status');
 if(homeStatus)homeStatus.textContent=s;
};
const label=(tag,cl,content)=>{const e=document.createElement(tag);if(cl)e.className=cl;if(content!==undefined)e.textContent=String(content);return e;};
function sourceHref(value){
 if(typeof value!=='string')return null;
 try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}
}
function fromReflections(obj){
 if(!Array.isArray(obj.records)||obj.records.length>MAX_RECORDS)throw Error('Lista de reflexiones no válida.');
 return obj.records.map((r,i)=>{
  if(!r||typeof r.id!=='string'||!r.id||typeof r.title!=='string'||typeof r.summary!=='string')throw Error('Reflexión incompleta en posición '+(i+1));
  return {id:'reflection:'+r.id,kind:'reflection',date:cleanDate(r.recordedAt)||cleanDate(r.date),title:r.title||'Reflexión sin título',payload:r};
 });
}
function fromPsychology(psychology){
 if(!psychology||!Array.isArray(psychology.days)||psychology.days.length>3000)throw Error('Diario sin días válidos.');
 const entries=[];
 for(const day of psychology.days){
  if(!day||!/^\d{4}-\d{2}-\d{2}$/.test(day.date)||!Array.isArray(day.situations))throw Error('Día del diario incompatible.');
  for(let i=0;i<day.situations.length;i++){
   const s=day.situations[i];if(!s||typeof s.text!=='string'||!s.text.trim())throw Error('Situación del diario incompatible.');
   const marker=typeof s.id==='string'&&s.id?s.id:String(i);
   entries.push({id:'situation:'+day.date+':'+marker,kind:'situation',date:day.date,title:s.text.slice(0,100),payload:s});
  }
  const quick=day.quick;
  if(quick&&typeof quick==='object'&&[quick.text,quick.stop,quick.help].some(v=>typeof v==='string'&&v.trim())){
   entries.push({id:'quick:'+day.date,kind:'quick',date:day.date,title:cleanText(quick.text).slice(0,100)||'Apunte rápido',payload:quick});
  }
 }
 if(entries.length>MAX_RECORDS)throw Error('Diario demasiado grande.');
 return entries;
}
function extract(obj){
 if(!obj||typeof obj!=='object')throw Error('Archivo sin datos.');
 let result=[];
 if(obj.type==='rumbo-historial-importado'&&validStore(obj.data))return obj.data.entries;
 if(obj.type==='rumbo-chatgpt-reflections')result=fromReflections(obj);
 else if(obj.type==='rumbo-migracion-local-v1'&&Array.isArray(obj.reflections)&&obj.psychology){
  result=[...fromReflections({records:obj.reflections}),...fromPsychology(obj.psychology)];
 }else if(obj.psychology?.days)result=fromPsychology(obj.psychology);
 else throw Error('Archivo no reconocido: utiliza una copia de reflexiones o diario de Rumbo.');
 if(!result.length)throw Error('Este archivo no contiene anotaciones.');
 if(result.some(v=>!validRecord(v)))throw Error('Algunas entradas no son válidas.');
 return result;
}
root.innerHTML=`<div class="panel-head"><div><div class="eyebrow">TUS DATOS ANTERIORES</div><h2>Historial recuperado</h2><p class="lead">Reflexiones y situaciones importadas desde Rumbo anterior, sin perder sus textos originales.</p></div></div>
<div class="historic-body">
 <div class="historic-metrics" aria-label="Contadores del historial">
 <article><strong id="historic-total">0</strong><span>Registros importados</span></article>
 <article><strong id="historic-reflections">0</strong><span>Reflexiones ChatGPT</span></article>
 <article><strong id="historic-situations">0</strong><span>Situaciones del diario</span></article>
 <article><strong id="historic-quick">0</strong><span>Apuntes rápidos</span></article>
 </div>
 <section class="historic-vault" aria-label="Archivo protegido del historial">
 <h3>Archivo de seguridad independiente</h3>
 <p id="historic-vault-status" role="status">Comprobando copias guardadas en este navegador…</p>
 <div class="historic-toolbar">
  <button id="historic-vault-restore" class="button secondary" type="button">Recuperar desde bóveda</button>
  <button id="historic-vault-persist" class="button secondary" type="button">Reforzar conservación</button>
  <a class="button secondary" href="#copias-rumbo">Descargar copia cifrada</a>
 </div>
 <p class="historic-vault-warning">La bóveda conserva versiones anteriores incluso después de actualizar el diseño. Está en este mismo navegador: borrar los datos del sitio también puede borrarla. Conserva una copia cifrada en un lugar privado externo.</p>
 </section>
 <div class="historic-import">
 <h3>Importar mis registros anteriores</h3>
 <p>Selecciona la copia preparada de 132 registros o los archivos originales <code>rumbo-reflexiones-chatgpt</code> y <code>rumbo-diario</code>. Puedes seleccionar más de un archivo. Se añaden únicamente las entradas nuevas: no se borran ni sustituyen las anteriores.</p>
 <label>Archivos JSON de Rumbo<input id="historic-files" type="file" multiple accept=".json,application/json"></label>
 <div class="historic-toolbar"><button class="button primary" id="historic-import" type="button">Importar sin duplicar</button><button class="button secondary" id="historic-export" type="button">Exportar historial recuperado</button></div>
 <p id="historic-status" role="status" aria-live="polite"></p>
 <p class="historic-privacy">Privacidad: los archivos se procesan únicamente en este navegador. No se suben a GitHub, Vercel ni ChatGPT. Para verlos en otro dispositivo, importa la copia allí o usa la copia cifrada de «Más».</p>
 </div>
 <div class="historic-toolbar historic-searchbar"><label>Buscar<input type="search" id="historic-search" placeholder="Buscar en títulos y textos"></label><label>Mostrar<select id="historic-filter"><option value="all">Todos los tipos</option><option value="reflection">Reflexiones</option><option value="situation">Situaciones</option><option value="quick">Apuntes rápidos</option></select></label></div>
 <div id="historic-list" class="historic-list"></div><button id="historic-more" class="button secondary" type="button" hidden>Mostrar 20 registros más</button>
</div>`;
let shown=20;
function field(parent,name,value){
 if(value===null||value===undefined||value==='')return;
 const p=label('p','historic-field');const strong=label('strong','',name+': ');p.append(strong,document.createTextNode(String(value)));parent.append(p);
}
function paint(){
 const counts={reflection:0,situation:0,quick:0};
 for(const item of state.entries)counts[item.kind]++;
 $('historic-total').textContent=state.entries.length;
 const summary=document.getElementById('history-recovery-count');
 if(summary)summary.textContent=state.entries.length
  ?state.entries.length+' registros disponibles en este navegador'
  :'Aún no hay registros importados en este navegador. Puedes recuperar tu copia JSON.';
 $('historic-reflections').textContent=counts.reflection;
 $('historic-situations').textContent=counts.situation;
 $('historic-quick').textContent=counts.quick;
 const q=$('historic-search').value.trim().toLocaleLowerCase('es'),kind=$('historic-filter').value;
 const filtered=state.entries.filter(item=>{
  if(kind!=='all'&&item.kind!==kind)return false;
  if(!q)return true;
  const p=item.payload||{};
  return [item.title,p.summary,p.reported,p.text,p.stop,p.help,p.sourceProject].map(cleanText).join(' ').toLocaleLowerCase('es').includes(q);
 }).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
 const fragment=document.createDocumentFragment();
 for(const item of filtered.slice(0,shown)){
  const details=label('details','historic-record');
  const summary=label('summary','historic-record-title');
  summary.append(label('span','historic-kind',categories[item.kind]),label('strong','',item.title.slice(0,160)),label('time','',dateLabel(item.date)));
  details.append(summary);
  const body=label('div','historic-record-content'),p=item.payload;
  if(item.kind==='reflection'){
   field(body,'Resumen',p.summary);field(body,'Palabras del usuario',p.reported);
   field(body,'Proyecto',p.sourceProject);field(body,'Origen',p.sourceLabel||p.sourceReference);
   const href=sourceHref(p.conversationUrl);
   if(href){const a=label('a','historic-source','Abrir conversación original');a.href=href;a.target='_blank';a.rel='noopener noreferrer';body.append(a);}
  }else if(item.kind==='situation'){
   field(body,'Situación',p.text);field(body,'Nerviosismo',p.nerves);
   field(body,'Efecto túnel',p.tunnel);field(body,'Urgencia',p.urgency);
   field(body,'Pausa',p.pause);field(body,'Después',p.after);
  }else{field(body,'Anotación',p.text);field(body,'Parada',p.stop);field(body,'Ayuda',p.help);}
  details.append(body);fragment.append(details);
 }
 $('historic-list').replaceChildren(fragment);
 if(!filtered.length)$('historic-list').append(label('p','historic-empty',state.entries.length?'No hay resultados para esta búsqueda.':'Todavía no hay registros importados.'));
 $('historic-more').hidden=filtered.length<=shown;
 $('historic-more').textContent='Mostrar 20 registros más · '+Math.max(0,filtered.length-shown)+' restantes';
}
async function importFiles(files,goToHistory=false){
 if(locked){message('Existe un historial local incompatible. No se sobrescribirá. Conserva primero una copia de los datos originales.');return false;}
 if(!files.length){message('Selecciona tu archivo de recuperación o las copias JSON originales.');return false;}
 try{
  if(files.some(f=>f.size>MAX_FILE))throw Error('Uno de los archivos supera los 8 MB.');
  const incoming=[];
  for(const file of files){const contents=JSON.parse(await file.text());incoming.push(...extract(contents));}
  if(incoming.length>MAX_RECORDS)throw Error('Demasiados registros en los archivos.');
  const existing=new Map(state.entries.map(x=>[x.id,x])),unique=new Map();
  for(const x of incoming){
    const prior=existing.get(x.id)||unique.get(x.id);
    if(prior&&JSON.stringify(prior)!==JSON.stringify(x))
      throw Error('Conflicto: el identificador '+x.id.slice(0,40)+' ya existe con contenido distinto. No se ha sustituido ningún registro.');
    if(!prior)unique.set(x.id,x);
  }
  if(state.entries.length+unique.size>MAX_RECORDS)throw Error('Superas el límite de 5.000 entradas.');
  if(!unique.size){
    message('Todos los identificadores ya estaban importados. Historial conservado: '+state.entries.length+' registros.');
    if(goToHistory)location.hash='#historial-rumbo';
    return true;
  }
  const next={version:1,entries:[...state.entries,...unique.values()]};
  if(JSON.stringify(next).length>4000000)throw Error('La copia excede el espacio seguro de almacenamiento. Exporta tus datos.');
  if(!vault)throw Error('La bóveda independiente no está disponible; no se realizará ningún guardado.');
  const saved=await vault.mergeStore(next);
  state=saved.store;shown=20;paint();
  await refreshVault();
  const dup=incoming.length-unique.size;
  message('Importación completada: '+saved.added+' nuevos registros. '+dup+' duplicados omitidos. Total: '+state.entries.length+'. Guardado en el historial y en la bóveda independiente.');
  if(goToHistory)location.hash='#historial-rumbo';
  return true;
 }catch(err){
  message('No se han importado registros: '+err.message);
  return false;
 }
}
$('historic-import').addEventListener('click',async()=>{
 const input=$('historic-files');
 await importFiles(Array.from(input.files||[]));
 input.value='';
});
const homeInput=document.getElementById('history-home-file');
homeInput?.addEventListener('change',async()=>{
 const selected=Array.from(homeInput.files||[]);
 if(selected.length)await importFiles(selected,true);
 homeInput.value='';
});
$('historic-export').addEventListener('click',()=>{
 if(!state.entries.length){message('Todavía no hay registros para exportar.');return;}
 const blob=new Blob([JSON.stringify({type:'rumbo-historial-importado',data:state},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='rumbo-historial-recuperado.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
 message('Copia del historial descargada. Guárdala en un lugar privado.');
});
$('historic-search').addEventListener('input',()=>{shown=20;paint();});
$('historic-filter').addEventListener('change',()=>{shown=20;paint();});
$('historic-more').addEventListener('click',()=>{shown+=20;paint();});
async function refreshVault(){
 if(!vault)throw Error('Servicio de archivo independiente ausente.');
 const v=await vault.status();
 const label=v.persisted===true?' · conservación persistente concedida':v.persisted===false?' · conservación persistente no concedida':'';
 $('historic-vault-status').textContent=
  'Historial visible: '+v.current+' · Copias archivadas: '+v.snapshots+' · Última copia: '+v.archived+' registros'+
  (v.hash?' · Huella SHA-256: '+v.hash.slice(0,12):'')+label+'.';
 return v;
}
$('historic-vault-restore').addEventListener('click',async()=>{
 if(locked){message('El historial actual está dañado o es incompatible. Para evitar pérdida de datos, no se modificará.');return;}
 if(!vault){message('No se puede abrir la bóveda.');return;}
 try{
  const recovered=await vault.restore();
  state=recovered.store;shown=20;paint();await refreshVault();
  message('Recuperación verificada: '+recovered.added+' entradas restauradas sin borrar las existentes. Total: '+recovered.total+'.');
 }catch(e){message('No se pudo recuperar: '+e.message);}
});
$('historic-vault-persist').addEventListener('click',async()=>{
 if(!vault){message('No se puede abrir la bóveda.');return;}
 try{
  const granted=await vault.requestPersistence();
  await refreshVault();
  message(granted?'El navegador ha concedido almacenamiento persistente. No sustituye las copias externas.':'El navegador no ha concedido almacenamiento persistente. Guarda una copia cifrada fuera de la web.');
 }catch(e){message(e.message);}
});
paint();
if(locked)message('No se puede leer el historial guardado. No se sobrescribirá ningún registro.');
(async()=>{
 try{
  if(!vault)throw Error('El archivo independiente no se ha cargado.');
  if(!locked)await vault.protectCurrent();
  const data=await refreshVault();
  if(!locked&&data.current===0&&data.archived>0)message('Tu historial está archivado, pero no aparece en pantalla. Pulsa «Recuperar desde bóveda».');
 }catch(e){$('historic-vault-status').textContent='Archivo de seguridad no disponible: '+e.message+' Mantén una copia externa antes de importar.';}
})();
})();