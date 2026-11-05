(() => {
'use strict';
// Panel de solo lectura: nunca altera los almacenes originales de Rumbo.
const root=document.getElementById('panel-personal');
if(!root)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const day=d=>{const x=new Date(d);return Number.isFinite(x.getTime())?x.toLocaleDateString('es-ES'):'Sin fecha';};
function read(key){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null;}catch{return null;}}
const options=[['week','Últimos 7 días'],['month','Últimos 30 días'],['all','Todo el historial']];
let period='week';
root.innerHTML='<div class="panel-head"><div><div class="eyebrow">RESUMEN PERSONAL</div><h2>Mi panel</h2><p>Actividad registrada en este navegador. No son puntuaciones clínicas ni datos sincronizados.</p></div><label>Periodo <select id="rp-period">'+options.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select></label></div><div id="rp-notice" role="status" aria-live="polite"></div><div id="rp-metrics" class="rp-metrics"></div><div class="rp-grid"><div class="assistant-card"><h3>Tiempo de actividad por área</h3><div id="rp-bars"></div></div><div class="assistant-card"><h3>Actividad reciente</h3><div id="rp-recent"></div></div></div><div class="rp-actions"><a class="button secondary" href="#mi-dia">Gestionar tareas</a><a class="button secondary" href="#productividad">Productividad</a><a class="button secondary" href="#mi-evolucion">Mi evolución</a><a class="button secondary" href="#proyectos">Proyectos</a></div>';
const inRange=v=>{if(period==='all')return true;const t=new Date(v).getTime();if(!Number.isFinite(t))return false;return t>=Date.now()-(period==='week'?7:30)*86400000&&t<=Date.now()+86400000;};
function render(){
const a=read('rumbo-asistente-v1'),e=read('rumbo-evolucion-v1'),o=read('rumbo-organizacion-v1');
const validA=a&&Array.isArray(a.items)&&Array.isArray(a.sessions);
const validE=e&&Array.isArray(e.sessions);
const validO=o&&Array.isArray(o.projects);
const tasks=validA?a.items:[],sessions=validA?a.sessions.filter(s=>inRange(s.date)):[],ev=validE?e.sessions.filter(s=>s.source!=='aportada'&&inRange(s.date)):[];
const done=tasks.filter(t=>t.done&&t.doneAt&&inRange(t.doneAt)).length;
const pending=tasks.filter(t=>!t.done).length;
const minutes=Math.round(sessions.reduce((n,s)=>n+(Number.isFinite(s.seconds)?Math.max(0,s.seconds):0),0)/60);
const cards=[['Tareas completadas',done],['Tareas pendientes',pending],['Tiempo registrado',minutes+' min'],['Sesiones de evolución',ev.length],['Proyectos activos',validO?o.projects.filter(p=>p.status==='Activo').length:'—']];
document.getElementById('rp-metrics').innerHTML=cards.map(([label,value])=>'<article><strong>'+esc(value)+'</strong><span>'+esc(label)+'</span></article>').join('');
document.getElementById('rp-notice').textContent=(!validA||!validE||!validO?'Algunos módulos aún no tienen datos legibles. Se muestran únicamente los disponibles. ':'')+'Los datos se guardan por separado en el navegador actual.';
const areas=new Map();sessions.forEach(s=>{const k=String(s.area||'Sin área');areas.set(k,(areas.get(k)||0)+Math.max(0,Number(s.seconds)||0));});
const sorted=[...areas].sort((a,b)=>b[1]-a[1]);const max=Math.max(1,...sorted.map(x=>x[1]));
document.getElementById('rp-bars').innerHTML=sorted.length?sorted.map(([name,seconds])=>'<div class="rp-bar-label"><span>'+esc(name)+'</span><strong>'+Math.round(seconds/60)+' min</strong></div><div class="rp-track"><div class="rp-fill" style="width:'+Math.min(100,seconds/max*100)+'%"></div></div>').join(''):'<p>No hay bloques de tiempo registrados en este periodo.</p>';
const recent=[...sessions.map(s=>({date:s.date,title:s.title||s.area||'Bloque de actividad',kind:'Productividad'})),...ev.map(s=>({date:s.date,title:'Sesión de evolución',kind:'Evolución'}))].filter(x=>Number.isFinite(new Date(x.date).getTime())).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
document.getElementById('rp-recent').innerHTML=recent.length?'<ul>'+recent.map(x=>'<li><strong>'+esc(x.title)+'</strong><small>'+esc(x.kind)+' · '+esc(day(x.date))+'</small></li>').join('')+'</ul>':'<p>No hay actividad registrada en este periodo.</p>';
}
document.getElementById('rp-period').addEventListener('change',e=>{period=e.target.value;render();});
window.addEventListener('rumbo:assistant-changed',render);
window.addEventListener('rumbo:projects-updated',render);
window.addEventListener('storage',render);
window.addEventListener('focus',render);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
render();
})();