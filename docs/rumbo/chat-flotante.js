(() => {
 'use strict';
 // Chat compacto: ayuda local sin red. OpenAI es opcional y nunca se activa solo.
 // No se guardan mensajes en localStorage, IndexedDB ni en el Worker.
 const host=document.getElementById('rumbo-chat');
 if(!host)return;
 const API='https://rumbo-entrenador.jose-arial.workers.dev/rumbo-assistant';
 const esc=(s)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const shortened=(s,n)=>String(s||'').trim().slice(0,n);
 const el=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=String(txt);return x;};
 const toggle=el('button','rumbo-chat-toggle','Preguntar a Rumbo');
 toggle.type='button';toggle.setAttribute('aria-controls','rumbo-chat-panel');toggle.setAttribute('aria-expanded','false');
 const panel=el('section','rumbo-chat-panel');panel.id='rumbo-chat-panel';panel.hidden=true;
 panel.setAttribute('aria-label','Chat de ayuda sobre Rumbo');
 panel.innerHTML=`
 <header class="rumbo-chat-head">
  <div><strong>Asistente de Rumbo</strong><span>Pregúntame sobre esta página</span></div>
  <button type="button" id="rumbo-chat-close" aria-label="Cerrar el chat">✕</button>
 </header>
 <div class="rumbo-chat-messages" id="rumbo-chat-messages" role="log" aria-live="polite" aria-relevant="additions text"></div>
 <div class="rumbo-chat-suggestions" id="rumbo-chat-suggestions">
  <button type="button" data-rumbo-question="¿Cuáles son mis oposiciones favoritas?">Mis favoritas</button>
  <button type="button" data-rumbo-question="¿Qué prioridades tengo pendientes?">Mis prioridades</button>
  <button type="button" data-rumbo-question="¿Cómo registro tiempo de estudio?">Registrar tiempo</button>
 </div>
 <form id="rumbo-chat-form" class="rumbo-chat-form">
  <label for="rumbo-chat-input">Tu pregunta</label>
  <div class="rumbo-chat-composer"><textarea id="rumbo-chat-input" rows="2" maxlength="1000" placeholder="Pregunta por tus favoritas, tareas o apartados…" required></textarea><button type="submit" id="rumbo-chat-send" aria-label="Enviar pregunta">Enviar</button></div>
 </form>
 <details class="rumbo-chat-ai"><summary>Respuestas con OpenAI · opcional</summary>
  <label><input type="checkbox" id="rumbo-chat-consent"> Autorizo enviar mi pregunta y un resumen limitado de convocatorias y prioridades a OpenAI. Requiere acceso privado y una API configurada; puede tener coste por consulta.</label>
  <p>La ayuda local funciona sin coste ni conexión con OpenAI. El historial de este chat se conserva solo mientras esta página esté abierta. Nunca se envían notas personales ni contraseñas dentro del contexto.</p>
 </details>
 <p class="rumbo-chat-status" id="rumbo-chat-status" role="status" aria-live="polite"></p>`;
 host.append(toggle,panel);
 const $=id=>host.querySelector('#'+id);
 const messages=$('rumbo-chat-messages'),input=$('rumbo-chat-input'),send=$('rumbo-chat-send');
 const consent=$('rumbo-chat-consent'),status=$('rumbo-chat-status');
 let busy=false;
 const history=[];
 function add(role,text){
   const node=el('p','rumbo-chat-bubble rumbo-chat-'+role,text);
   messages.append(node);messages.scrollTop=messages.scrollHeight;
   history.push({role:role==='user'?'user':'assistant',text:shortened(text,900)});
   while(history.length>10)history.shift();
 }
 function show(open){
   panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
   if(open){input.focus({preventScroll:true});}
   else toggle.focus({preventScroll:true});
 }
 toggle.addEventListener('click',()=>show(panel.hidden));
 $('rumbo-chat-close').addEventListener('click',()=>show(false));
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();show(false);}});
 function snapshot(){
   const source=window.RumboChatData?.snapshot?.()||{records:[],favorites:[]};
   const records=Array.isArray(source.records)?source.records:[];
   const liked=new Set(Array.isArray(source.favorites)?source.favorites:[]);
   const toItem=r=>({
     title:shortened(r.title,180),organismo:shortened(r.organismo,120),
     fin:shortened(r.fin,120),estado:shortened(r.estado,120)
   });
   const favorites=records.filter(r=>liked.has(r.key)).slice(0,12).map(toItem);
   const assistant=window.RumboAssistant?.getSnapshot?.()||{items:[],priorityIds:[]};
   const tasks=Array.isArray(assistant.items)?assistant.items:[];
   const priorityIds=Array.isArray(assistant.priorityIds)?assistant.priorityIds:[];
   const priorities=priorityIds.map(id=>tasks.find(t=>t.id===id&&!t.done))
     .filter(Boolean).slice(0,3).map(t=>({text:shortened(t.nextStep||t.text,170),done:false}));
   return {section:shortened(window.RumboNavigation?.current?.()||'inicio',50),
     favorites,convocatorias:records.slice(0,12).map(toItem),priorities,consent:true};
 }
 function formatItems(items){
   return items.map((x,i)=>(i+1)+'. '+x.title+(x.organismo?' — '+x.organismo:'')).join('\n');
 }
 function local(question){
   const q=esc(question),data=snapshot();
   if(/favorit|guardad|estrella/.test(q))
     return data.favorites.length?
       'Tienes estas favoritas en este navegador:\n'+formatItems(data.favorites)+
       '\nComprueba su estado en la convocatoria oficial.':
       'No encuentro oposiciones favoritas entre las fichas cargadas en este navegador. Entra en Oposiciones → Favoritas para comprobarlas.';
   if(/prioridad|tarea|pendiente|hacer hoy|que hago/.test(q))
     return data.priorities.length?
       'Tus prioridades pendientes en «Mi día»:\n'+data.priorities.map((t,i)=>(i+1)+'. '+t.text).join('\n'):
       'No hay prioridades seleccionadas entre las tareas pendientes de «Mi día». Abre «Mi día» y elige una sola acción para empezar.';
   if(/plazo|inscrip|convocat|oposicion|fecha/.test(q))
     return data.convocatorias.length?
       'En la copia cargada hay '+(window.RumboChatData?.snapshot?.().records.length||0)+
       ' fichas. Estas son algunas:\n'+data.convocatorias.slice(0,5).map(x=>
       '• '+x.title+(x.fin?' · Fin indicado: '+x.fin:' · Plazo por verificar')).join('\n')+
       '\nEstos datos pueden no estar actualizados. Verifica la convocatoria oficial.':
       'Todavía no hay convocatorias cargadas. Abre Oposiciones → Convocatorias y prueba a actualizar la fuente.';
   if(/tiempo|pomodoro|cronometro|foco|estudi|productividad/.test(q))
     return 'Para registrar el tiempo, abre «Productividad», elige actividad, duración y pulsa «Iniciar». Al finalizar podrás guardar la sesión. El tiempo se registra en este navegador.';
   if(/nota|diario|historial|reflexion|registro personal/.test(q))
     return 'Los registros personales se gestionan en «Mi espacio», «Diario» e «Historial». Este chat no lee esos contenidos privados. Puedes abrir cada apartado para consultarlos.';
   if(/sesion|acceso|contrase|ajust|chatgpt|conexion/.test(q))
     return 'La rueda dentada abre Ajustes, donde encontrarás el acceso privado, la conexión cifrada con ChatGPT y el botón «Cerrar sesión». La conexión OpenAI de este chat es independiente.';
   return 'Puedo ayudarte con las favoritas, prioridades de Mi día, convocatorias y navegación por Rumbo. Prueba con «¿Qué prioridades tengo pendientes?» o «¿Cuáles son mis favoritas?». Para preguntas abiertas, existe una conexión opcional a OpenAI que requiere autorización.';
 }
 async function reply(question,prior){
   if(!consent.checked)return {answer:local(question),provider:'Local'};
   if(!window.RumboSession?.available())return {answer:'Para usar OpenAI, abre primero «Acceso privado» en la cabecera. Puedes seguir usando la ayuda local sin iniciar sesión.',provider:'Local'};
   const secret=window.RumboSession.use();
   const auth='Rumbo '+btoa(String.fromCharCode(...new TextEncoder().encode(secret)));
   const res=await fetch(API,{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},
     cache:'no-store',signal:AbortSignal.timeout(26000),body:JSON.stringify({question,context:snapshot(),history:prior})});
   const result=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(result.error||'Servicio de IA no disponible.');
   if(typeof result.answer!=='string'||!result.answer.trim()||result.answer.length>6000)throw Error('Respuesta de IA no válida.');
   return {answer:result.answer,provider:'OpenAI'};
 }
 async function submit(question){
   const q=shortened(question,1000);
   if(!q||busy)return;
   const prior=history.slice(-4);
   add('user',q);input.value='';send.disabled=true;busy=true;
   status.textContent=consent.checked?'Consultando OpenAI si está configurado…':'Consultando los datos cargados en Rumbo…';
   try{const response=await reply(q,prior);add('assistant',response.answer);
     status.textContent=response.provider==='Local'?'Respuesta local: no se han enviado datos a OpenAI.':'Respuesta de OpenAI basada en el contexto autorizado.';
   }catch(e){
     add('assistant','No se pudo consultar OpenAI: '+e.message+'\n\nAyuda local: '+local(q));
     status.textContent='OpenAI no disponible. Los datos de Rumbo no se han modificado.';
   }finally{busy=false;send.disabled=false;input.focus({preventScroll:true});}
 }
 $('rumbo-chat-form').addEventListener('submit',e=>{e.preventDefault();void submit(input.value);});
 $('rumbo-chat-suggestions').addEventListener('click',e=>{
   const b=e.target.closest('[data-rumbo-question]');if(b)void submit(b.dataset.rumboQuestion);
 });
 input.addEventListener('keydown',e=>{
   if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void submit(input.value);}
 });
 add('assistant','Hola. Estoy aquí para ayudarte con Rumbo. Puedes preguntarme por tus oposiciones favoritas, las prioridades de hoy o cómo utilizar cada apartado.');
})();
