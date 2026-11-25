(() => {
'use strict';
const root=document.getElementById('panel-control');if(!root)return;
root.innerHTML='<div class="panel-head"><div><div class="eyebrow">RUMBO · ADMINISTRACIÓN</div><h2>Panel de control</h2><p>Conexiones y sincronización, separadas de tus datos personales.</p></div></div>'+
'<section class="control-body"><div class="control-top"><div><strong>Sincronización automática</strong><p id="control-overview" role="status">Comprobando conexiones…</p></div><button type="button" class="button secondary" id="control-retry">Comprobar ahora</button></div>'+
'<p>Actualización al abrir Rumbo, recuperar conexión y cada cinco minutos mientras esté visible. No necesita recargar la página. Con la aplicación cerrada, los datos del servidor se recuperan al volver.</p>'+
'<div class="control-grid" id="control-sources"></div>'+
'<article class="control-card"><h3>Configuración del análisis emocional</h3><label><input id="control-auto" type="checkbox"> Incorporar automáticamente las anotaciones disponibles al Observatorio</label><p>Las clasificaciones son provisionales, no diagnósticos. No se altera el diario original. Puedes corregirlas después o desactivar la incorporación aquí.</p><label><input id="control-obs-cloud" type="checkbox"> Sincronizar resultados cifrados del Observatorio entre dispositivos</label><p>Requiere acceso privado y bóveda abierta. Introduce una sola vez en cada dispositivo la misma frase privada de sincronización (mínimo 16 caracteres, distinta del token de acceso). No se envía al servidor. Conserva la frase; no se puede recuperar desde la nube.</p><form id="control-cloud-form" hidden><label>Frase privada de sincronización<input id="control-cloud-pass" type="password" autocomplete="off" minlength="16" required></label><button type="submit" class="button primary">Activar conexión cifrada</button></form><p id="control-cloud-message" role="status"></p></article>'+
'<details class="control-card" id="control-chat-details"><summary>Configurar vínculo anterior de ChatGPT</summary><div id="control-chat-host"></div><p>Usa la frase de recuperación de la conexión cifrada, no la contraseña de ChatGPT. Las reflexiones enviadas al diario privado también se recuperan con Acceso privado.</p></details>'+
'<article class="control-card" id="control-calendar"><h3>Conectar Google Calendar</h3><p>La dirección secreta iCal se guarda en este navegador; no se muestra en el panel.</p><div id="control-agenda-host"></div></article>'+
'<article class="control-card"><h3>Copias y conexiones adicionales</h3><p>Garmin, sueño y la sincronización general de tareas, proyectos y productividad requieren conectores específicos. No se simula una conexión inexistente.</p><button type="button" class="button secondary" id="control-backups">Copias cifradas</button> <button type="button" class="button secondary" id="control-settings">Otros ajustes</button></article></section>';
const $=id=>document.getElementById(id);
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const chat=$('rumbo-chatgpt-sync');if(chat){$('control-chat-host').append(chat);const old=$('rumbo-settings-chatgpt');if(old)old.hidden=true;}
const agenda=window.RumboAgenda?.controls();if(agenda)$('control-agenda-host').append(agenda);const agendaRefresh=window.RumboAgenda?.refreshControl?.();if(agendaRefresh)$('control-agenda-host').append(agendaRefresh);
const auto=$('control-auto'),cloud=$('control-obs-cloud');auto.checked=Boolean(window.RumboObservatory?.automatic());cloud.checked=Boolean(window.RumboObservatory?.cloudEnabled?.());cloud.disabled=!window.RumboObservatory?.setCloud;
auto.addEventListener('change',()=>{window.RumboObservatory?.setAutomatic(auto.checked);render();});
const cloudForm=$('control-cloud-form'),cloudPass=$('control-cloud-pass'),cloudMessage=$('control-cloud-message');
cloud.addEventListener('change',async()=>{if(cloud.checked){cloudForm.hidden=false;cloudPass.focus();}else{cloudForm.hidden=true;cloudPass.value='';await window.RumboObservatory?.setCloud?.(false);cloudMessage.textContent='Conexión desactivada en este dispositivo; las copias cifradas existentes se conservan.';render();}});
cloudForm.addEventListener('submit',async e=>{e.preventDefault();const phrase=cloudPass.value;cloudPass.value='';const button=cloudForm.querySelector('button');button.disabled=true;try{await window.RumboObservatory.cloudConnect(phrase);cloudForm.hidden=true;cloud.checked=window.RumboObservatory.cloudEnabled();cloudMessage.textContent=window.RumboObservatory.cloudStatus().error?'Conexión preparada, pero todavía no confirmada por el servidor.':'Conexión configurada en este dispositivo.';}catch(err){cloudMessage.textContent=err.message;cloud.checked=window.RumboObservatory.cloudEnabled();}finally{button.disabled=false;render();}});
window.addEventListener('rumbo:route-changed',e=>{if(e.detail?.route!=='panel-control'){cloudPass.value='';cloudForm.hidden=true;cloud.checked=Boolean(window.RumboObservatory?.cloudEnabled?.());}});
$('control-backups').onclick=()=>window.RumboNavigation?.go('copias-rumbo');
$('control-settings').onclick=()=>window.RumboSettings?.open();
const format=t=>t?new Date(t).toLocaleString('es-ES',{timeZone:'Europe/Madrid',dateStyle:'short',timeStyle:'short'}):'Sin comprobación confirmada';
const state={running:false,last:0,diarySuccess:0,diaryError:false};
const sources=[
 {name:'Acceso privado',desc:'Autenticación y sesión recordada',status:()=>({connected:Boolean(window.RumboSession?.available())}),action:'Gestionar acceso',click:()=>$('rumbo-access-open')?.click()},
 {name:'ChatGPT · diario privado',desc:'Recepción desde el servidor privado',status:()=>({connected:Boolean(window.RumboSession?.available()),lastSuccess:state.diarySuccess,error:state.diaryError}),action:'Gestionar acceso',click:()=>$('rumbo-access-open')?.click()},
 {name:'ChatGPT · vínculo anterior',desc:'Bandeja cifrada histórica',status:()=>window.RumboChatInbox?.status(),action:'Configurar',click:()=>{$('control-chat-details').open=true;$('control-chat-details').scrollIntoView({block:'nearest'});}},
 {name:'Historial recuperado',desc:'Copia cifrada entre dispositivos',status:()=>window.RumboHistoryCloud?.status(),action:'Gestionar acceso',click:()=>$('rumbo-access-open')?.click()},
 {name:'Observatorio emocional',desc:'Clasificación y actualización de gráficas',status:()=>window.RumboObservatory?.status(),action:'Abrir bóveda',click:()=>window.RumboNavigation?.go('observatorio-personal')},
 {name:'Resultados del Observatorio',desc:'Copia cifrada entre dispositivos',status:()=>window.RumboObservatory?.cloudStatus?.(),action:'Configurar',click:()=>cloud.focus()},
 {name:'Google Calendar',desc:'Agenda de los próximos siete días',status:()=>window.RumboAgenda?.status(),action:'Configurar',click:()=>{$('control-calendar').scrollIntoView({block:'nearest'});if(agenda)agenda.open=true;}},
 {name:'Favoritos de oposiciones',desc:'Estrellas compartidas entre dispositivos',status:()=>window.RumboFavoritesCloud?.status(),action:'Gestionar acceso',click:()=>$('rumbo-access-open')?.click()}
];
const list=$('control-sources'),cards=sources.map(x=>{const card=make('article','control-card'),title=make('h3','',x.name),desc=make('p','',x.desc),tag=make('strong','control-tag'),last=make('small',''),button=make('button','button secondary',x.action);button.type='button';button.onclick=x.click;card.append(title,desc,tag,last,button);list.append(card);return {x,tag,last};});
function render(){
 if(cloudForm.hidden)cloud.checked=Boolean(window.RumboObservatory?.cloudEnabled?.());
 auto.checked=Boolean(window.RumboObservatory?.automatic());
 $('control-retry').disabled=state.running;
 $('control-overview').textContent=!navigator.onLine?'Sin conexión. Se reintentará al recuperar Internet.':state.running?'Comprobando fuentes…':'Comprobaciones automáticas activas · '+format(state.last);
 for(const {x,tag,last} of cards){const s=x.status?.();let text=!s?'No disponible':!s.connected?'Sin conexión configurada':s.pending?'Actualizando…':s.error?'Revisar conexión':s.automatic===false?'Automatización desactivada':s.lastSuccess?'Actualizado':'Conectado, por verificar';
 if(x.name==='Acceso privado'&&s?.connected)text='Sesión abierta';tag.textContent=text;tag.dataset.state=s?.error?'error':s?.connected&&s.lastSuccess?'ok':'neutral';last.textContent=s?.lastSuccess?'Última confirmación: '+format(s.lastSuccess):'';
 }
}
async function cycle(force=false){
 if(state.running||!navigator.onLine||(!force&&document.hidden))return;
 if(!force&&Date.now()-state.last<60000)return;
 state.running=true;render();
 try{
 const jobs=[];
 const session=window.RumboSession?.available();
 if(session&&window.RumboPrivateSpace?.refreshForObservatory)jobs.push((async()=>{try{const notes=await window.RumboPrivateSpace.refreshForObservatory();state.diaryError=!notes;if(notes)state.diarySuccess=Date.now();}catch{state.diaryError=true;}})());
 for(const api of [window.RumboChatInbox,window.RumboHistoryCloud,window.RumboFavoritesCloud,window.RumboAgenda]){const s=api?.status?.();if(s?.connected&&!s.pending&&(force||!s.lastSuccess||Date.now()-s.lastSuccess>=300000))jobs.push(Promise.resolve().then(()=>api.sync()));}
 await Promise.allSettled(jobs);
 if(window.RumboObservatory?.available()){await window.RumboObservatory.cloudSync?.();await window.RumboObservatory.sync?.();}
 }finally{state.running=false;state.last=Date.now();render();}
}
$('control-retry').onclick=()=>void cycle(true);
window.RumboSession?.subscribe(()=>{render();void cycle(true);});
window.addEventListener('online',()=>void cycle(true));window.addEventListener('offline',render);window.addEventListener('focus',()=>void cycle());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void cycle();});
window.addEventListener('rumbo:route-changed',e=>{if(e.detail?.route==='panel-control'){render();void cycle();}});
let saveTimer;window.addEventListener('rumbo:observatorio-guardado',()=>{render();clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(!document.hidden)void window.RumboObservatory?.cloudSync?.();},1500);});
window.addEventListener('rumbo:observatorio-sync-state',render);
setInterval(()=>{render();if(!document.hidden)void cycle();},300000);
render();void cycle(true);
})();