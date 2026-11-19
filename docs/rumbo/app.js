'use strict';

// Código independiente. Los datos oficiales se obtienen del repositorio público indicado.
const MAIN_FEED_URL = 'https://raw.githubusercontent.com/josearial-creator/OPOSICVIGO/main/docs/importar_rumbo.json';
// La versión de revisión carga el feed de su propio despliegue, no el viejo main.
const PREVIEW_FEED = typeof location !== 'undefined' && location.hostname.endsWith('.vercel.app') &&
  !['oposicvigo.vercel.app','josearial-creatorgithubio.vercel.app'].includes(location.hostname);
const FEED_URL = PREVIEW_FEED ? new URL('../importar_rumbo.json',location.href).href : MAIN_FEED_URL;
const STORE = 'rumbo-replica-v1';
const $ = id => document.getElementById(id);
const state = { records: [], favorites: new Set(), previousKeys: new Set(), newKeys: new Set(), notes: {}, lastSuccess: null };
const node = (name, cls, value) => { const e = document.createElement(name); if (cls) e.className = cls; if (value !== undefined && value !== null) e.textContent = String(value); return e; };

function escapeKey(s) { return String(s ?? '').trim().toLocaleLowerCase('es').replace(/\s+/g, ' '); }
function legacyRecordKey(r) {
  // Vigo usa una URL general para todas las fichas: no podemos usar solo 'fuente'.
  const fields = [r.organismo, r.puesto, r.grupo, r.tipo, r.plazas, r.discapacidad];
  if (r.organismo === 'SERGAS' && r.fuente?.includes('IdCategoria=')) return 'sergas:' + r.fuente.split('IdCategoria=')[1].split('&')[0];
  return fields.map(escapeKey).join('¦');
}
// Prefer an official process ID. A category or a generic listing URL is not a process ID.
function recordKey(r) {
  const official = r.convocatoria_id ?? r.expediente ?? r.id;
  const edition = r.anio ?? r.año ?? r.ejercicio ?? '';
  if (official !== undefined && official !== null && String(official).trim()) {
    return 'v2:id:' + JSON.stringify([escapeKey(r.organismo), String(official).trim(), String(edition)]);
  }
  // Without an official ID, retain distinct versions rather than guess which process changed.
  // Keep URLs case-sensitive, and include dates/edition so a later call cannot replace an earlier one.
  return 'v2:legacy:' + JSON.stringify([
    ...[r.organismo,r.puesto,r.grupo,r.tipo,r.plazas,r.discapacidad].map(escapeKey),
    String(r.fuente ?? '').trim(), String(edition), String(r.inicio ?? ''), String(r.fin ?? '')
  ]);
}
function distinct(data) {
  const seen = new Map();
  for (const raw of data) {
    if (!raw || typeof raw !== 'object' || !raw.puesto) continue;
    const key = recordKey(raw);
    seen.set(key, {...seen.get(key), ...raw});
  }
  return [...seen.values()];
}
let savedSnapshot = null, storageUnreadable = false;
function save() {
  try {
    // Another tab may have saved newer notes. Never replace its snapshot with stale memory.
    if (storageUnreadable || localStorage.getItem(STORE) !== savedSnapshot) throw Error('Conflicto de almacenamiento');
    const next = JSON.stringify({ records: state.records, favorites: [...state.favorites], notes: state.notes, previousKeys: [...state.previousKeys], lastSuccess: state.lastSuccess });
    localStorage.setItem(STORE, next); savedSnapshot = next; return true;
  } catch (_) { return false; }
}
function loadSaved() {
  try {
    savedSnapshot = localStorage.getItem(STORE);
    const data = JSON.parse(savedSnapshot || '{}');
    if (!data || typeof data !== 'object' || (data.records !== undefined && !Array.isArray(data.records)) ||
        (data.favorites !== undefined && !Array.isArray(data.favorites)) ||
        (data.previousKeys !== undefined && !Array.isArray(data.previousKeys)) ||
        (data.notes !== undefined && (!data.notes || typeof data.notes !== 'object' || Array.isArray(data.notes)))) throw Error('Copia inválida');
    const records = distinct(data.records || []), notes = {...data.notes}, favorites = new Set(data.favorites || []);
    const migrations = new Map();
    for (const r of records) {
      const old = legacyRecordKey(r);
      if (!migrations.has(old)) migrations.set(old, new Set());
      migrations.get(old).add(recordKey(r));
    }
    for (const [old, keys] of migrations) {
      // Ambiguous legacy associations remain archived, accessible in Apuntes de estudio and backups.
      if (keys.size !== 1) continue;
      const key = [...keys][0];
      if (favorites.delete(old)) favorites.add(key);
      if (Object.prototype.hasOwnProperty.call(notes, old) && !Object.prototype.hasOwnProperty.call(notes, key)) {
        notes[key] = notes[old]; delete notes[old];
      }
    }
    state.records = records; state.notes = notes; state.favorites = favorites;
    state.previousKeys = new Set(data.previousKeys || []); state.lastSuccess = data.lastSuccess || null;
  } catch (_) {
    storageUnreadable = true;
    renderStatus('No se pudo leer la copia local. Se conserva intacta; recupera una copia antes de guardar nuevos datos.', 'warning');
  }
}
function calendarDay(value) {
  const s=String(value??'').trim();
  let y,m,d,match;
  if((match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) [,y,m,d]=match;
  else if((match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s))) [,d,m,y]=match;
  else return null;
  y=Number(y);m=Number(m);d=Number(d);
  const date=new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d
    ?Date.UTC(y,m-1,d)/86400000:null;
}
function todayDay(){const now=new Date();return Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())/86400000;}
function statusType(r) {
  // La etiqueta "abierta" exige fechas válidas, además del estado de la fuente.
  if (r._rumboFeedMissing) return 'verificar';
  const explicit=escapeKey(r.inscripcion),s=escapeKey(r.estado);
  if(explicit==='cerrada')return 'cerrada';
  if(explicit==='no convocada')return 'convocatoria_pendiente';
  if(explicit==='pendiente')return 'pendiente';
  if(explicit==='por verificar')return 'verificar';
  const claimsOpen=explicit==='abierta'||(!explicit&&s.includes('presentación de solicitudes'));
  if(claimsOpen){
    const from=calendarDay(r.inicio),until=calendarDay(r.fin);
    if(from===null||until===null||from>until)return 'verificar';
    if(todayDay()<from)return 'pendiente';
    if(todayDay()>until)return 'cerrada';
    return 'abierta';
  }
  if (s.includes('pendiente de convocatoria')) return 'convocatoria_pendiente';
  if (s.includes('pendiente de abrir')) return 'pendiente';
  if (s.includes('inscripción cerrada') || s.includes('inscripcion cerrada')) return 'cerrada';
  if (s.includes('por verificar')) return 'verificar';
  return 'seguimiento';
}
const statusLabel = { abierta: 'Inscripción abierta', cerrada: 'Inscripción cerrada', pendiente: 'Pendiente de plazo', convocatoria_pendiente: 'Pendiente de convocatoria', verificar: 'Por verificar', seguimiento: 'En seguimiento' };
const statusClass = { abierta: 'open', cerrada: 'closed', pendiente: 'pending', convocatoria_pendiente: 'pending', verificar: 'verify', seguimiento: 'follow' };
function disability(r) { const val = Number(r.discapacidad_general); return (Number.isFinite(val) && val > 0) || escapeKey(r.discapacidad) === 'si'; }
function safeUrl(u) { try { const p = new URL(String(u)); return /^https?:$/.test(p.protocol) ? p.href : null; } catch (_) { return null; } }
function renderStatus(message, kind = '') { $('status').textContent = message; $('status').className = 'status ' + kind; }
function formatTime(t) { if (!t) return 'sin sincronizaciones anteriores'; const d = new Date(t); return Number.isNaN(d.valueOf()) ? 'fecha desconocida' : d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }); }
function updateStats() { $('count-total').textContent = state.records.length; $('count-open').textContent = state.records.filter(r => statusType(r) === 'abierta').length; $('count-disability').textContent = state.records.filter(disability).length; $('count-favs').textContent = state.favorites.size; }
function updateSourceOptions() { const sel = $('source'); const existing = sel.value; sel.replaceChildren(new Option('Todos', '')); [...new Set(state.records.map(x => x.organismo).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')).forEach(x=>sel.add(new Option(x,x))); sel.value=existing; }
function filtered() {
  const q=escapeKey($('search').value), source=$('source').value, status=$('status-filter').value, priority=$('priority-filter').value;
  return state.records.filter(r => {
    if (source && r.organismo !== source) return false;
    if (status && statusType(r) !== status) return false;
    if (priority && r.prioridad !== priority) return false;
    if ($('disability-filter').value && !disability(r)) return false;
    if ($('only-favs').checked && !state.favorites.has(recordKey(r))) return false;
    if (q && ![r.puesto,r.organismo,r.ubicacion,r.estado,r.tipo,r.grupo].map(escapeKey).join(' ').includes(q)) return false;
    return true;
  }).sort((a,b) => {
    const score=x=>({abierta:0,pendiente:1,convocatoria_pendiente:2,seguimiento:3,verificar:4,cerrada:5}[statusType(x)] ?? 6);
    return score(a)-score(b) || (a.prioridad==='Alta'?-1:1)-(b.prioridad==='Alta'?-1:1) || String(a.puesto).localeCompare(String(b.puesto),'es');
  });
}
function badge(label, css) { return node('span','badge '+css,label); }
function cell(tr, content) { const td=node('td'); if (typeof content==='string' || typeof content==='number') td.textContent=String(content); else if (content) td.append(content); tr.append(td); return td; }
// Seguimiento personal: muestra primero el próximo plazo verificable, sin inventar avisos.
function followupRank(r){
  const kind=statusType(r),end=calendarDay(r.fin),remaining=end===null?null:end-todayDay();
  if(kind==='abierta'&&remaining!==null&&remaining>=0&&remaining<=7)return 0;
  if(kind==='abierta')return 1;
  if(kind==='pendiente')return 2;
  if(kind==='convocatoria_pendiente')return 3;
  if(kind==='verificar')return 4;
  if(kind==='seguimiento')return 5;
  return 6;
}
function followupText(r){
  const kind=statusType(r),end=calendarDay(r.fin),remaining=end===null?null:end-todayDay();
  if(kind==='abierta'&&remaining!==null){
    if(remaining===0)return 'El plazo indicado termina hoy. Comprueba las bases.';
    if(remaining===1)return 'El plazo indicado termina mañana. Comprueba las bases.';
    if(remaining>1&&remaining<=7)return 'Fin del plazo indicado en '+remaining+' días. Comprueba las bases.';
    return 'Inscripción abierta según las fechas publicadas.';
  }
  if(kind==='convocatoria_pendiente')return 'Plazas ofertadas; falta la convocatoria individual.';
  if(kind==='pendiente')return 'Convocada, pendiente de abrir el plazo.';
  if(kind==='verificar')return 'Situación o plazo por verificar en la fuente oficial.';
  return statusLabel[kind]||'En seguimiento';
}
function renderFollowup(){
  const root=$('my-followup'),list=$('my-followup-list'),caption=$('my-followup-caption'),all=$('my-followup-all');
  if(!root||!list||!caption||!all)return;
  const favorites=state.records.filter(r=>state.favorites.has(recordKey(r))).sort((a,b)=>
    followupRank(a)-followupRank(b)||String(a.puesto).localeCompare(String(b.puesto),'es'));
  const urgent=favorites.filter(r=>followupRank(r)===0).length;
  caption.textContent=favorites.length
    ?favorites.length+' guardada'+(favorites.length===1?'':'s')+
      (urgent?' · '+urgent+' con plazo indicado de 7 días o menos':' · revisa su estado y fuente oficial')
    :'Marca ☆ en cualquier convocatoria para seguirla desde aquí.';
  list.replaceChildren();
  for(const r of favorites.slice(0,3)){
    const article=node('article','my-followup-item');
    const body=node('div','my-followup-item-body');
    body.append(node('strong','',r.puesto));
    body.append(node('small','',r.organismo||'Organismo por verificar'));
    const text=node('p','',followupText(r));
    if(followupRank(r)===0)text.classList.add('my-followup-urgent');
    body.append(text);
    const actions=node('div','my-followup-actions');
    const detail=node('button','button secondary','Ver ficha');
    detail.type='button';detail.addEventListener('click',()=>openDetail(r));actions.append(detail);
    const official=safeUrl(r.fuente_detalle)||safeUrl(r.fuente);
    if(official){
      const a=node('a','my-followup-official','Fuente oficial');
      a.href=official;a.target='_blank';a.rel='noopener noreferrer';actions.append(a);
    }
    article.append(body,actions);list.append(article);
  }
  all.hidden=!favorites.length;
  all.textContent=favorites.length>3?'Ver las '+favorites.length+' guardadas':'Ver mis guardadas en la tabla';
}
function showAllFollowed(){
  $('source').value='';$('status-filter').value='';$('disability-filter').value='';
  $('priority-filter').value='';$('search').value='';$('only-favs').checked=true;
  render();
  $('result-label').scrollIntoView({block:'center',behavior:'auto'});
}
function render() {
  // Las actualizaciones del feed también reconstruyen las filas. Si el usuario
  // tiene enfocado un favorito, no debe perder el teclado ni saltar al inicio.
  const oldFocus=document.activeElement;
  const focusedFavorite=oldFocus?.matches?.('button[aria-label="Alternar favorito"]')
    ?oldFocus.closest('tr[data-record-key]')?.dataset.recordKey:null;
  updateStats(); updateSourceOptions();
  renderFollowup();
  window.dispatchEvent(new Event('rumbo:study-updated'));
  const data=filtered(); $('result-label').textContent = `${data.length} convocatoria${data.length===1?'':'s'} encontrada${data.length===1?'':'s'}`; $('rows').replaceChildren(); $('empty').classList.toggle('hidden', Boolean(data.length));
  const fragment=document.createDocumentFragment();
  data.forEach(r=>{
    const key=recordKey(r), tr=node('tr');
    const name=node('div'); name.append(node('strong','',r.puesto)); if(state.newKeys.has(key)) name.append(node('span','new','NUEVA'));
    name.append(node('small','',`${r.grupo || 'Grupo por verificar'} · ${r.ubicacion || 'Ubicación por verificar'}`));
    cell(tr,name); cell(tr,r.organismo || 'Por verificar'); cell(tr,Number.isFinite(Number(r.plazas)) ? r.plazas : '—');
    const dis = Number(r.discapacidad_general);
    cell(tr,disability(r) ? (Number.isFinite(dis) && dis>0 ? `${dis} general` : 'Reserva indicada') : 'No indicada');
    cell(tr,badge(statusLabel[statusType(r)],statusClass[statusType(r)]));
    cell(tr,badge(r.prioridad || 'Por verificar', r.prioridad==='Alta'?'high':r.prioridad==='Media'?'medium':'low'));
    cell(tr,r._rumboFeedMissing ? 'Por verificar (fecha histórica: '+(r.fin || 'no consta')+')' : (r.fin ? String(r.fin) : 'Por verificar'));
    tr.dataset.recordKey=key;
    const acts=node('div','row-actions'), star=node('button','icon-button'+(state.favorites.has(key)?' faved':''),state.favorites.has(key)?'★':'☆');
    star.type='button';star.setAttribute('aria-label','Alternar favorito');
    star.setAttribute('aria-pressed',String(state.favorites.has(key)));
    star.title=state.favorites.has(key)?'Quitar de favoritas':'Añadir a favoritas';
    star.addEventListener('click',event=>{
      const keyboard=event.detail===0,index=[...$('rows').children].indexOf(tr),was=state.favorites.has(key);
      was?state.favorites.delete(key):state.favorites.add(key);
      if(!save()){was?state.favorites.add(key):state.favorites.delete(key);renderStatus('No se pudo guardar el favorito. Puede haber cambios en otra pestaña; conserva una copia y recarga.','warning');}
      else window.dispatchEvent(new CustomEvent('rumbo:favorites-updated',{detail:{key,selected:!was}}));
      render();
      if(keyboard){
        const rows=[...$('rows').children],same=rows.find(row=>row.dataset.recordKey===key);
        const target=(same||rows[Math.min(index,rows.length-1)])?.querySelector('button[aria-label="Alternar favorito"]');
        if(target)target.focus();else{$('result-label').tabIndex=-1;$('result-label').focus();}
      }
    });
    const detail=node('button','button secondary','Detalle'); detail.type='button'; detail.addEventListener('click',()=>openDetail(r)); acts.append(star,detail); const last=cell(tr,acts); last.className='right';
    const labels=['Puesto / grupo','Organismo','Plazas','Discapacidad','Situación','Prioridad','Fin del plazo','Acciones'];
    Array.from(tr.children).forEach((td,i)=>td.dataset.label=labels[i]);
    fragment.append(tr);
  }); $('rows').append(fragment);
  if(focusedFavorite){
    const row=[...$('rows').children].find(tr=>tr.dataset.recordKey===focusedFavorite);
    row?.querySelector('button[aria-label="Alternar favorito"]')?.focus({preventScroll:true});
  }
  if (window.RumboHome) window.RumboHome.render({records: state.records, favorites: state.favorites, newKeys: state.newKeys, recordKey, statusType, openDetail, goFavorites: () => { $('only-favs').checked=true; render(); if(!window.RumboNavigation?.go('favoritos'))location.hash='favoritos'; }});
}
function historicalDate(r,value) { return r._rumboFeedMissing ? 'Histórico, por verificar: '+(value || 'no consta') : (value || 'No verificado'); }
function openDetail(r) {
  const key=recordKey(r); $('dialog-title').textContent=r.puesto || 'Convocatoria'; const container=$('dialog-content'); container.replaceChildren(); const grid=node('div','detail-grid');
  const fields=[['Organismo',r.organismo],['Grupo',r.grupo],['Ubicación',r.ubicacion],['Plazas acceso libre',r.plazas],...(r.plazas_totales!=null?[['Plazas totales (incluye promoción interna)',r.plazas_totales]]:[]),['Estado',r._rumboFeedMissing ? 'Por verificar · ausente de la fuente actual' : (r.estado || statusLabel[statusType(r)])],['Prioridad',r.prioridad],['Discapacidad general',r.discapacidad_general ?? (disability(r)?'Reserva indicada; sin número':'No indicada')],['Discapacidad intelectual',r.discapacidad_intelectual ?? 'No informada'],['Inicio del plazo',historicalDate(r,r.inicio)],['Fin del plazo',historicalDate(r,r.fin)],...(r.verificado_el?[['Fuente revisada',r.verificado_el]]:[])];
  fields.forEach(([label,value])=>{ const e=node('div','detail');e.append(node('span','',label),node('strong','',value ?? 'Por verificar'));grid.append(e); });container.append(grid);
  if(r.detalle_estado)container.append(node('p','xunta-detail-note',r.detalle_estado));
  if(safeUrl(r.fuente_seguimiento)){const a=node('a','xunta-follow-link','Consultar novedades oficiales de la Xunta ↗');a.href=safeUrl(r.fuente_seguimiento);a.target='_blank';a.rel='noopener noreferrer';container.append(a);}
  const label=node('label','detail');label.style.display='block';label.style.marginTop='23px';label.textContent='Notas personales (solo en este navegador)'; const note=node('textarea');note.value=state.notes[key]||''; note.rows=3; note.style.cssText='width:100%;margin-top:8px;padding:12px;border:1px solid #d7e2ed;border-radius:8px;resize:vertical';note.addEventListener('input',()=>{state.notes[key]=note.value;if(!save())renderStatus('No se pudo guardar la nota. Copia el texto antes de recargar; puede haber cambios en otra pestaña.','warning');});label.append(note);container.append(label);
  const direct=safeUrl(r.fuente_detalle),generic=safeUrl(r.fuente);
  const official=$('official-link');
  official.href=direct||generic||'#';
  official.hidden=!(direct||generic);
  official.textContent=direct?'Abrir la ficha oficial de esta plaza ↗':'Consultar fuente oficial (no hay enlace individual verificado) ↗';
  $('detail-dialog').showModal();
}
async function loadRemote() {
  if(storageUnreadable)return;
  $('refresh').disabled=true; renderStatus('Comprobando las publicaciones del repositorio público…');
  try {
    const response=await fetch(FEED_URL + '?v=' + Date.now(),{cache:'no-store'});
    if(!response.ok) throw Error(`HTTP ${response.status}`);
    const payload=await response.json(); const incoming=Array.isArray(payload)?payload:payload.oposiciones;
    if(!Array.isArray(incoming)||!incoming.length) throw Error('El archivo no contiene una lista válida de convocatorias');
    const cleaned=distinct(incoming);
    if(!cleaned.length) throw Error('No se encontraron registros válidos');
    const oldKeys=new Set(state.records.map(recordKey));
    const currentKeys=new Set(cleaned.map(recordKey));
    state.newKeys=new Set(state.records.length?cleaned.map(recordKey).filter(k=>!oldKeys.has(k)):[]);
    // La fuente pública puede contener menos registros que una copia/importación anterior.
    // Conservar los anteriores y actualizar los coincidentes; nunca borrarlos al refrescar.
    state.records=distinct([...state.records,...cleaned]).map(r=>({
      ...r,_rumboFeedMissing:!currentKeys.has(recordKey(r))
    }));
    state.previousKeys=new Set(state.records.map(recordKey));
    state.lastSuccess=new Date().toISOString();
    const persisted=save();render();
    const historical=state.records.length-cleaned.length;
    const warning=historical>0?` · ${historical} conservadas de tu historial (plazos por verificar)`:'';
    renderStatus(`Fuente: ${cleaned.length} · Total conservado: ${state.records.length}${warning} · ${formatTime(state.lastSuccess)}${persisted?'':' · Atención: no se pudo guardar en este navegador; conserva una copia y revisa si hay otra pestaña abierta'}`,persisted?'good':'warning');
  } catch(err) {
    renderStatus('No se pudo consultar GitHub ('+err.message+'). Se muestran los últimos datos guardados en este navegador.','warning');render();
  } finally { $('refresh').disabled=false; }
}
function importJson(file) {
  if(!file)return; const reader=new FileReader();reader.onload=()=>{
    try{const parsed=JSON.parse(reader.result);const list=Array.isArray(parsed)?parsed:parsed.oposiciones;if(!Array.isArray(list))throw Error('Se esperaba una lista JSON o un objeto con "oposiciones"');
      const old=new Set(state.records.map(recordKey)), clean=distinct([...state.records,...list]);state.newKeys=new Set(clean.map(recordKey).filter(k=>!old.has(k)));state.records=clean;const persisted=save();render();renderStatus(persisted?`Importación completada: ${state.newKeys.size} nuevas, ${clean.length} en total.`:'Importación sin guardar. Conserva el archivo original y revisa el almacenamiento u otras pestañas. ',persisted?'good':'warning');
    }catch(e){renderStatus('No se pudo importar: '+e.message,'warning');}
  };reader.readAsText(file,'utf-8');
}
function exportJson(){const blob=new Blob([JSON.stringify(state.records,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=node('a');a.href=url;a.download='convocatorias_rumbo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function applyHash(){const target=window.RumboNavigation?.resolve(location.hash.slice(1))||location.hash.slice(1);document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===target ||(!target && a.dataset.nav==='inicio')));if(target==='favoritos'){$('only-favs').checked=true;render();if(!window.RumboNavigation)document.getElementById('convocatorias').scrollIntoView();}else if(target==='convocatorias'){$('only-favs').checked=false;render();}}
function setup(){
  $('today').textContent=new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  // Favoritos actualizados en otra pestaña del mismo dispositivo: no mantener una copia antigua en memoria.
  window.addEventListener('storage',event=>{
    if(event.key!==STORE||storageUnreadable)return;
    loadSaved();render();
  });
  loadSaved();render();if(state.records.length)renderStatus(`Copia local: ${state.records.length} convocatorias. Última sincronización: ${formatTime(state.lastSuccess)}`);
  ['search','source','status-filter','disability-filter','priority-filter','only-favs'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',render));
  const xuntaView=kind=>{
    $('source').value='Xunta de Galicia';
    $('status-filter').value=kind==='guardadas'?'':kind;
    $('only-favs').checked=kind==='guardadas';
    $('search').value='';
    render();
    document.getElementById('convocatorias').scrollIntoView({block:'start'});
  };
  [['xunta-all',''],['xunta-no-convocada','convocatoria_pendiente'],['xunta-no-plazo','pendiente'],['xunta-abiertas','abierta'],['xunta-guardadas','guardadas']].forEach(([id,kind])=>$(id)?.addEventListener('click',()=>xuntaView(kind)));
  $('my-followup-all')?.addEventListener('click',showAllFollowed);
  $('refresh').addEventListener('click',loadRemote);$('import-file').addEventListener('change',event=>{importJson(event.target.files?.[0]);event.target.value='';});$('export').addEventListener('click',exportJson);
  $('clear').addEventListener('click',()=>{$('search').value='';$('source').value='';$('status-filter').value='';$('disability-filter').value='';$('priority-filter').value='';$('only-favs').checked=false;render();});
  $('dialog-close').addEventListener('click',()=>$('detail-dialog').close());$('dialog-done').addEventListener('click',()=>$('detail-dialog').close());
  window.addEventListener('hashchange',applyHash);applyHash();loadRemote();setInterval(loadRemote,30*60*1000);
}
// Interfaz restringida para que la sincronización cifrada no altere notas ni convocatorias.
window.RumboFavoritesLink=Object.freeze({
  get:()=>[...state.favorites],
  apply(keys){
    if(!Array.isArray(keys)||keys.length>2500||keys.some(k=>typeof k!=='string'||k.length>1400))return false;
    const previous=state.favorites;
    state.favorites=new Set(keys);
    if(!save()){state.favorites=previous;renderStatus('Otra pestaña cambió el almacenamiento. Sincronización no aplicada; vuelve a intentarlo.','warning');return false;}
    render();return true;
  }
});
window.RumboStudyStore = {
 snapshot: () => ({records:state.records.map(r=>({key:recordKey(r),title:r.puesto,organismo:r.organismo})),notes:{...state.notes}}),
 write: (key,text) => {
  if(typeof key!=='string'||!key||typeof text!=='string'||text.length>20000)return false;
  const existed=Object.prototype.hasOwnProperty.call(state.notes,key),old=state.notes[key];
  state.notes[key]=text;
  if(!save()){if(existed)state.notes[key]=old;else delete state.notes[key];return false;}
  window.dispatchEvent(new Event('rumbo:study-updated'));return true;
 }
};
window.addEventListener('DOMContentLoaded',setup);

