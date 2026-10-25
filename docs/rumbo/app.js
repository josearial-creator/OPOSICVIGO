'use strict';

// Código independiente. Los datos oficiales se obtienen del repositorio público indicado.
const FEED_URL = 'https://raw.githubusercontent.com/josearial-creator/OPOSICVIGO/main/docs/importar_rumbo.json';
const STORE = 'rumbo-replica-v1';
const $ = id => document.getElementById(id);
const state = { records: [], favorites: new Set(), previousKeys: new Set(), newKeys: new Set(), notes: {}, lastSuccess: null };
const node = (name, cls, value) => { const e = document.createElement(name); if (cls) e.className = cls; if (value !== undefined && value !== null) e.textContent = String(value); return e; };

function escapeKey(s) { return String(s ?? '').trim().toLocaleLowerCase('es').replace(/\s+/g, ' '); }
function recordKey(r) {
  // Vigo usa una URL general para todas las fichas: no podemos usar solo 'fuente'.
  const fields = [r.organismo, r.puesto, r.grupo, r.tipo, r.plazas, r.discapacidad];
  if (r.organismo === 'SERGAS' && r.fuente?.includes('IdCategoria=')) return 'sergas:' + r.fuente.split('IdCategoria=')[1].split('&')[0];
  return fields.map(escapeKey).join('¦');
}
function distinct(data) { const seen = new Map(); for (const raw of data) { if (!raw || typeof raw !== 'object' || !raw.puesto) continue; const r = {...raw}; seen.set(recordKey(r), r); } return [...seen.values()]; }
function save() { try { localStorage.setItem(STORE, JSON.stringify({ records: state.records, favorites: [...state.favorites], notes: state.notes, previousKeys: [...state.previousKeys], lastSuccess: state.lastSuccess })); } catch (_) { /* Private browsing may disable storage */ } }
function loadSaved() { try { const data = JSON.parse(localStorage.getItem(STORE) || '{}'); state.records = distinct(data.records || []); state.favorites = new Set(data.favorites || []); state.previousKeys = new Set(data.previousKeys || []); state.lastSuccess = data.lastSuccess || null; state.notes = data.notes || {}; } catch (_) { /* Ignore invalid caches */ } }
function statusType(r) {
  const explicit = escapeKey(r.inscripcion);
  if (explicit === 'abierta') return 'abierta';
  if (explicit === 'cerrada') return 'cerrada';
  if (explicit === 'pendiente') return 'pendiente';
  if (explicit === 'por verificar') return 'verificar';
  const s = escapeKey(r.estado);
  if (s.includes('presentación de solicitudes')) return 'abierta';
  if (s.includes('pendiente de abrir')) return 'pendiente';
  if (s.includes('inscripción cerrada') || s.includes('inscripcion cerrada')) return 'cerrada';
  if (s.includes('por verificar')) return 'verificar';
  return 'seguimiento';
}
const statusLabel = { abierta: 'Inscripción abierta', cerrada: 'Inscripción cerrada', pendiente: 'Pendiente de abrir', verificar: 'Por verificar', seguimiento: 'En seguimiento' };
const statusClass = { abierta: 'open', cerrada: 'closed', pendiente: 'pending', verificar: 'verify', seguimiento: 'follow' };
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
    const score=x=>({abierta:0,pendiente:1,seguimiento:2,verificar:3,cerrada:4}[statusType(x)] ?? 5);
    return score(a)-score(b) || (a.prioridad==='Alta'?-1:1)-(b.prioridad==='Alta'?-1:1) || String(a.puesto).localeCompare(String(b.puesto),'es');
  });
}
function badge(label, css) { return node('span','badge '+css,label); }
function cell(tr, content) { const td=node('td'); if (typeof content==='string' || typeof content==='number') td.textContent=String(content); else if (content) td.append(content); tr.append(td); return td; }
function render() {
  updateStats(); updateSourceOptions();
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
    const acts=node('div','row-actions'), star=node('button','icon-button'+(state.favorites.has(key)?' faved':''),state.favorites.has(key)?'★':'☆'); star.type='button'; star.setAttribute('aria-label','Alternar favorito'); star.addEventListener('click',()=>{ state.favorites.has(key)?state.favorites.delete(key):state.favorites.add(key);save();render(); });
    const detail=node('button','button secondary','Detalle'); detail.type='button'; detail.addEventListener('click',()=>openDetail(r)); acts.append(star,detail); const last=cell(tr,acts); last.className='right'; fragment.append(tr);
  }); $('rows').append(fragment);
  if (window.RumboHome) window.RumboHome.render({records: state.records, favorites: state.favorites, newKeys: state.newKeys, recordKey, statusType, openDetail, goFavorites: () => { $('only-favs').checked=true; render(); $('convocatorias').scrollIntoView({behavior:'smooth'}); }});
}
function openDetail(r) {
  const key=recordKey(r); $('dialog-title').textContent=r.puesto || 'Convocatoria'; const container=$('dialog-content'); container.replaceChildren(); const grid=node('div','detail-grid');
  const fields=[['Organismo',r.organismo],['Grupo',r.grupo],['Ubicación',r.ubicacion],['Plazas turno libre',r.plazas],['Estado',r.estado || statusLabel[statusType(r)]],['Prioridad',r.prioridad],['Discapacidad general',r.discapacidad_general ?? (disability(r)?'Reserva indicada; sin número':'No indicada')],['Discapacidad intelectual',r.discapacidad_intelectual ?? 'No informada'],['Inicio del plazo',r.inicio || 'No verificado'],['Fin del plazo',r.fin || 'No verificado']];
  fields.forEach(([label,value])=>{ const e=node('div','detail');e.append(node('span','',label),node('strong','',value ?? 'Por verificar'));grid.append(e); });container.append(grid);
  const label=node('label','detail');label.style.display='block';label.style.marginTop='23px';label.textContent='Notas personales (solo en este navegador)'; const note=node('textarea');note.value=state.notes[key]||''; note.rows=3; note.style.cssText='width:100%;margin-top:8px;padding:12px;border:1px solid #d7e2ed;border-radius:8px;resize:vertical';note.addEventListener('input',()=>{state.notes[key]=note.value;save();});label.append(note);container.append(label);
  const link=safeUrl(r.fuente); $('official-link').href=link || '#';$('official-link').hidden=!link;
  $('detail-dialog').showModal();
}
async function loadRemote() {
  $('refresh').disabled=true; renderStatus('Comprobando las publicaciones del repositorio público…');
  try {
    const response=await fetch(FEED_URL + '?v=' + Date.now(),{cache:'no-store'});
    if(!response.ok) throw Error(`HTTP ${response.status}`);
    const payload=await response.json(); const incoming=Array.isArray(payload)?payload:payload.oposiciones;
    if(!Array.isArray(incoming)||!incoming.length) throw Error('El archivo no contiene una lista válida de convocatorias');
    const cleaned=distinct(incoming);
    if(!cleaned.length) throw Error('No se encontraron registros válidos');
    const oldKeys=new Set(state.records.map(recordKey));
    state.newKeys= new Set(state.records.length?cleaned.map(recordKey).filter(k=>!oldKeys.has(k)):[]);
    state.records=cleaned;state.previousKeys=new Set(cleaned.map(recordKey));state.lastSuccess=new Date().toISOString();save();render();
    renderStatus(`Sincronizado: ${cleaned.length} convocatorias · ${formatTime(state.lastSuccess)}${state.newKeys.size?' · '+state.newKeys.size+' nuevas':''}`,'good');
  } catch(err) {
    renderStatus('No se pudo consultar GitHub ('+err.message+'). Se muestran los últimos datos guardados en este navegador.','warning');render();
  } finally { $('refresh').disabled=false; }
}
function importJson(file) {
  if(!file)return; const reader=new FileReader();reader.onload=()=>{
    try{const parsed=JSON.parse(reader.result);const list=Array.isArray(parsed)?parsed:parsed.oposiciones;if(!Array.isArray(list))throw Error('Se esperaba una lista JSON o un objeto con "oposiciones"');
      const old=new Set(state.records.map(recordKey)), clean=distinct([...state.records,...list]);state.newKeys=new Set(clean.map(recordKey).filter(k=>!old.has(k)));state.records=clean;save();render();renderStatus(`Importación completada: ${state.newKeys.size} nuevas, ${clean.length} en total.`,'good');
    }catch(e){renderStatus('No se pudo importar: '+e.message,'warning');}
  };reader.readAsText(file,'utf-8');
}
function exportJson(){const blob=new Blob([JSON.stringify(state.records,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=node('a');a.href=url;a.download='convocatorias_rumbo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function applyHash(){const target=location.hash.slice(1);document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===target ||(!target && a.dataset.nav==='inicio')));if(target==='favoritos'){$('only-favs').checked=true;render();document.getElementById('convocatorias').scrollIntoView();}else if(target==='convocatorias'){$('only-favs').checked=false;render();}}
function setup(){
  $('today').textContent=new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  loadSaved();render();if(state.records.length)renderStatus(`Copia local: ${state.records.length} convocatorias. Última sincronización: ${formatTime(state.lastSuccess)}`);
  ['search','source','status-filter','disability-filter','priority-filter','only-favs'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',render));
  $('refresh').addEventListener('click',loadRemote);$('import-file').addEventListener('change',event=>{importJson(event.target.files?.[0]);event.target.value='';});$('export').addEventListener('click',exportJson);
  $('clear').addEventListener('click',()=>{$('search').value='';$('source').value='';$('status-filter').value='';$('disability-filter').value='';$('priority-filter').value='';$('only-favs').checked=false;render();});
  $('dialog-close').addEventListener('click',()=>$('detail-dialog').close());$('dialog-done').addEventListener('click',()=>$('detail-dialog').close());
  window.addEventListener('hashchange',applyHash);applyHash();loadRemote();setInterval(loadRemote,30*60*1000);
}
window.addEventListener('DOMContentLoaded',setup);
