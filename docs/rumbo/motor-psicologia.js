/* Motor local de reglas contextuales; no es un modelo clínico validado. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RumboPsychEngine=api;
})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const VERSION='reglas-contextuales-2.0';
/* Etiquetas de lo referido, no valencia clínica ni puntuación. */
const RULES=[
 ['atencion','dificultad','conducta',/\b(?:no puedo concentrarme|me cuesta mantener la concentraci[oó]n|no consigo mantener el foco|me cuesta seguir rutinas largas|pierdo el foco|me he dispersado)\b/iu],
 ['atencion','recurso','conducta',/\b(?:he mantenido el foco|he podido concentrarme|he estudiado sin distraerme)\b/iu],
 ['animo','malestar','emoción',/\b(?:me siento deca[ií]d[oa]|no tengo ganas de nada|me siento ap[aá]tic[oa]|estoy de baj[oó]n|me siento sin esperanza)\b/iu],
 ['animo','recurso','emoción',/\b(?:me siento m[aá]s animad[oa]|estoy content[oa]|me siento feliz)\b/iu],
 ['ansiedad','malestar','emoción',/\b(?:me siento nervios[oa]|siento ansiedad|estoy muy nervios[oa]|me preocupa constantemente|me siento inquiet[oa]|me siento en tensi[oó]n)\b/iu],
 ['ansiedad','recurso','emoción',/\b(?:me siento tranquil[oa]|estoy tranquil[oa]|me he calmado)\b/iu],
 ['urgencia','dificultad','pensamiento',/\b(?:siento urgencia|tengo prisa por terminar|tengo necesidad de terminar|tengo urgencia)\b/iu],
 ['urgencia','recurso','pensamiento',/\b(?:he tolerado dejarlo pendiente|puedo dejarlo sin terminar|he podido esperar)\b/iu],
 ['autoeficacia','dificultad','pensamiento',/\b(?:no conf[ií]o en m[ií]|me siento incapaz|no me veo capaz|no me siento competente|siento que no puedo hacerlo)\b/iu],
 ['autoeficacia','recurso','pensamiento',/\b(?:me siento competente|sensaci[oó]n de competencia|he confiado en m[ií]|he podido hacerlo|me veo capaz)\b/iu],
 ['disfrute','recurso','emoción',/\b(?:me lo he pasado bien|me ha gustado hacerlo|lo he disfrutado|me siento a gusto)\b/iu],
 ['disfrute','dificultad','emoción',/\b(?:no consigo disfrutar|he perdido el inter[eé]s|nada me apetece)\b/iu],
 ['inhibicion','recurso','conducta',/\b(?:he conseguido parar|he podido parar|me he detenido|he frenado el impulso)\b/iu],
 ['inhibicion','dificultad','conducta',/\b(?:no consigo parar|no he podido parar|no s[eé] parar|me cuesta parar)\b/iu],
 ['flexibilidad','recurso','conducta',/\b(?:he retomado mi tarea|he vuelto a estudiar|he cambiado de actividad|he continuado estudiando)\b/iu],
 ['flexibilidad','dificultad','conducta',/\b(?:me cuesta cambiar de actividad|no he podido cambiar de tarea|me cuesta seguir el plan)\b/iu],
 ['aprobacion','dificultad','pensamiento',/\b(?:necesito (?:la )?aprobaci[oó]n|necesito (?:la )?validaci[oó]n|no me siento querid[oa]|no me siento respetad[oa]|no me siento tenid[oa] en cuenta)\b/iu],
 ['aprobacion','recurso','pensamiento',/\b(?:no necesito la aprobaci[oó]n|me siento respetad[oa]|me siento querid[oa]|me siento tenid[oa] en cuenta)\b/iu],
 ['hiperfoco','dificultad','conducta',/\b(?:no he logrado detener el hiperfoco|me he quedado en hiperfoco|no consigo salir del hiperfoco|me he quedado absort[oa]|me cuesta salir del hiperfoco)\b/iu],
 ['hiperfoco','recurso','conducta',/\b(?:he salido del hiperfoco|he logrado detener el hiperfoco)\b/iu],
 ['autocritica','dificultad','pensamiento',/\b(?:me critico constantemente|me culpo|soy un fracaso|me siento defectuos[oa]|me reprocho)\b/iu],
 ['autocritica','recurso','pensamiento',/\b(?:he sido m[aá]s comprensiv[oa] conmigo|me he tratado con respeto)\b/iu],
 ['incertidumbre','recurso','pensamiento',/\b(?:he tolerado la incertidumbre|he dejado una duda sin resolver|puedo aceptar no saber)\b/iu],
 ['frustracion','recurso','emoción',/\b(?:he tolerado la frustraci[oó]n|he aceptado el error|he soportado la frustraci[oó]n)\b/iu],
 ['evitacion','dificultad','conducta',/\b(?:he pospuesto el estudio|he evitado estudiar|he dejado la tarea prioritaria|he pospuesto la tarea)\b/iu],

 ['animo','malestar','emoción',/\b(?:estoy triste|me siento (?:triste|vac[ií][oa]|desanimad[oa]|hundid[oa])|estoy desanimad[oa]|no tengo [aá]nimo)\b/iu],
 ['animo','recurso','emoción',/\b(?:me siento bien|estoy de buen humor|me siento animad[oa])\b/iu],
 ['ansiedad','malestar','emoción',/\b(?:tengo ansiedad|estoy ansios[oa]|tengo miedo|estoy nervios[oa]|me siento agobiad[oa])\b/iu],
 ['ansiedad','ausencia referida','emoción',/\b(?:no tengo ansiedad|no tengo miedo|no estoy nervios[oa])\b/iu],
 ['frustracion','malestar','emoción',/\b(?:estoy frustrad[oa]|me enfada|siento rabia|me siento frustrad[oa])\b/iu],
 ['disfrute','dificultad','emoción',/\b(?:no disfruto|no me apetece nada|no disfruto de nada|no tengo ganas de nada)\b/iu],
 ['disfrute','recurso','emoción',/\b(?:disfruto|he disfrutado|me he sentido a gusto|me gusta hacerlo)\b/iu],
 ['ilusion','dificultad','emoción',/\b(?:no tengo ilusi[oó]n|no me hace ilusi[oó]n|no estoy ilusionad[oa])\b/iu],
 ['ilusion','recurso','emoción',/\b(?:estoy ilusionad[oa]|tengo ilusi[oó]n|me hace ilusi[oó]n)\b/iu],
 ['indefension','malestar','pensamiento',/\b(?:me siento derrotad[oa]|me siento indefens[oa]|no puedo cambiar nada|siento que no puedo hacer nada)\b/iu],
 ['urgencia','dificultad','pensamiento',/\b(?:necesito resolverlo ya|urgencia por terminar|necesito hacerlo inmediatamente|tengo que terminar ya|me urge terminar|me cuesta dejarlo sin terminar)\b/iu],
 ['rumiacion','dificultad','pensamiento',/\b(?:le doy vueltas|no puedo dejar de pensar|no consigo dejar de pensar|tengo pensamientos repetitivos)\b/iu],
 ['incertidumbre','dificultad','pensamiento',/\b(?:no tolero la incertidumbre|necesito tener certeza|no soporto no saber|necesito estar segur[oa])\b/iu],
 ['atencion','dificultad','conducta',/\b(?:no consigo concentrarme|me cuesta concentrarme|pierdo la atenci[oó]n|me distraigo|me he distra[ií]do)\b/iu],
 ['atencion','recurso','conducta',/\b(?:me he concentrado|he conseguido concentrarme|he logrado concentrarme)\b/iu],
 ['flexibilidad','dificultad','conducta',/\b(?:no consigo cambiar de estrategia|me cuesta cambiar de tarea|no logro cambiar de actividad)\b/iu],
 ['flexibilidad','recurso','conducta',/\b(?:cambi[eé] de estrategia|he vuelto al estudio|he retomado el estudio|he logrado cambiar de tarea)\b/iu],
 ['inhibicion','dificultad','conducta',/\b(?:actu[eé] sin pensar|no he logrado detenerme|no he conseguido detenerme|me cuesta detenerme|no he logrado detener el hiperfoco)\b/iu],
 ['inhibicion','recurso','conducta',/\b(?:consegu[ií] detenerme|he conseguido detenerme|he logrado detenerme|me contuve antes de responder|he logrado parar)\b/iu],
 ['evitacion','dificultad','conducta',/\b(?:estoy evitando|no me atrevo a|he evitado)\b/iu],
 ['presencia','dificultad','conducta',/\b(?:no consigo estar presente|me cuesta estar presente)\b/iu],
 ['presencia','recurso','conducta',/\b(?:estuve presente|he estado presente)\b/iu],
 ['autoestima','malestar','pensamiento',/\b(?:no valgo|me siento in[uú]til|siento que no soy v[aá]lid[oa])\b/iu],
 ['autoestima','recurso','pensamiento',/\b(?:me siento valios[oa]|me valoro)\b/iu],
 ['autoeficacia','dificultad','pensamiento',/\b(?:no soy capaz de|no me siento capaz de|no conf[ií]o en mi capacidad)\b/iu],
 ['autoeficacia','recurso','pensamiento',/\b(?:soy capaz de|conf[ií]o en mi capacidad|me siento capaz de)\b/iu],
 ['control','dificultad','pensamiento',/\b(?:he perdido el control|siento que no controlo)\b/iu],
 ['control','recurso','pensamiento',/\b(?:siento que controlo|puedo decidir)\b/iu],
 ['trabajo','dificultad','funcionamiento',/\b(?:el trabajo me afecta|tengo problemas laborales|me cuesta trabajar)\b/iu],
 ['familia','dificultad','funcionamiento',/\b(?:no dedico tiempo a mi familia|me cuesta atender a mis hijos)\b/iu],
 ['familia','recurso','funcionamiento',/\b(?:he disfrutado con mis hijos|disfruto con mis hijos)\b/iu],
 ['autocuidado','dificultad','conducta',/\b(?:duermo mal|he dormido mal|no he hecho deporte)\b/iu],
 ['autocuidado','recurso','conducta',/\b(?:he dormido bien|he salido a correr|he hecho deporte)\b/iu]
];
function analyze(input){
 if(typeof input!=='string')return {observations:[],abstained:0};
 const text=input.slice(0,12000),observations=[];let abstained=0;
 // Segmentación conservadora: se conserva el contexto de cada frase. Las citas y
 // preguntas se omiten enteras; una negación explícita nunca se convierte en cero.
 const sentences=text.matchAll(/[^.!?;\n]+[.!?;]?/gu);
 for(const m of sentences){
  const sentence=m[0];
  if(!RULES.some(r=>r[3].test(sentence)))continue;
  if(/[?¿"'«»“”‘’]/u.test(sentence)||/\b(?:dice|dijo|dec[ií]a|seg[uú]n|me dicen|me dijeron|mi (?:hijo|hija|mujer|marido|amigo|amiga|m[eé]dico|psic[oó]loga|psiquiatra) (?:dice|dijo|tiene|est[aá])|si|ojal[aá]|quiz[aá]s?|tal vez|puede que|imagina|supongamos|no es verdad que|es falso que|ir[oó]nicamente|por ejemplo)\b/iu.test(sentence)){abstained++;continue;}
  for(const part of sentence.matchAll(/(?:^|,\s*|\bpero\s+|\baunque\s+|\bsin embargo\s+)([^,]+?)(?=,|\bpero\s+|\baunque\s+|\bsin embargo\s+|$)/giu)){
   const clause=part[1],base=m.index+part.index+part[0].indexOf(clause);
   const hits=[];
   for(const [dimension,direction,kind,re] of RULES){
    const match=re.exec(clause);if(!match)continue;
    const prefix=clause.slice(0,match.index);
    // Negaciones y atribuciones indirectas que el patrón no contempla.
    if(/\b(?:no|nunca|jam[aá]s|sin|ni|niego|dej[eé] de|ya no)\s+(?:\p{L}+\s+){0,3}$/iu.test(prefix))continue;
    hits.push({dimension,direction,kind,index:base+match.index,end:base+match.index+match[0].length,match:match[0]});
   }
   // Si dos reglas solapan, conservar la expresión más completa.
   hits.sort((a,b)=>(b.end-b.index)-(a.end-a.index)||a.index-b.index);
   const kept=[];
   for(const h of hits){
    if(kept.some(k=>k.dimension===h.dimension&&h.index<k.end&&h.end>k.index))continue;
    kept.push(h);
   }
   if(!kept.length&&RULES.some(r=>r[3].test(clause)))abstained++;
   for(const h of kept){
    const temporal=/\b(?:ma[ñn]ana|en el futuro|alg[uú]n d[ií]a|cuando consiga)\b/iu.test(clause)?'futuro':/\b(?:ayer|antes|hace \d+|la semana pasada|el a[ñn]o pasado)\b/iu.test(clause)?'pasado referido':/\bhoy\b/iu.test(clause)?'hoy referido':'no especificado';
    if(temporal==='futuro'){abstained++;continue;}
    const evidence=text.slice(Math.max(base,h.index-65),Math.min(base+clause.length,h.end+65));
    observations.push({...h,evidence,temporal,method:VERSION});
   }
  }
 }
 return {observations,abstained};
}
// Solo vincular cifras a una dimensión nombrada expresamente.
function explicitScores(input){
 if(typeof input!=='string')return [];
 const aliases={animo:'(?:estado de [aá]nimo|[aá]nimo)',ansiedad:'ansiedad',urgencia:'urgencia(?: por terminar)?',atencion:'(?:atenci[oó]n|concentraci[oó]n)',autoeficacia:'(?:autoeficacia|sensaci[oó]n de competencia)',disfrute:'disfrute',frustracion:'frustraci[oó]n',rumiacion:'rumiaci[oó]n',inhibicion:'(?:control inhibitorio|capacidad de parar)',incertidumbre:'(?:tolerancia a la incertidumbre|incertidumbre)'};
 const out=[];
 for(const [dimension,alias] of Object.entries(aliases)){
  const re=new RegExp('\\b'+alias+'\\s*(?::|=|de|fue|es)?\\s*(\\d{1,2})(?:[.,](\\d))?\\s*(?:/|sobre|de)\\s*(10|4)\\b','giu');
  for(const h of input.slice(0,12000).matchAll(re)){
   const prefix=input.slice(0,h.index),start=Math.max(prefix.lastIndexOf('.'),prefix.lastIndexOf('\n'),prefix.lastIndexOf(';'))+1;
   const context=input.slice(start,h.index+h[0].length+1);
   if(/[?¿"'«»“”]/u.test(context)||/\b(?:ayer|mañana|si|quiz[aá]s?|dice|dijo|antes|no)\b/iu.test(context))continue;
   const value=Number(h[1]+(h[2]?'.'+h[2]:'')),max=Number(h[3]);
   if(value>=0&&value<=max)out.push({dimension,value,max,match:h[0],index:h.index,end:h.index+h[0].length});
  }
 }
 return out;
}
function uniqueByDimension(input){
 const grouped=new Map();
 for(const hit of analyze(input).observations){
  const old=grouped.get(hit.dimension);
  if(!old){grouped.set(hit.dimension,hit);continue;}
  if(old.direction!==hit.direction&&old.direction!=='mixto'){
   // Mantener ambas expresiones; nunca elegir arbitrariamente una.
   grouped.set(hit.dimension,{...old,direction:'mixto',additionalEvidence:{index:hit.index,end:hit.end,match:hit.match}});
  }
 }
 for(const score of explicitScores(input)){
  const old=grouped.get(score.dimension);
  if(old?.scoreConflict)continue;
  if(old?.reportedScore&&(old.reportedScore.value!==score.value||old.reportedScore.max!==score.max)){old.reportedScore=null;old.scoreConflict=true;continue;}
  if(old){old.reportedScore=score;continue;}
  grouped.set(score.dimension,{dimension:score.dimension,direction:'valor declarado',kind:'pensamiento',index:score.index,end:score.end,match:score.match,evidence:score.match,temporal:'no especificado',method:VERSION,reportedScore:score});
 }
 return [...grouped.values()];
}
// Explorar co-menciones por día: no inferir correlación ni ausencia de síntomas.
const PAIRS=[['urgencia','atencion','¿Coinciden las menciones de urgencia y atención?'],['urgencia','inhibicion','¿Qué sucede con la capacidad de parar cuando aparece la urgencia?'],['autoeficacia','animo','¿Cómo se relacionan las menciones de capacidad y estado de ánimo?'],['autocuidado','disfrute','¿Coinciden los registros de autocuidado y disfrute?'],['incertidumbre','rumiacion','¿Coinciden las menciones de incertidumbre y pensamiento repetitivo?']];
function patterns(entries){
 const days=new Map();
 for(const e of entries){
  if(e.source!=='texto'||!e.analysis||e.analysis.temporal==='pasado referido'||e.analysis.dateBasis!=='registro original'||e.analysis.direction==='mixto'||e.analysis.direction==='ausencia referida')continue;
  if(!days.has(e.date))days.set(e.date,new Map());
  const row=days.get(e.date);if(!row.has(e.dimension))row.set(e.dimension,new Set());row.get(e.dimension).add(e.analysis.direction);
 }
 return PAIRS.map(([a,b,question])=>{
  let both=0,onlyA=0,onlyB=0;const examples=[];
  for(const [date,row] of days){
   const hasA=row.has(a),hasB=row.has(b);
   if(hasA&&hasB){both++;examples.push(date);}
   else if(hasA)onlyA++;else if(hasB)onlyB++;
  }
  return {a,b,question,both,onlyA,onlyB,days:days.size,examples:examples.sort().slice(-6)};
 }).filter(x=>x.both>=3);
}
return Object.freeze({VERSION,analyze,uniqueByDimension,explicitScores,patterns});
});
