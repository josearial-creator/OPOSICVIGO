/* Entrenamiento: rutinas y registros cifrados en el cliente, autenticados en Cloudflare. */
(() => {
'use strict';
const root=document.getElementById('mi-evolucion');
if(!root)return;
// Entrenamiento contiene datos personales: no utilizar direcciones API arbitrarias de localStorage.
const endpoint='https://rumbo-entrenador.jose-arial.workers.dev';
const enc=new TextEncoder(),dec=new TextDecoder();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const dateText=v=>new Date(v).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'});
let password='',items=[],busy=false,pending=null;
const style=document.createElement('style');
style.textContent=`#ev-rutinas-abcd{margin:1.2rem 0;padding:1rem;border:1px solid #d9e1e7;border-radius:14px;background:#fff;color:#183045}
#ev-rutinas-abcd .er-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:12px 0 20px}
#ev-rutinas-abcd .er-card{padding:16px;border:1px solid #d7e1ea;border-radius:12px;background:#f7fafc}
#ev-rutinas-abcd .er-card h4{margin:0 0 8px;font-size:1.05rem}
#ev-rutinas-abcd button{min-height:44px}
#ev-rutinas-abcd .er-steps{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
#ev-rutinas-abcd .er-steps span{border-radius:99px;border:1px solid #b5c6d7;padding:6px 10px}
#ev-rutinas-abcd .er-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
#ev-rutinas-abcd label{display:block;font-weight:600}
#ev-rutinas-abcd input,#ev-rutinas-abcd textarea{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:10px;border-radius:8px;border:1px solid #a6b7c6;font:inherit}
#ev-rutinas-abcd textarea{min-height:84px}
#ev-rutinas-abcd .er-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
#ev-rutinas-abcd .er-scroll{overflow-x:auto}
#ev-rutinas-abcd table{width:100%;min-width:700px;border-collapse:collapse;font-size:.94rem}
#ev-rutinas-abcd th,#ev-rutinas-abcd td{border:1px solid #dce4eb;padding:10px;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}
#ev-rutinas-abcd th{background:#edf3f8}
#ev-rutinas-abcd .er-hint{font-size:.9rem;color:#485c6b}
#ev-rutinas-abcd [role="status"]{min-height:1.4em}
@media(max-width:620px){#ev-rutinas-abcd .er-form{grid-template-columns:1fr}#ev-rutinas-abcd{padding:12px}}`;
document.head.appendChild(style);
function status(t){const e=document.getElementById('er-status');if(e)e.textContent=t;}
function auth(){return 'Rumbo '+b64(enc.encode(password));}
async function api(path='',method='GET',value){
 const response=await fetch(endpoint+'/training'+path,{method,headers:{Authorization:auth(),...(value?{'Content-Type':'application/json'}:{})},body:value?JSON.stringify(value):undefined,cache:'no-store',signal:AbortSignal.timeout(20000)});
 const data=await response.json().catch(()=>({error:'Respuesta no válida del servidor'}));
 if(!response.ok)throw Error(data.error||'No se pudo completar la operación');
 return data;
}
async function aes(pass,salt){
 const raw=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:180000,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function seal(fields){
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await aes(password,salt);
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(fields)));
 return {version:1,id:crypto.randomUUID(),date:new Date().toISOString(),salt:b64(salt),iv:b64(iv),cipher:b64(cipher)};
}
async function open(record){
 const key=await aes(password,un64(record.salt));
 const plain=dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(record.iv)},key,un64(record.cipher)));
 const fields=JSON.parse(plain);
 if(!['situacion','pensamiento','emocion','conducta'].every(k=>typeof fields[k]==='string'))throw Error('Contenido inválido');
 return {...record,...fields};
}
function table(){
 const body=document.getElementById('er-body');if(!body)return;
 body.innerHTML=items.map(r=>`<tr><td>${esc(dateText(r.date))}</td><td>${esc(r.situacion)}</td><td>${esc(r.pensamiento)}</td><td>${esc(r.emocion)}</td><td>${esc(r.conducta)}</td><td><button type="button" class="button secondary" data-er-delete="${esc(r.id)}">Eliminar</button></td></tr>`).join('');
 document.getElementById('er-empty').hidden=items.length!==0;
 document.getElementById('er-count').textContent=items.length+' registro(s) sincronizados';
}
async function refresh(){
 const data=await api();const decrypted=await Promise.allSettled(data.records.map(open));
 const bad=decrypted.filter(r=>r.status==='rejected').length;
 if(bad)throw Error(`Hay ${bad} registro(s) que no se pudieron descifrar. No se han borrado ni sobrescrito. Utiliza la contraseña original para evitar guardar datos con claves diferentes.`);
 items=decrypted.map(r=>r.value);
 table();
 status('Registros recuperados del almacenamiento privado.');
}
function mount(){
 const parent=root.querySelector('#ev-training');if(!parent||parent.querySelector('#ev-rutinas-abcd'))return;
 const el=document.createElement('section');el.id='ev-rutinas-abcd';
 el.innerHTML=`<h3>Mis rutinas y registros</h3><p class="er-hint">Una pausa consciente al cambiar de tarea, y un registro personal de lo ocurrido.</p>
<div class="er-grid"><div class="er-card"><h4>1. Pausa de 10 segundos</h4><p>Antes de cambiar de tarea, detente y decide si ese cambio es necesario.</p><button type="button" class="button primary" id="er-pause">Iniciar 10 segundos</button><p id="er-pause-state" role="status" aria-live="polite">Lista para practicar.</p></div>
<div class="er-card"><h4>2. Detenerme · Analizar · Pensar · Ejecutar</h4><div class="er-steps"><span>Detenerme</span><span>Analizar</span><span>Pensar</span><span>Ejecutar</span></div><p>Reconoce la urgencia, observa la situación, elige una respuesta y realiza una sola acción.</p><button type="button" class="button secondary" id="er-start-dape">Practicar los cuatro pasos</button><p id="er-dape-state" role="status" aria-live="polite">Sin empezar.</p></div></div>
<h4>3. Registro de situación, pensamiento, emoción y conducta</h4>
<div id="er-login"><label>Contraseña privada de Rumbo<input type="password" id="er-pass" autocomplete="off" placeholder="No se guarda en el navegador"></label><div class="er-actions"><button type="button" class="button primary" id="er-connect">Conectar y sincronizar</button></div><p class="er-hint">Utiliza la misma contraseña de Mi espacio. El texto se cifra en este dispositivo antes de enviarlo a Cloudflare.</p></div>
<div id="er-private" hidden><div class="er-actions"><button type="button" class="button secondary" id="er-refresh">Recargar del servidor</button><button type="button" class="button secondary" id="er-lock">Cerrar acceso</button></div>
<form id="er-form" class="er-form"><label>Situación<textarea name="situacion" required maxlength="3000" placeholder="¿Qué ocurrió?"></textarea></label><label>Pensamiento<textarea name="pensamiento" required maxlength="3000" placeholder="¿Qué pensé?"></textarea></label><label>Emoción<textarea name="emocion" required maxlength="3000" placeholder="¿Qué sentí?"></textarea></label><label>Conducta<textarea name="conducta" required maxlength="3000" placeholder="¿Qué hice?"></textarea></label><div><button type="submit" class="button primary" id="er-save">Guardar cifrado con fecha y hora</button></div></form>
<div class="er-actions"><strong id="er-count">0 registros</strong><button type="button" class="button secondary" id="er-export">Exportar copia cifrada JSON</button></div>
<p class="er-hint">Los registros se cifran en el navegador con la contraseña y se sincronizan con Cloudflare. La contraseña no se conserva al cerrar o recargar. Conserva la contraseña y una copia cifrada: sin ella no podrás recuperar los registros. Los 132 registros históricos y Mi espacio son independientes.</p>
<div class="er-scroll"><table><thead><tr><th>Fecha y hora</th><th>Situación</th><th>Pensamiento</th><th>Emoción</th><th>Conducta</th><th>Acción</th></tr></thead><tbody id="er-body"></tbody></table></div><p id="er-empty">Todavía no hay registros.</p></div><p id="er-status" role="status" aria-live="polite"></p>`;
 parent.prepend(el);
 let timer=null,step=0;
 el.querySelector('#er-pause').onclick=()=>{if(timer)clearInterval(timer);const until=Date.now()+10000;const button=el.querySelector('#er-pause');button.disabled=true;timer=setInterval(()=>{const t=Math.max(0,Math.ceil((until-Date.now())/1000));el.querySelector('#er-pause-state').textContent=t?`Quedan ${t} segundos`:'Pausa completada. Decide si cambias de tarea.';if(!t){clearInterval(timer);timer=null;button.disabled=false;}},200);};
 const steps=['Detenerme: detecto la urgencia.','Analizar: observo lo que ocurre.','Pensar: elijo una respuesta útil.','Ejecutar: realizo una acción.'];
 el.querySelector('#er-start-dape').onclick=()=>{el.querySelector('#er-dape-state').textContent=steps[step];step=(step+1)%4;el.querySelector('#er-start-dape').textContent=step?'Siguiente paso':'Volver a practicar';};
 el.querySelector('#er-connect').onclick=async()=>{if(busy)return;const p=el.querySelector('#er-pass').value;if(!p){status('Introduce tu contraseña de Rumbo.');return;}busy=true;password=p;el.querySelector('#er-connect').disabled=true;try{await refresh();el.querySelector('#er-pass').value='';el.querySelector('#er-login').hidden=true;el.querySelector('#er-private').hidden=false;}catch(e){password='';status('No se pudo conectar: '+e.message);}finally{busy=false;el.querySelector('#er-connect').disabled=false;}};
 el.querySelector('#er-refresh').onclick=async()=>{try{await refresh();}catch(e){status('No se pudo sincronizar: '+e.message);}};
 el.querySelector('#er-lock').onclick=()=>{password='';items=[];pending=null;el.querySelector('#er-form').reset();table();el.querySelector('#er-private').hidden=true;el.querySelector('#er-login').hidden=false;status('Acceso cerrado. Los campos y registros visibles se han ocultado.');};
 el.querySelector('#er-form').onsubmit=async e=>{e.preventDefault();if(busy||!password)return;const form=e.currentTarget,fd=new FormData(form);const fields={};for(const k of ['situacion','pensamiento','emocion','conducta']){fields[k]=String(fd.get(k)||'').trim();if(!fields[k])return;}
 busy=true;el.querySelector('#er-save').disabled=true;status('Cifrando y guardando…');
 try{
  if(!pending)pending=await seal(fields);
  const savedId=pending.id;
  // El éxito de POST confirma el guardado aunque falle el GET posterior.
  await api('','POST',pending);
  pending=null;
  form.reset();
  try{
   await refresh();
   status(items.some(r=>r.id===savedId)
    ?'Guardado cifrado confirmado en Cloudflare. El registro aparece en la tabla.'
    :'Guardado cifrado confirmado en Cloudflare. Puede tardar en aparecer en la tabla; pulsa «Recargar del servidor». No lo guardes de nuevo.');
  }catch(refreshError){
   status('Guardado cifrado confirmado en Cloudflare, pero no se pudo actualizar la tabla: '+refreshError.message+'. Pulsa «Recargar del servidor»; no repitas el guardado.');
  }
 }catch(e){status('Guardado no confirmado: '+e.message+'. No cierres ni modifiques el formulario hasta reintentar.');}
 finally{busy=false;el.querySelector('#er-save').disabled=false;}};
 el.querySelector('#er-form').addEventListener('input',()=>{pending=null;});
 el.querySelector('#er-body').onclick=async e=>{const button=e.target.closest('[data-er-delete]');if(!button||busy)return;if(!confirm('¿Eliminar este registro del servidor? Esta acción no se puede deshacer.'))return;busy=true;try{await api('/'+button.dataset.erDelete,'DELETE');await refresh();status('Registro eliminado del servidor.');}catch(err){status('No se confirmó la eliminación: '+err.message);}finally{busy=false;}};
 el.querySelector('#er-export').onclick=async()=>{try{const raw=await api();const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),records:raw.records},null,2)],{type:'application/json'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='rumbo-entrenamiento-copia-cifrada-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);status('Copia cifrada preparada. Conserva también la contraseña.');}catch(e){status('No se pudo exportar: '+e.message);}};
}
let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;mount();});}).observe(root,{childList:true,subtree:true});
mount();
})();
