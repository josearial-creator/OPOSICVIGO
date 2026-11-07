(() => {
'use strict';
const root=document.getElementById('mi-entrenamiento');
const dataApi=window.RumboRunningData;
if(!root||!dataApi)return;
const DB='rumbo-running-private-v1';
let state={version:1,activities:[],measurements:[]},storeError=null,busy=false,view='dist';
const $=s=>root.querySelector(s);
const fmt=n=>n===null||n===undefined||!Number.isFinite(Number(n))?'—':Number(n).toLocaleString('es-ES',{maximumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const clock=s=>{if(s===null||s===undefined||!Number.isFinite(Number(s)))return '—';let n=Math.round(s);return n>=3600?Math.floor(n/3600)+':'+String(Math.floor(n%3600/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'):Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
const pace=a=>a.distanceKm&&a.durationSeconds?clock(a.durationSeconds/a.distanceKm)+'/km':'—';
const dateLabel=s=>s?String(s).split('-').reverse().join('/'):'Fecha por confirmar';
function db(){
 return new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('data'))r.result.createObjectStore('data');};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error||Error('IndexedDB no disponible'));});
}
async function read(){const conn=await db();return new Promise((ok,no)=>{const tx=conn.transaction('data','readonly');const rq=tx.objectStore('data').get('snapshot');rq.onsuccess=()=>ok(rq.result||null);rq.onerror=()=>no(rq.error);tx.oncomplete=()=>conn.close();tx.onerror=()=>conn.close();});}
async function write(snapshot){
 const conn=await db();
 return new Promise((ok,no)=>{const tx=conn.transaction('data','readwrite');tx.objectStore('data').put(snapshot,'snapshot');tx.oncomplete=()=>{conn.close();ok();};tx.onerror=()=>{conn.close();no(tx.error||Error('Error de almacenamiento'));};tx.onabort=()=>{conn.close();no(tx.error||Error('Guardado cancelado'));};});
}
function report(message,error=false){const el=$('#run-status');if(el){el.textContent=message;el.classList.toggle('run-error',error);}}
function bars(){
 const entries=state.activities.filter(a=>a.date&&a.distanceKm>0).slice().sort((a,b)=>a.date.localeCompare(b.date));
 const months=[...new Set(entries.map(a=>a.date.slice(0,7)))].slice(-6);
 if(!months.length)return '<p class="run-muted">Importa tu historial para visualizar kilómetros por mes.</p>';
 const sums=months.map(m=>({month:m,km:entries.filter(a=>a.date.startsWith(m)).reduce((s,a)=>s+a.distanceKm,0)}));
 const max=Math.max(...sums.map(x=>x.km),1);
 return '<div class="run-bars" role="img" aria-label="Kilómetros por mes: '+esc(sums.map(x=>x.month+' '+x.km.toFixed(1)+' km').join(', '))+'">'+sums.map(x=>'<div class="run-bar"><strong>'+fmt(x.km)+' km</strong><span style="height:'+Math.max(3,Math.round(x.km/max*104))+'px"></span><small>'+esc(x.month.slice(5))+'/'+esc(x.month.slice(2,4))+'</small></div>').join('')+'</div>';
}
function linePlot(){
 const items=state.activities.filter(a=>a.date&&a.distanceKm>=3&&a.durationSeconds&&/carrera|run|treadmill|cinta|race|trail|test/i.test(a.type+' '+a.title)).slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(-16);
 if(items.length<2)return '<p class="run-muted">Necesitas al menos dos carreras con distancia y duración para comparar ritmos.</p>';
 const vals=items.map(a=>a.durationSeconds/a.distanceKm),min=Math.max(180,Math.min(...vals)-25),max=Math.max(...vals)+25;
 const points=vals.map((n,i)=>(24+i*320/(vals.length-1)).toFixed(1)+','+(135-(n-min)/(max-min)*110).toFixed(1)).join(' ');
 return '<svg class="run-line" viewBox="0 0 365 165" role="img" aria-label="'+esc(items.map((a,i)=>a.date+' '+clock(vals[i])+'/km').join(', '))+'"><line x1="24" y1="20" x2="24" y2="135"/><line x1="24" y1="135" x2="348" y2="135"/><polyline fill="none" stroke="#1766ab" stroke-width="3" points="'+points+'"/>'+vals.map((n,i)=>'<circle cx="'+(24+i*320/(vals.length-1)).toFixed(1)+'" cy="'+(135-(n-min)/(max-min)*110).toFixed(1)+'" r="3.8" fill="#1766ab"><title>'+esc(items[i].date+' '+clock(n)+'/km')+'</title></circle>').join('')+'<text x="24" y="157">'+esc(items[0].date)+'</text><text x="260" y="157">'+esc(items[items.length-1].date)+'</text></svg><p class="run-muted">El ritmo incluye entrenamientos de distinta intensidad, relieve y calentamiento. No debe interpretarse directamente como una mejora o empeoramiento.</p>';
}
function metric(kind){return state.measurements.filter(m=>m.kind===kind&&m.date).sort((a,b)=>b.date.localeCompare(a.date))[0]||null;}
function recent(){
 const all=state.activities.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,16);
 if(!all.length)return '<p class="run-muted">Sin actividades todavía. Puedes importar un CSV de Garmin o el historial recopilado.</p>';
 return '<div class="run-history">'+all.map(a=>
 '<details class="run-session"><summary><strong>'+esc(dateLabel(a.date))+' · '+esc(a.title||a.type)+'</strong><span>'+fmt(a.distanceKm)+' km · '+pace(a)+'</span></summary><div class="run-details">'+
 '<p><b>Duración:</b> '+clock(a.durationSeconds)+' · <b>FC media:</b> '+fmt(a.avgHr)+' ppm · <b>FC máxima:</b> '+fmt(a.maxHr)+' ppm</p>'+
 '<p><b>Desnivel positivo:</b> '+fmt(a.ascentM)+' m · <b>Cadencia:</b> '+fmt(a.cadence)+' pasos/min</p>'+
 '<p><b>Training Effect:</b> '+fmt(a.aerobic)+' aeróbico / '+fmt(a.anaerobic)+' anaeróbico · <b>Carga:</b> '+fmt(a.load)+'</p>'+
 (a.testDistanceKm&&a.testDurationSeconds?'<p><b>Test dentro de la actividad:</b> '+fmt(a.testDistanceKm)+' km en '+clock(a.testDurationSeconds)+'</p>':'')+
 (a.notes?'<p><b>Observaciones:</b> '+esc(a.notes)+'</p>':'')+
 '<small>Fuente: '+esc(a.source||'Sin identificar')+' · Fecha: '+esc(a.dateConfidence||'confirmada')+'</small></div></details>'
 ).join('')+'</div>';
}
function render(){
 const total=state.activities.length,dist=state.activities.reduce((s,a)=>s+(a.distanceKm||0),0);
 const vo2=metric('vo2'),umbral=metric('lactate_hr'),pron=metric('prediction_half');
 const recordedTest=state.activities.filter(a=>a.testDistanceKm===10&&a.testDurationSeconds).sort((a,b)=>b.date.localeCompare(a.date))[0];
 root.innerHTML=[
 '<div class="panel-head"><div><div class="eyebrow">SALUD Y EJERCICIO · REGISTRO PERSONAL</div><h2>Mi entrenamiento</h2><p>Historial, evolución y objetivos de running. Tus datos quedan en este navegador.</p></div></div>',
 '<div class="run-body">',
 '<p id="run-status" class="run-status" role="status" aria-live="polite">'+(storeError?esc(storeError):'Los datos se guardan localmente en este dispositivo. Haz copias de seguridad periódicas.')+'</p>',
 '<div class="run-summary"><article><span>Actividades importadas</span><strong>'+total+'</strong></article><article><span>Kilómetros registrados</span><strong>'+fmt(dist)+'</strong></article><article><span>VO₂ máx. (último)</span><strong>'+(vo2?fmt(vo2.value):'—')+'</strong></article><article><span>Umbral (FC)</span><strong>'+(umbral?fmt(umbral.value)+' ppm':'—')+'</strong></article></div>',
 '<div class="run-goal"><strong>Seguimiento del objetivo de media maratón</strong><p>Meta: 1:40:00 · Último pronóstico documentado: '+(pron?clock(pron.value):'sin importar')+' · Último test 10 km: '+(recordedTest?clock(recordedTest.testDurationSeconds):'sin importar')+'</p><small>Las predicciones de Garmin no equivalen a marcas reales.</small></div>',
 '<div class="run-grid"><section class="run-card"><h3>Kilómetros por mes</h3>'+bars()+'</section><section class="run-card"><h3>Ritmo en entrenamientos</h3>'+linePlot()+'</section></div>',
 '<section class="run-card"><h3>Importar registros</h3><p>Importa <strong>CSV de todas las actividades</strong> exportado de Garmin Connect o una copia JSON de Rumbo. Las importaciones repetidas se fusionan para evitar duplicados.</p><div class="run-actions"><label class="button secondary">Importar CSV o JSON<input id="run-file" type="file" accept=".csv,.json,text/csv,application/json" hidden></label><button class="button secondary" type="button" id="run-export">Exportar copia privada JSON</button></div><p class="run-muted">No admite FIT/ZIP todavía. La conexión automática con Garmin y sus métricas avanzadas se incorporarán en una fase posterior. Nunca introduzcas claves Garmin aquí.</p><a href="https://support.garmin.com/?faq=W1TvTPW8JZ6LfJSfK512Q8" target="_blank" rel="noopener noreferrer">Instrucciones oficiales para exportar CSV en Garmin Connect</a></section>',
 '<section class="run-card"><details><summary><strong>Añadir una sesión manual</strong></summary><form id="run-manual" class="run-manual"><label>Fecha<input type="date" name="date" required></label><label>Actividad<input name="title" maxlength="100" value="Carrera" required></label><label>Distancia (km)<input type="number" name="distance" min="0" max="500" step="0.01" required></label><label>Tiempo (hh:mm:ss o mm:ss)<input name="duration" pattern="[0-9:.]+" placeholder="45:00" required></label><label>FC media (opcional)<input name="hr" type="number" min="30" max="240"></label><label>Notas<textarea name="notes" rows="2" maxlength="1200"></textarea></label><button class="button primary" type="submit">Guardar actividad</button></form></details></section>',
 '<section class="run-card"><h3>Historial de entrenamientos</h3>'+recent()+'</section>',
 '<p class="run-muted">Las mediciones históricas incluidas manualmente pueden tener campos sin verificar. No se envía ninguna actividad a GitHub, Garmin ni a otros servidores desde este módulo.</p>',
 '</div>'
 ].join('');
 $('#run-export').onclick=exportData;
 $('#run-file').onchange=importFile;
 $('#run-manual').onsubmit=saveManual;
}
function exportData(){
 const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download='rumbo-entrenamientos-copia.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function safeActivity(a){
 if(!a||typeof a!=='object'||!dataApi.validDay(a.date))return null;
 const n={...a};
 const numeric=['distanceKm','durationSeconds','avgHr','maxHr','ascentM','cadence','aerobic','anaerobic','load','testDistanceKm','testDurationSeconds'];
 for(const k of numeric){n[k]=n[k]===undefined||n[k]===null?null:Number(n[k]);if(n[k]!==null&&(!Number.isFinite(n[k])||n[k]<0||n[k]>10000000))return null;}
 if(n.distanceKm===null&&n.durationSeconds===null)return null;
 n.id=String(n.id||'manual:'+n.date+':'+(n.distanceKm??'x')+':'+(n.durationSeconds??'x')).slice(0,150);
 n.title=String(n.title||'Actividad').slice(0,150);n.type=String(n.type||'Carrera').slice(0,80);
 n.source=String(n.source||'importado').slice(0,50);n.notes=String(n.notes||'').slice(0,1200);
 n.dateConfidence=String(n.dateConfidence||'confirmada').slice(0,80);
 return n;
}
function safeMeasurement(m){
 if(!m||!dataApi.validDay(m.date)||!['vo2','lactate_hr','lactate_pace','prediction_half'].includes(m.kind))return null;
 const value=Number(m.value);if(!Number.isFinite(value)||value<0||value>100000)return null;
 return {kind:m.kind,date:m.date,value,source:String(m.source||'aportado').slice(0,50)};
}
async function importFile(e){
 const file=e.target.files?.[0];if(!file)return;
 if(busy)return;busy=true;
 try{
  if(file.size>12*1024*1024)throw Error('Archivo superior a 12 MB. Divide el historial en varios CSV.');
  const str=await file.text();let activities=[],measurements=[];
  if(/\.csv$/i.test(file.name)){activities=dataApi.delimited(str).map(r=>dataApi.normalise(r)).filter(Boolean);if(!activities.length)throw Error('No se reconocieron actividades con fecha, tiempo o distancia. Comprueba que sea el CSV de «Todas las actividades» de Garmin.');}
  else if(/\.json$/i.test(file.name)){
   const x=JSON.parse(str);if(!Array.isArray(x.activities))throw Error('El JSON no tiene el formato de copia de Rumbo (activities).');
   activities=x.activities;measurements=Array.isArray(x.measurements)?x.measurements:[];
  }else throw Error('Formato no admitido. Utiliza CSV o JSON.');
  if(activities.length>20000||measurements.length>10000)throw Error('Demasiados registros en un solo archivo.');
  const invalid=activities.filter(a=>!safeActivity(a));if(invalid.length)throw Error('Hay '+invalid.length+' actividades con fechas o datos inválidos. No se ha guardado nada.');
  const incoming=activities.map(safeActivity),merged=dataApi.merge(state.activities,incoming);
  const m=[...state.measurements];
  measurements.map(safeMeasurement).filter(Boolean).forEach(x=>{const at=m.findIndex(y=>y.kind===x.kind&&y.date===x.date);if(at>=0)m[at]=x;else m.push(x);});
  const updated={version:1,activities:merged.activities,measurements:m};
  await write(updated);state=updated;render();report('Importación guardada: '+merged.added+' actividades nuevas, '+merged.updated+' coincidentes actualizadas y '+m.length+' mediciones históricas.');
 }catch(err){report('No se ha importado: '+err.message,true);}
 finally{busy=false;e.target.value='';}
}
async function saveManual(e){
 e.preventDefault();if(busy)return;
 const f=new FormData(e.target);const date=String(f.get('date')||'');
 const duration=dataApi.seconds(f.get('duration')),distance=dataApi.number(f.get('distance'));
 if(!dataApi.validDay(date)||duration===null||distance===null||duration<=0||distance<0){report('Revisa fecha, distancia y duración.',true);return;}
 const a=safeActivity({id:'manual:'+Date.now(),source:'manual',date,dateConfidence:'confirmada',title:f.get('title'),type:'Carrera',distanceKm:distance,durationSeconds:duration,avgHr:dataApi.number(f.get('hr')),notes:f.get('notes')});
 if(!a)return;
 busy=true;try{const x=dataApi.merge(state.activities,[a]);const next={...state,activities:x.activities};await write(next);state=next;render();report('Actividad guardada de forma local.');}catch(err){report('No se ha guardado: '+err.message,true);}finally{busy=false;}
}
(async()=>{try{const saved=await read();if(saved){if(saved.version!==1||!Array.isArray(saved.activities)||!Array.isArray(saved.measurements))throw Error('Formato de datos locales no reconocido; no se sobrescribirá.');state=saved;}}catch(err){storeError='No se ha podido leer el almacenamiento privado: '+err.message+'. No se alterarán los datos existentes.';busy=true;}render();})();
})();