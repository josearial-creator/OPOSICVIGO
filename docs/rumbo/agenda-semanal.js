(() => {
'use strict';
const zone='Europe/Madrid',dateFmt=new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}),clock=new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit',timeZone:zone}),madrid=new Intl.DateTimeFormat('en-GB',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:zone});
function dayOf(d){const p=Object.fromEntries(madrid.formatToParts(d).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;}
function plus(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function formatDay(d){return dateFmt.format(new Date(d+'T12:00:00Z'));}
function validDay(day){return /^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day+'T12:00:00Z').toISOString().slice(0,10)===day;}
function agendaRows(events,start){
 const last=plus(start,6),rows=[];
 for(const e of events){
  if(!e||typeof e.title!=='string'||typeof e.start!=='string'||typeof e.end!=='string'||typeof e.all_day!=='boolean')continue;
  const from=Date.parse(e.start),to=Date.parse(e.end);
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<from)continue;
  if(e.all_day&&(!validDay(e.start)||!validDay(e.end)||to===from))continue;
  const a=e.all_day?e.start:dayOf(new Date(from));
  const end=e.all_day?plus(e.end,-1):dayOf(new Date(Math.max(from,to-1)));
  if(a>last||end<start)continue;
  const day=a<start?start:a;
  rows.push({day,hour:e.all_day?'Todo el día':a<start?'En curso':clock.format(new Date(from)),title:e.title,sort:e.all_day?-Infinity:from});
 }
 return rows.sort((a,b)=>a.day.localeCompare(b.day)||(a.sort===b.sort?0:a.sort-b.sort)||a.title.localeCompare(b.title,'es'));
}
if(typeof module!=="undefined"&&module.exports){module.exports={agendaRows,dayOf,plus};return;}
const root=document.querySelector('#mi-dia .assistant-body');
if(!root)return;
const card=document.createElement('section');
card.className='assistant-card weekly-agenda';
card.setAttribute('aria-labelledby','weekly-agenda-heading');
card.innerHTML='<h3 id="weekly-agenda-heading">Agenda · próximos 7 días</h3><p role="status" aria-live="polite"></p><div data-agenda-list></div><button type="button" class="button secondary" data-refresh>Actualizar citas</button>';
root.prepend(card);
const status=card.querySelector('[role=status]'),list=card.querySelector('[data-agenda-list]'),button=card.querySelector('[data-refresh]');
const endpoint='https://rumbo-entrenador.jose-arial.workers.dev/calendar/events';
let snapshot=null,gen=0,controller=null,lastRead=0,lastDay='',failure=false;
function render(){
 list.replaceChildren();lastDay=dayOf(new Date());
 if(!snapshot){status.textContent=failure?'No se pudo consultar la agenda.':'Sin sincronización recibida todavía.';return;}
 if(!snapshot.captured_at){status.textContent='Sin sincronización recibida todavía. Comprueba el flujo de Google Calendar en n8n.';return;}
 const start=lastDay,last=plus(start,6),rows=agendaRows(snapshot.events,start);
 let currentDay='',ul;
 for(const r of rows){
  if(r.day!==currentDay){
   currentDay=r.day;
   const group=document.createElement('section'),heading=document.createElement('h4'),time=document.createElement('time');
   group.className='agenda-day';heading.id='agenda-day-'+r.day;group.setAttribute('aria-labelledby',heading.id);
   time.dateTime=r.day;time.textContent=(r.day===start?'Hoy · ':r.day===plus(start,1)?'Mañana · ':'')+formatDay(r.day);
   heading.append(time);ul=document.createElement('ul');group.append(heading,ul);list.append(group);
  }
  const li=document.createElement('li'),hour=document.createElement('strong'),title=document.createElement('span');
  hour.textContent=r.hour;title.textContent=r.title;li.append(hour,title);ul.append(li);
 }
 const age=Date.now()-Date.parse(snapshot.captured_at);
 status.textContent='Del '+formatDay(start)+' al '+formatDay(last)+' · '+(rows.length?rows.length+' citas':'Sin citas en la última copia')+' · Última sincronización: '+new Date(snapshot.captured_at).toLocaleString('es-ES',{timeZone:zone})+(failure?' · Error de consulta; mostrando última copia':age>16*3600000?' · La sincronización está atrasada':'');
}
async function refresh(){
 const session=window.RumboSession,id=++gen;
 controller?.abort();
 if(!session?.available()){snapshot=null;failure=false;list.replaceChildren();button.disabled=true;status.textContent='Abre el acceso privado de Rumbo para consultar tu calendario.';return;}
 const c=new AbortController();controller=c;const timeout=setTimeout(()=>c.abort(),15000);
 lastRead=Date.now();button.disabled=true;status.textContent='Consultando citas…';
 try{
 const auth='Rumbo '+btoa(String.fromCharCode(...new TextEncoder().encode(session.use())));
 const res=await fetch(endpoint,{headers:{Authorization:auth},cache:'no-store',signal:c.signal,redirect:'error'});
 if(res.status===401||res.status===403){if(id===gen)snapshot=null;throw Error('HTTP '+res.status);}
  if(!res.ok)throw Error('HTTP '+res.status);
 const value=await res.json();
 if(!Array.isArray(value.events)||!(value.captured_at===null||Number.isFinite(Date.parse(value.captured_at))))throw Error('Respuesta inválida');
 if(id!==gen||!session.available())return;
 snapshot=value;failure=false;render();
 }catch{if(id===gen){failure=true;render();}}
 finally{clearTimeout(timeout);if(id===gen)button.disabled=!session.available();}
}
button.addEventListener('click',refresh);
function due(){if(!window.RumboSession?.available())return;if(lastDay!==dayOf(new Date()))render();if(!document.hidden&&Date.now()-lastRead>=300000&&!button.disabled)void refresh();}
function init(){window.RumboSession?.subscribe(()=>void refresh());void refresh();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
document.addEventListener('visibilitychange',due);window.addEventListener('focus',due);window.addEventListener('pageshow',due);
function minute(){setTimeout(()=>{due();minute();},60000-Date.now()%60000);}minute();
})();
