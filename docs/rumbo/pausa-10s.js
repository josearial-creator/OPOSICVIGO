/* Pausa 10 s: registro independiente. No modifica el diario ni el historial previo. */
(() => {
'use strict';
const KEY='rumbo-pausa-10s-v1';
const START='2026-11-16', BASE_END='2026-11-20', END='2026-12-11';
const ROOT=document.getElementById('mi-evolucion');
if (!ROOT) return;
let blocked=false, saveError=false;
let data={version:1,sessions:[],draft:null};
try {
  const saved=localStorage.getItem(KEY);
  if(saved) {
    const parsed=JSON.parse(saved);
    if(parsed.version!==1 || !Array.isArray(parsed.sessions) ||
       !parsed.sessions.every(s=>typeof s.day==='string' && Number.isFinite(s.interruptions) && s.interruptions>=0 && Number.isFinite(s.pauses) && s.pauses>=0 && typeof s.completed==='boolean') ||
       (parsed.draft && (typeof parsed.draft.day!=='string' || !Number.isFinite(parsed.draft.started) || !Number.isFinite(parsed.draft.interruptions) || !Number.isFinite(parsed.draft.pauses)))) throw Error('Formato desconocido');
    data=parsed;
  }
} catch (_) { blocked=true; }
let host=null;
function save() {
  if(blocked)return false;
  try {localStorage.setItem(KEY,JSON.stringify(data));saveError=false;return true;}
  catch (_) {saveError=true;return false;}
}
function localDay(d) {
  d=d||new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function phase(day) {
  if(day<START)return 'antes';
  if(day>END)return 'despues';
  const wd=new Date(day+'T12:00:00').getDay();
  if(wd===0||wd===6)return 'descanso';
  return day<=BASE_END?'observacion':'practica';
}
function seconds(d) {return Math.max(0,Math.min(1500,Math.floor((Date.now()-d.started)/1000)));}
function clock(s) {return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function week(day) {
  const d=new Date(day+'T12:00:00');
  d.setDate(d.getDate() - (d.getDay()+6)%7);
  return localDay(d);
}
function avg(xs) {return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;}
function summary() {
  const valid=data.sessions.filter(s=>s.completed);
  const base=valid.filter(s=>s.phase==='observacion');
  const weeks=new Map();
  valid.filter(s=>s.phase==='practica').forEach(s=>{const w=week(s.day);if(!weeks.has(w))weeks.set(w,[]);weeks.get(w).push(s.interruptions);});
  const groups=[...weeks.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  const meanBase=avg(base.map(s=>s.interruptions));
  const last=groups.at(-1),meanRecent=last?avg(last[1]):null;
  const pct=meanBase!==null&&meanBase>0&&meanRecent!==null?(100*(meanBase-meanRecent)/meanBase):null;
  return {base,meanBase,groups,last,meanRecent,pct,valid};
}
function render() {
  if(!host || !host.isConnected)return;
  const today=localDay(),p=phase(today),s=summary(),d=data.draft;
  const status=blocked?'El registro anterior no se puede interpretar. No se sobrescribirá; exporta la copia para recuperarla.':
    saveError?'No se pudo guardar en este navegador. Exporta una copia.':
    'Se guarda solo en este navegador. No se sincroniza con otros dispositivos.';
  let content='<div class="pausa-header"><div><strong>Plan: detenerme 10 segundos</strong><p>Una sesión de estudio de 25 minutos, de lunes a viernes. Un cambio imprevisto es abandonar la tarea por otra que no habías planificado.</p></div></div>';
  if(blocked) {
    content+='<p role="alert" class="pausa-error">'+status+'</p><button class="button secondary" data-action="export">Exportar copia original</button>';
    host.innerHTML=content;return;
  }
  const phaseName={antes:'Comienza el lunes 16 de noviembre',observacion:'Semana 1: observar, sin entrenar la pausa',practica:'Semanas 2–4: practicar la pausa de 10 segundos',descanso:'Fin de semana: sin sesión programada',despues:'Experimento finalizado el 11 de diciembre'};
  content+='<p class="pausa-phase">'+phaseName[p]+'</p>';
  if(d) {
    const t=seconds(d),available=t<1500,waiting=d.pauseStarted&&Date.now()-d.pauseStarted<10000;
    content+='<div class="pausa-clock">Tiempo de estudio: <strong data-clock>'+clock(t)+'</strong> / 25:00</div>';
    content+='<div class="pausa-counts"><span>Cambios no previstos: <strong>'+d.interruptions+'</strong></span><span>Pausas iniciadas: <strong>'+d.pauses+'</strong></span></div>';
    content+='<div class="pausa-actions"><button class="button secondary" data-action="interrupt" '+(!available?'disabled':'')+'>+ Cambio no previsto</button><button class="button secondary" data-action="undo" '+(!available||!d.interruptions?'disabled':'')+'>Corregir −1</button>';
    if(d.phase==='practica') content+='<button class="button primary" data-action="pause" '+(!available||waiting?'disabled':'')+'>Detenerme 10 segundos</button><span data-pause aria-live="polite">'+(waiting?'Pausa: '+Math.ceil((10000-(Date.now()-d.pauseStarted))/1000)+' s restantes':'')+'</span>';
    content+='</div><button class="button primary pausa-finish" data-action="finish">Terminar y guardar sesión</button>';
    content+='<p class="pausa-note">'+(available?'Si terminas antes de 25 minutos, se guardará como sesión parcial y no contará para el porcentaje.':'Los 25 minutos han terminado; guarda la sesión para incluirla en el seguimiento.')+'</p>';
  } else {
    const already=data.sessions.some(x=>x.day===today && x.completed);
    if((p==='observacion'||p==='practica')&&!already)content+='<button class="button primary" data-action="start">Empezar estudio de 25 minutos</button>';
    else if(already)content+='<p class="pausa-note">Sesión de hoy registrada. Mañana podrás continuar.</p>';
    else content+='<p class="pausa-note">El registro de sesiones se habilita los días laborables del experimento.</p>';
  }
  content+='<div class="pausa-progress"><h4>Evolución del experimento</h4><p>Semana inicial: <strong>'+(s.meanBase===null?'Pendiente':s.meanBase.toFixed(2)+' cambios por sesión')+'</strong> ('+s.base.length+' sesiones válidas).</p>';
  content+='<p>Última semana de práctica: <strong>'+(s.meanRecent===null?'Pendiente':s.meanRecent.toFixed(2)+' cambios por sesión')+'</strong>'+(s.last?' ('+s.last[1].length+' sesiones, semana del '+s.last[0]+')':'')+'.</p>';
  content+='<p>Reducción respecto a la semana inicial: <strong>'+(s.pct===null?'No calculable todavía':(s.pct>=0?'+':'')+s.pct.toFixed(1)+' %')+'</strong>'+(s.last&&s.last[1].length<5?' · Resultado provisional':'')+'.</p>';
  if(s.meanBase===0)content+='<p class="pausa-note">Con cero cambios en la semana inicial no se puede calcular una reducción porcentual.</p>';
  content+='<p class="pausa-note">Se compara el número de cambios no previstos en sesiones completas de 25 minutos. Un registro parcial no se interpreta como cero cambios.</p></div>';
  content+='<div class="pausa-actions"><button class="button secondary" data-action="export">Exportar registros (JSON)</button></div>';
  content+='<p class="pausa-note" role="status">'+status+'</p>';
  host.innerHTML=content;
}
function download() {
  const raw=blocked?localStorage.getItem(KEY):JSON.stringify(data,null,2);
  const url=URL.createObjectURL(new Blob([raw||''],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='rumbo-pausa-10s.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function click(e) {
  const btn=e.target.closest('button[data-action]');
  if(!btn||!host.contains(btn))return;
  const action=btn.dataset.action, today=localDay();
  if(action==='export'){download();return;}
  if(blocked)return;
  if(action==='start') {
    const p=phase(today);
    if(data.draft||!['observacion','practica'].includes(p)||data.sessions.some(s=>s.day===today&&s.completed))return;
    data.draft={day:today,phase:p,started:Date.now(),interruptions:0,pauses:0,pauseStarted:0};
  } else {
    const d=data.draft;
    if(!d)return;
    if(action==='interrupt'&&seconds(d)<1500)d.interruptions+=1;
    if(action==='undo'&&seconds(d)<1500)d.interruptions=Math.max(0,d.interruptions-1);
    if(action==='pause'&&d.phase==='practica'&&seconds(d)<1500&&Date.now()-d.pauseStarted>=10000){d.pauses+=1;d.pauseStarted=Date.now();}
    if(action==='finish'){
      const elapsed=seconds(d);
      data.sessions.push({id:'p10-'+d.day+'-'+d.started,day:d.day,phase:d.phase,interruptions:d.interruptions,pauses:d.pauses,seconds:elapsed,completed:elapsed>=1500});
      data.draft=null;
    }
  }
  save();render();
}
function attach() {
  const section=document.getElementById('ev-training');
  if(!section)return;
  if(document.getElementById('rumbo-pausa-10'))return;
  host=document.createElement('div');host.id='rumbo-pausa-10';host.className='pausa-plan';
  section.insertBefore(host,section.firstChild);
  host.addEventListener('click',click);
  render();
}
new MutationObserver(attach).observe(ROOT,{childList:true,subtree:true});
attach();
setInterval(()=>{
  if(!host||!host.isConnected||!data.draft)return;
  const t=host.querySelector('[data-clock]');
  if(t)t.textContent=clock(seconds(data.draft));
  const pause=host.querySelector('[data-pause]');
  if(pause&&data.draft.pauseStarted){
    const remain=Math.max(0,Math.ceil((10000-(Date.now()-data.draft.pauseStarted))/1000));
    pause.textContent=remain?'Pausa: '+remain+' s restantes':'Ya puedes decidir si seguir con tu tarea';
    const btn=host.querySelector('[data-action="pause"]');
    if(btn)btn.disabled=remain>0||seconds(data.draft)>=1500;
  }
  if(seconds(data.draft)>=1500){
    for(const b of host.querySelectorAll('[data-action="interrupt"],[data-action="undo"],[data-action="pause"]'))b.disabled=true;
  }
},1000);
})();