/* Motor local de reglas contextuales; no es un modelo clínico validado. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RumboPsychEngine=api;
})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const VERSION='reglas-contextuales-1.0';
/* Etiquetas de lo referido, no valencia clínica ni puntuación. */
const RULES=[
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

const RATED=[['ansiedad','ansiedad'],['urgencia','urgencia(?: por terminar)?'],['rumiacion','rumiaci[oó]n'],['frustracion','frustraci[oó]n'],['incertidumbre','incertidumbre']];
for(const [dimension,label] of RATED){
 const start='^\\s*(?:hoy\\s*:?\\s*|mi\\s+)?'+label+'\\s*(?::|=|de)?\\s*';
 const end='(?=\\s*(?:[.!;,]|$))';
 RULES.push([dimension,'ausencia referida','emoción',new RegExp(start+'0\\s*(?:/|sobre\\s+)(?:10|4)'+end,'iu')]);
 RULES.push([dimension,'dificultad','emoción',new RegExp(start+'(?:(?:10|[1-9])\\s*(?:/|sobre\\s+)10|[1-4]\\s*(?:/|sobre\\s+)4)'+end,'iu')]);
}
const IMPACT=[
 ['ansiedad',/\b(?:por la ansiedad (?:no pude (?:trabajar|estudiar|salir|dormir)|dej[eé] de (?:trabajar|estudiar|salir))|la ansiedad me impidi[oó] (?:trabajar|estudiar|salir|dormir))\b/iu],
 ['urgencia',/\b(?:por la urgencia (?:no pude (?:trabajar|estudiar|descansar)|dej[eé] de (?:trabajar|estudiar|descansar))|la urgencia me impidi[oó] (?:trabajar|estudiar|descansar))\b/iu],
 ['atencion',/\b(?:por distraerme (?:no pude terminar|dej[eé] sin terminar)|por no concentrarme no pude (?:estudiar|trabajar|terminar))\b/iu]
];
for(const [dimension,re] of IMPACT)RULES.push([dimension,'dificultad','funcionamiento',re]);
const INTENSITY=[
 ['ansiedad',/\b(?:tengo (?:mucha|poca) ansiedad|tengo ansiedad (?:muy intensa|leve|moderada|intensa))\b/iu],
 ['urgencia',/\b(?:siento (?:mucha|poca) urgencia(?: por terminar)?|siento una urgencia (?:muy intensa|leve|moderada|intensa))\b/iu]
];
for(const [dimension,re] of INTENSITY)RULES.push([dimension,'dificultad','emoción',re]);
function declaredRating(hit){
 const match=hit?.match?.trim().match(/(?:^|\s|:|=)(\d{1,2})\s*(?:\/|sobre\s+)(10|4)$/iu);
 if(!match||!RATED.some(([id])=>id===hit.dimension))return null;
 const value=Number(match[1]),max=Number(match[2]);return value<=max?{value,max}:null;
}
function evidenceAssessment(hit){
 if(!hit||!['malestar','dificultad','recurso','ausencia referida','mixto'].includes(hit.direction)||typeof hit.match!=='string'||!hit.match.trim())return null;
 if(hit.direction==='mixto')return {level:null,rating:null,reason:'Expresiones contrapuestas; conservar ambas sin resumirlas en una intensidad.'};
 const rating=declaredRating(hit);
 const other=hit.additionalEvidence?declaredRating({...hit,match:hit.additionalEvidence.match}):null;
 if(rating&&other&&(rating.value!==other.value||rating.max!==other.max))return {level:2,rating:null,reason:'Puntuaciones declaradas diferentes; no seleccionar una arbitrariamente.'};
 if(IMPACT.some(([id,re])=>id===hit.dimension&&re.test(hit.match)))return {level:3,rating:null,reason:'Consecuencia funcional vinculada explícitamente en la frase.'};
 if(rating||INTENSITY.some(([id,re])=>id===hit.dimension&&re.test(hit.match)))return {level:2,rating,reason:rating?'Puntuación declarada en el texto; escala original.':'Magnitud descrita expresamente, sin convertirla a un número.'};
 if(hit.kind==='conducta'&&/\b(?:he (?:conseguido|logrado|vuelto|retomado|evitado|salido|hecho)|consegu[ií]|cambi[eé]|me contuve|actu[eé]|no he (?:conseguido|logrado|hecho))\b/iu.test(hit.match))return {level:2,rating:null,reason:'Conducta o resultado concreto referido.'};
 return {level:1,rating:null,reason:'Estado o dificultad/recurso expresado; magnitud no establecida.'};
}

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
function uniqueByDimension(input){
 const grouped=new Map();
 for(const hit of analyze(input).observations){
  const old=grouped.get(hit.dimension);
  if(!old){grouped.set(hit.dimension,hit);continue;}
  if(old.direction===hit.direction&&old.direction!=='mixto'){
   const before=evidenceAssessment(old),after=evidenceAssessment(hit),a=declaredRating(old),b=declaredRating(hit);
   if(a&&b&&(a.value!==b.value||a.max!==b.max)){grouped.set(hit.dimension,{...old,additionalEvidence:{index:hit.index,end:hit.end,match:hit.match}});continue;}
   if(old.additionalEvidence)continue;
   if((b&&!a)||(!a&&!b&&(after?.level||0)>(before?.level||0)))grouped.set(hit.dimension,hit);
   continue;
  }
  if(old.direction!==hit.direction&&old.direction!=='mixto'){
   // Mantener ambas expresiones; nunca elegir arbitrariamente una.
   grouped.set(hit.dimension,{...old,direction:'mixto',additionalEvidence:{index:hit.index,end:hit.end,match:hit.match}});
  }
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
return Object.freeze({VERSION,ASSESSMENT_VERSION:'evidencia-1.0',analyze,uniqueByDimension,patterns,evidenceAssessment});
});
