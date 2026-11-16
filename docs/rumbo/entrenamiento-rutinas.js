/* Rutinas y registro ABCD independientes del historial y del diario privado. */
(() => {
'use strict';
const STORAGE='rumbo-entrenamiento-abcd-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'Fecha no válida':d.toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'});};
let records=[];let error='';
try {const value=JSON.parse(localStorage.getItem(STORAGE)||'[]');records=Array.isArray(value)?value.filter(r=>r&&typeof r.id==='string'&&typeof r.date==='string'):[];} catch {error='No se pudieron leer los registros locales. No se han sobrescrito.';}
let timer=null,end=0;
const styles=`
#ev-rutinas-abcd{margin:1.2rem 0;padding:1rem;border:1px solid var(--border,#d9e1e7);border-radius:14px;background:var(--surface,#fff)}
#ev-rutinas-abcd .er-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin:12px 0 20px}
#ev-rutinas-abcd .er-card{padding:16px;border:1px solid #d7e1ea;border-radius:12px;background:#f7fafc}
#ev-rutinas-abcd .er-card h4{margin:0 0 8px;font-size:1.05rem}
#ev-rutinas-abcd button{min-height:44px}
#ev-rutinas-abcd .er-steps{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
#ev-rutinas-abcd .er-steps span{border-radius:99px;border:1px solid #b5c6d7;padding:6px 10px}
#ev-rutinas-abcd .er-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
#ev-rutinas-abcd label{display:block;font-weight:600}
#ev-rutinas-abcd textarea{display:block;width:100%;box-sizing:border-box;min-height:84px;margin-top:6px;padding:10px;border-radius:8px;border:1px solid #a6b7c6;font:inherit}
#ev-rutinas-abcd .er-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
#ev-rutinas-abcd .er-scroll{overflow-x:auto}
#ev-rutinas-abcd table{width:100%;min-width:700px;border-collapse:collapse;font-size:.94rem}
#ev-rutinas-abcd th,#ev-rutinas-abcd td{border:1px solid #dce4eb;padding:10px;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}
#ev-rutinas-abcd th{background:#edf3f8}
#ev-rutinas-abcd .er-hint{font-size:.9rem;color:var(--muted,#526476)}
#ev-rutinas-abcd [role="status"]{min-height:1.4em}
@media(max-width:620px){#ev-rutinas-abcd .er-form{grid-template-columns:1fr}#ev-rutinas-abcd{padding:12px}}
`;
const style=document.createElement('style');style.textContent=styles;document.head.appendChild(style);
function store(){try{localStorage.setItem(STORAGE,JSON.stringify(records));error='';return true;}catch{error='No se pudo guardar en este navegador. Copia el texto antes de salir.';return false;}}
function table(){
const tbody=document.querySelector('#er-body');if(!tbody)return;
tbody.innerHTML=[...records].reverse().map(r=>`<tr><td>${esc(dateText(r.date))}</td><td>${esc(r.situacion)}</td><td>${esc(r.pensamiento)}</td><td>${esc(r.emocion)}</td><td>${esc(r.conducta)}</td><td><button type="button" class="button secondary" data-er-delete="${esc(r.id)}" aria-label="Eliminar registro del ${esc(dateText(r.date))}">Eliminar</button></td></tr>`).join('');
document.querySelector('#er-empty').hidden=records.length>0;
document.querySelector('#er-count').textContent=`${records.length} registro(s)`;
document.querySelector('#er-status').textContent=error;
}
function mount(){
const parent=document.querySelector('#mi-evolucion #ev-training');if(!parent||parent.querySelector('#ev-rutinas-abcd'))return;
const el=document.createElement('section');el.id='ev-rutinas-abcd';
el.innerHTML=`<h3>Mis rutinas y registro</h3><p class="er-hint">Un entrenamiento breve para cambiar de tarea con intención y registrar lo ocurrido.</p>
<div class="er-grid"><div class="er-card"><h4>1. Pausa de 10 segundos</h4><p>Antes de cambiar de tarea, detente diez segundos y decide si el cambio es necesario.</p><button type="button" class="button primary" id="er-pause">Iniciar 10 segundos</button><p id="er-pause-state" role="status" aria-live="polite">Lista para practicar.</p></div>
<div class="er-card"><h4>2. Detenerme · Analizar · Pensar · Ejecutar</h4><div class="er-steps"><span>Detenerme</span><span>Analizar</span><span>Pensar</span><span>Ejecutar</span></div><p><strong>Detenerme:</strong> noto la urgencia. <strong>Analizar:</strong> ¿qué está pasando? <strong>Pensar:</strong> ¿qué opción es útil? <strong>Ejecutar:</strong> hago una sola acción elegida.</p><button type="button" class="button secondary" id="er-start-dape">Practicar los cuatro pasos</button><p id="er-dape-state" role="status" aria-live="polite">Sin empezar.</p></div></div>
<h4>3. Registro de situación, pensamiento, emoción y conducta</h4><p class="er-hint">Se añade la fecha y hora del dispositivo automáticamente. Describe hechos, no diagnósticos.</p>
<form id="er-form" class="er-form">
<label>Situación<textarea name="situacion" required maxlength="3000" placeholder="¿Qué ocurrió, de forma concreta?"></textarea></label>
<label>Pensamiento<textarea name="pensamiento" required maxlength="3000" placeholder="¿Qué pasó por mi cabeza?"></textarea></label>
<label>Emoción<textarea name="emocion" required maxlength="3000" placeholder="¿Qué sentí?"></textarea></label>
<label>Conducta<textarea name="conducta" required maxlength="3000" placeholder="¿Qué hice?"></textarea></label>
<div><button type="submit" class="button primary">Guardar registro con fecha y hora</button></div></form>
<div class="er-actions"><strong id="er-count"></strong><button type="button" class="button secondary" id="er-export">Exportar registros JSON</button></div>
<p class="er-hint">Estos nuevos registros se guardan solo en este navegador, sin cifrado adicional ni sincronización. No son parte de los 132 registros históricos ni de las notas privadas de Mi espacio. Exporta una copia y evita información especialmente sensible.</p>
<p id="er-status" role="status" aria-live="polite"></p>
<div class="er-scroll"><table><thead><tr><th>Fecha y hora</th><th>Situación</th><th>Pensamiento</th><th>Emoción</th><th>Conducta</th><th>Acción</th></tr></thead><tbody id="er-body"></tbody></table></div><p id="er-empty">Todavía no hay registros.</p>`;
parent.prepend(el);
el.querySelector('#er-pause').addEventListener('click',()=>{
 if(timer!==null){clearInterval(timer);timer=null;}
 end=Date.now()+10000;
 const button=el.querySelector('#er-pause'),out=el.querySelector('#er-pause-state');
 button.disabled=true;
 out.textContent='10 segundos: mantén la tarea actual en mente.';
 timer=setInterval(()=>{const left=Math.max(0,Math.ceil((end-Date.now())/1000));out.textContent=left?`Quedan ${left} segundos.`:'Pausa completada. Decide conscientemente si cambias de tarea.';if(left===0){clearInterval(timer);timer=null;button.disabled=false;}},200);
});
let step=0;const names=['Detenerme: identifico la urgencia.','Analizar: describo lo que ocurre.','Pensar: elijo una respuesta útil.','Ejecutar: realizo una acción concreta.'];
el.querySelector('#er-start-dape').addEventListener('click',()=>{const out=el.querySelector('#er-dape-state');out.textContent=names[step];step=(step+1)%4;el.querySelector('#er-start-dape').textContent=step===0?'Volver a practicar':'Siguiente paso';});
el.querySelector('#er-form').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;const fd=new FormData(form);const r={id:crypto.randomUUID(),date:new Date().toISOString()};for(const name of ['situacion','pensamiento','emocion','conducta']){r[name]=String(fd.get(name)||'').trim();if(!r[name])return;}records.push(r);if(store()){form.reset();table();}else{records.pop();table();}});
el.querySelector('#er-export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),records},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='rumbo-entrenamiento-registros-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
el.querySelector('#er-body').addEventListener('click',e=>{const b=e.target.closest('[data-er-delete]');if(!b)return;if(!confirm('¿Eliminar solo este registro de entrenamiento? No afecta al historial.'))return;const before=records;records=records.filter(r=>r.id!==b.dataset.erDelete);if(!store())records=before;table();});
table();
}
let queued=false;
const observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;mount();});});
const root=document.getElementById('mi-evolucion');if(!root)return;
observer.observe(root,{childList:true,subtree:true});mount();
})();
