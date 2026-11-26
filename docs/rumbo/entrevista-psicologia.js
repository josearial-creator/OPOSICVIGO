/* Entrevista experimental local. No envía ni almacena texto. */
(function(root){'use strict';
/* Planificador experimental: el estado debe ser revisado, no inferido de forma automática. */
const QUESTIONS=[
  {
    "id": "situacion",
    "text": "¿Qué ocurrió justo antes de que apareciera esa dificultad?"
  },
  {
    "id": "interpretacion",
    "text": "¿Qué significado le diste a lo ocurrido en ese momento?"
  },
  {
    "id": "emocion",
    "text": "¿Qué sentiste en ese momento, si puedes identificarlo?"
  },
  {
    "id": "conducta",
    "text": "¿Qué hiciste después?"
  },
  {
    "id": "consecuencia",
    "text": "¿Qué efecto tuvo esa respuesta en lo que querías hacer?"
  },
  {
    "id": "evidencia",
    "text": "¿Qué hechos apoyan esa interpretación y qué información falta?"
  },
  {
    "id": "alternativa",
    "text": "¿Hay otra explicación que encaje con lo que sabes, aunque no puedas decidir entre ellas?"
  },
  {
    "id": "recursos",
    "text": "¿Hubo algo que te ayudara a manejar esa situación?"
  },
  {
    "id": "objetivo",
    "text": "¿Qué cambio concreto te gustaría conseguir en una situación similar?"
  }
];
function nextQuestion(state){
 if(!state||state.consent!==true)return {status:"detenido",reason:"sin autorización"};
 if(state.stop===true||state.overload===true||state.repeatedChecking===true)return {status:"detenido",reason:"respetar el límite; no continuar comprobando"};
 if(state.safetyConcern===true)return {status:"derivar",reason:"interrumpir análisis; priorizar apoyo humano adecuado"};
 const allowed=new Set(QUESTIONS.map(q=>q.id)), asked=state.asked??[], known=state.known??[], skipped=state.skipped??[];
 if(![asked,known,skipped].every(a=>Array.isArray(a)&&a.length<=QUESTIONS.length&&a.every(x=>allowed.has(x))))throw Error("Estado de entrevista inválido");
 if(new Set(asked).size!==asked.length)throw Error("Preguntas repetidas en historial");
 if(asked.length>=4)return {status:"resumen",reason:"límite de cuatro preguntas por revisión"};
 const used=new Set([...asked,...known,...skipped]);
 // Primero hechos y funcionamiento; contraste solo si el usuario quiere explorar una interpretación.
 const candidate=QUESTIONS.find(q=>!used.has(q.id)&&(!["evidencia","alternativa"].includes(q.id)||state.exploreInterpretation===true));
 if(!candidate)return {status:"resumen",reason:"sin lagunas adicionales prioritarias"};
 return {status:"pregunta",...candidate};
}



function mount(root,{isOpen,transfer}){
 if(!root||typeof isOpen!=='function'||typeof transfer!=='function')return {reset(){}};
 const $=id=>root.querySelector('[data-field="'+id+'"]');
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 const button=(text,fn)=>{const el=node('button',text);el.type='button';el.className='button secondary';el.addEventListener('click',fn);return el;};
 let state=null,context='',answers=[],current=null;
 const intro=$('intro'),active=$('active'),summary=$('summary'),notice=$('notice'),input=$('answer'),initial=$('context'),result=$('result'),known=$('known');
 const knownLabels={situacion:'Situación',interpretacion:'Interpretación',emocion:'Emoción',conducta:'Conducta',consecuencia:'Consecuencia',evidencia:'Evidencias',alternativa:'Alternativas',recursos:'Recursos',objetivo:'Objetivo'};
 for(const q of QUESTIONS){const label=node('label'),check=node('input');check.type='checkbox';check.value=q.id;label.append(check,document.createTextNode(' '+knownLabels[q.id]));known.append(label);}
 function clear(){
  state=null;context='';answers=[];current=null;initial.value='';input.value='';result.value='';$('question').textContent='';notice.textContent='';
  $('contrast').checked=false;for(const c of known.querySelectorAll('input'))c.checked=false;
  intro.hidden=false;active.hidden=true;summary.hidden=true;
 }
 function stop(){clear();if(isOpen())notice.textContent='Revisión cerrada sin guardar. Puedes continuar con tu día.';}
 function finish(){
  if(!isOpen()){clear();return;}
  input.value='';current=null;active.hidden=true;intro.hidden=true;summary.hidden=false;
  result.value=[context,...answers.map(a=>a.text)].filter(Boolean).join('\n\n');
  notice.textContent='Revisa el texto. No se han guardado observaciones ni asignado puntuaciones.';
 }
 function advance(){
  if(!isOpen()){clear();return;}
  const next=nextQuestion(state);
  if(next.status==='resumen'){finish();return;}
  if(next.status!=='pregunta'){stop();return;}
  current=next;state.asked.push(next.id);
  $('question').textContent=next.text;notice.textContent='Pregunta '+state.asked.length+' de un máximo de 4.';
  input.value='';input.focus();
 }
 function submit(skip){
  if(!isOpen()||!state||!current)return;
  const value=input.value.trim();
  if(!skip&&!value){notice.textContent='Puedes responder, pasar la pregunta o finalizar.';return;}
  if(!skip){answers.push({id:current.id,text:value.slice(0,600)});state.known.push(current.id);}
  else state.skipped.push(current.id);
  advance();
 }
 $('start').addEventListener('click',()=>{
  if(!isOpen()||state)return;
  context=initial.value.trim().slice(0,2400);
  if(!context){notice.textContent='Describe brevemente una situación que quieras explorar.';return;}
  state={consent:true,asked:[],known:[...known.querySelectorAll('input:checked')].map(c=>c.value),skipped:[],exploreInterpretation:$('contrast').checked};
  answers=[];initial.value='';intro.hidden=true;active.hidden=false;advance();
 });
 $('next').addEventListener('click',()=>submit(false));
 $('skip').addEventListener('click',()=>submit(true));
 $('finish').addEventListener('click',()=>{
  if(!state||!isOpen())return;
  const value=input.value.trim();if(current&&value)answers.push({id:current.id,text:value.slice(0,600)});
  finish();
 });
 for(const el of root.querySelectorAll('[data-stop]'))el.addEventListener('click',stop);
 $('transfer').addEventListener('click',()=>{
  if(!isOpen()||!state||summary.hidden)return;
  const value=result.value.trim();
  if(!value){notice.textContent='No hay texto para trasladar.';return;}
  if(transfer(value.slice(0,6000))){clear();notice.textContent='Texto trasladado al clasificador. Revisa sus propuestas antes de guardar.';}
 });
 clear();return {reset:clear};
}

const api={nextQuestion,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RumboInterview=api;
})(typeof globalThis==='object'?globalThis:this);
