/* Solo presenta el temporizador existente: no crea relojes ni escribe datos. */
(() => {
 'use strict';
 const main=document.querySelector('.main'),page=document.querySelector('.page');
 if(!main||!page)return;
 const bar=document.createElement('section');bar.className='running-block';bar.id='running-block';bar.hidden=true;
 bar.setAttribute('aria-label','Bloque en curso');
 const copy=document.createElement('div');copy.className='running-block-copy';
 const state=document.createElement('span');state.className='running-block-state';
 const title=document.createElement('strong');title.className='running-block-title';
 const time=document.createElement('span');time.className='running-block-clock';time.setAttribute('role','timer');time.setAttribute('aria-label','Tiempo restante del bloque');time.setAttribute('aria-live','off');
 const back=document.createElement('a');back.className='button secondary';back.href='#productividad';back.textContent='Ver bloque';
 copy.append(state,title);bar.append(copy,time,back);main.insertBefore(bar,page);
 function render(){
  const timer=window.RumboAssistant?.getTimerSnapshot?.();
  bar.hidden=!timer||document.body.dataset.rumboRoute==='productividad';
  if(!timer)return;
  const remaining=Math.max(0,Math.ceil(timer.target-timer.seconds));
  state.textContent=remaining===0?'Tiempo previsto cumplido':timer.startedAt===null?'Bloque en pausa':'Bloque en curso';
  bar.dataset.state=remaining===0?'finished':timer.startedAt===null?'paused':'running';
  title.textContent=timer.title;title.title=timer.title;
  time.textContent=String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0');
 }
 window.addEventListener('rumbo:assistant-changed',render);
 window.addEventListener('rumbo:route-changed',render);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
 setInterval(()=>{if(!document.hidden)render();},1000);
 render();
})();
