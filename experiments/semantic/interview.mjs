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
export {nextQuestion};
