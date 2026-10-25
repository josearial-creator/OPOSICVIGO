(() => {
'use strict';
let token='',consent=false,voiceConsent=false,lastReply='',busy=false,recognizer=null;
let endpoint='https://rumbo-entrenador.jose-arial.workers.dev';try{endpoint=localStorage.getItem('rumbo-ai-endpoint')||endpoint;}catch{}
const el=(tag,text)=>{const x=document.createElement(tag);if(text)x.textContent=text;return x;};
const button=(text,fn)=>{const b=el('button',text);b.type='button';b.className='button secondary';b.onclick=fn;return b;};
window.RumboAI={mount(box,d,skills,prompt){
 if(recognizer){recognizer.abort();recognizer=null;}window.speechSynthesis?.cancel();
 const panel=el('details'),summary=el('summary','Conexión de IA y voz · opcional');panel.append(summary);
 const explanation=el('p','Gemini requiere un backend privado configurado en Workers Free y un proyecto sin facturación. La clave Gemini nunca se introduce aquí. Sin conexión real, el entrenamiento sigue siendo manual.');panel.append(explanation);
 const urlLabel=el('label','URL HTTPS del Worker'),url=el('input');url.type='url';url.value=endpoint;url.placeholder='https://rumbo-entrenador.tu-cuenta.workers.dev';urlLabel.append(url);
 const accessLabel=el('label','Contraseña privada de Rumbo (no es la clave Gemini)'),access=el('input');access.type='password';access.autocomplete='off';access.value=token;accessLabel.append(access);
 const checkLabel=el('label'),check=el('input');check.type='checkbox';check.checked=consent;checkLabel.append(check,document.createTextNode(' Consiento enviar mi respuesta y hasta seis mensajes de esta sesión a Gemini. En la modalidad gratuita, Google puede usar el contenido para mejorar sus servicios. No enviar información sensible o identificativa.'));
 const voiceLabel=el('label'),voiceCheck=el('input');voiceCheck.type='checkbox';voiceCheck.checked=voiceConsent;voiceLabel.append(voiceCheck,document.createTextNode(' Acepto que el reconocimiento de voz de mi navegador puede enviar audio a su proveedor. La transcripción será editable y no se enviará a Gemini hasta pulsar Evaluar.'));
 const status=el('p','IA no verificada. La conexión solo se comprueba al solicitar una evaluación.');status.setAttribute('role','status');
 panel.append(urlLabel,accessLabel,checkLabel,voiceLabel,button('Guardar conexión para esta sesión',()=>{try{const parsed=new URL(url.value);if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/')throw Error();endpoint=parsed.origin;token=access.value;consent=check.checked;voiceConsent=voiceCheck.checked;try{localStorage.setItem('rumbo-ai-endpoint',endpoint);}catch{}status.textContent='Configuración guardada. No se ha comprobado el servicio. La contraseña permanece solo en memoria.';}catch{status.textContent='Introduce únicamente el origen HTTPS del Worker, sin rutas ni parámetros.';}}),button('Desconectar',()=>{token='';consent=false;voiceConsent=false;access.value='';check.checked=false;voiceCheck.checked=false;window.speechSynthesis?.cancel();if(recognizer)recognizer.abort();status.textContent='Desconectado. No se ha borrado ningún historial.';}),status);
 box.prepend(panel);
 if(!d)return;
 const form=box.querySelector('#ev-exercise'),text=form?.elements.response;
 if(text){
 const controls=el('div');controls.className='ev-toolbar';const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 controls.append(button('Dictar respuesta',()=>{if(!voiceConsent){status.textContent='Revisa y guarda primero el consentimiento de voz.';panel.open=true;return;}if(!Recognition){status.textContent='Este navegador no ofrece transcripción. Escribe tu respuesta.';panel.open=true;return;}if(recognizer){recognizer.stop();return;}const r=new Recognition();recognizer=r;r.lang='es-ES';r.continuous=false;r.interimResults=false;status.textContent='Micrófono activo: pulsa Detener dictado cuando termines.';panel.open=true;r.onresult=e=>{const transcript=Array.from(e.results).filter(x=>x.isFinal).map(x=>x[0].transcript).join(' ');text.value=(text.value+' '+transcript).trim().slice(0,12000);text.dispatchEvent(new Event('input',{bubbles:true}));status.textContent='Transcripción lista. Revísala antes de continuar.';};r.onerror=()=>{status.textContent='No se pudo transcribir o se denegó el micrófono. Puedes escribir.';};r.onend=()=>{recognizer=null;};try{r.start();}catch{recognizer=null;status.textContent='No se pudo iniciar el micrófono.';}}),button('Detener dictado',()=>recognizer?.stop()));text.after(controls);
 }
 if(d.step==='review'){
 const evaluate=button('Evaluar esta respuesta con Gemini',async()=>{if(busy)return;if(!endpoint||!token||!consent){panel.open=true;status.textContent='Configura la conexión y el consentimiento antes de enviar.';return;}if(d.response.length>4000){status.textContent='Gemini admite hasta 4000 caracteres. Continúa con revisión manual.';panel.open=true;return;}busy=true;evaluate.disabled=true;panel.open=true;status.textContent='Consultando Gemini…';try{
 const res=await fetch(endpoint+'/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Rumbo '+btoa(String.fromCharCode(...new TextEncoder().encode(token)))},signal:AbortSignal.timeout(30000),body:JSON.stringify({scenario:prompt,skill:skills[d.skill][0],criteria:skills[d.skill].slice(1),response:d.response,history:(d.aiConversation||[]).slice(-6).map(x=>({role:x.role,text:x.text.slice(0,3000)}))})});
 const result=await res.json();if(!res.ok)throw Error(result.error||'Servicio no disponible');if(typeof result.evaluable!=='boolean'||!Array.isArray(result.criteria)||result.criteria.length!==2||!['positive','improve','alternative','practice','reply'].every(k=>typeof result[k]==='string'&&result[k].length<=5000)||!result.criteria.every(v=>result.evaluable?Number.isInteger(v)&&v>=0&&v<=4:v===null))throw Error('Respuesta de IA inválida');
 if(!result.evaluable){status.textContent='Gemini no encontró evidencia suficiente para puntuar: '+result.reply;return;}
 ['positive','improve','alternative','practice'].forEach(k=>form.elements[k].value=result[k]);result.criteria.forEach((v,i)=>form.elements['criterion'+i].value=String(v));
 d.aiEvaluation={provider:'Gemini',model:'gemini-3.5-flash-lite',suggestedCriteria:result.criteria,reply:result.reply};d.aiConversation=[...(d.aiConversation||[]),{role:'user',text:d.response},{role:'model',text:result.reply}].slice(-6);lastReply=result.reply;
 form.dispatchEvent(new Event('input',{bubbles:true}));status.textContent='Evaluación recibida de Gemini. Revisa los campos y guarda para incorporarla al historial. Siguiente reto: '+result.reply;
 }catch(err){status.textContent='No se obtuvo evaluación de IA: '+err.message+'. Los campos manuales se mantienen.';}finally{busy=false;evaluate.disabled=false;}});
 form.prepend(evaluate);
 }
 const spoken=el('div');spoken.className='ev-toolbar';spoken.append(button('Escuchar situación / siguiente reto',()=>{if(!('speechSynthesis'in window)){status.textContent='Voz de lectura no disponible.';return;}speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(d.followup||prompt);utterance.lang='es-ES';speechSynthesis.speak(utterance);}),button('Detener lectura',()=>window.speechSynthesis?.cancel()));box.append(spoken);
 if(d.step==='feedback'&&d.exercises.at(-1)?.ai?.reply){lastReply=d.exercises.at(-1).ai.reply;const follow=el('p','Gemini propone: '+lastReply);box.append(follow);}
}};
})();
