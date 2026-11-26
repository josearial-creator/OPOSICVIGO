(() => {
'use strict';
const root=document.getElementById('productividad'),session=window.RumboSession;
if(!root||!session)return;
const endpoint='https://rumbo-entrenador.jose-arial.workers.dev/anytype/tasks';
const card=document.createElement('section');card.className='assistant-card';
card.innerHTML='<h3>Tareas de Anytype</h3><p role="status" aria-live="polite"></p><label>Mostrar <select><option value="active">Activas</option><option value="por_revisar">Por revisar</option><option value="completada">Completadas</option><option value="archivada">Archivadas</option><option value="all">Todas</option></select></label> <button type="button" class="button secondary">Actualizar</button><ul></ul>';
root.append(card);
const status=card.querySelector('p'),filter=card.querySelector('select'),button=card.querySelector('button'),list=card.querySelector('ul');
let data=null,generation=0,controller=null;
const labels={pendiente:'Pendiente',hoy:'Hoy (Anytype)',en_curso:'En curso',en_espera:'En espera',por_revisar:'Por revisar',completada:'Completada',archivada:'Archivada'};
function render(){
 list.replaceChildren();
 if(!data)return;
 const tasks=data.tareas.filter(t=>filter.value==='all'||(filter.value==='active'?t.activa===true:t.estado===filter.value));
 for(const t of tasks){
  const li=document.createElement('li');
  li.textContent=t.titulo+' — '+(labels[t.estado]||'Por revisar')+(t.fecha_vencimiento?' · '+new Date(t.fecha_vencimiento).toLocaleDateString('es-ES',{timeZone:'Europe/Madrid'}):'');
  list.append(li);
 }
 status.textContent=tasks.length+' tareas · '+(data.sincronizado_en?'Última sincronización: '+new Date(data.sincronizado_en).toLocaleString('es-ES',{timeZone:'Europe/Madrid'}):'Sin sincronización todavía');
}
async function refresh(){
 const current=++generation;controller?.abort();data=null;list.replaceChildren();
 button.disabled=!session.available();filter.disabled=button.disabled;
 if(!session.available()){status.textContent='Abre el acceso privado de Rumbo para consultar tus tareas.';return;}
 controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),15000);
 status.textContent='Consultando tareas…';button.disabled=true;
 try{
  const auth='Rumbo '+btoa(String.fromCharCode(...new TextEncoder().encode(session.use())));
  const res=await fetch(endpoint,{headers:{Authorization:auth},cache:'no-store',signal:controller.signal,redirect:'error'});
  if(!res.ok)throw Error('HTTP '+res.status);
  const value=await res.json();
  if(!Array.isArray(value.tareas))throw Error('Respuesta inválida');
  if(current!==generation||!session.available())return;
  data=value;render();
 }catch{if(current===generation)status.textContent='No se pudieron consultar las tareas. Comprueba la conexión o vuelve a intentarlo.';}
 finally{clearTimeout(timeout);if(current===generation)button.disabled=!session.available();}
}
filter.addEventListener('change',render);button.addEventListener('click',refresh);
session.subscribe(()=>void refresh());
window.addEventListener('hashchange',()=>{if(location.hash==='#productividad'&&session.available())void refresh();});
setInterval(()=>{if(session.available()&&!document.hidden&&location.hash==='#productividad'&&!button.disabled)void refresh();},900000);
void refresh();
})();
