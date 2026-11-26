/* Validación estructural: una cita literal NO demuestra que la interpretación sea correcta. */
const DIMS=["animo","ansiedad","frustracion","disfrute","ilusion","indefension","urgencia","rumiacion","incertidumbre","atencion","flexibilidad","inhibicion","evitacion","presencia","autoestima","autoeficacia","control","trabajo","familia","autocuidado"];
const DIRECTIONS=["dificultad","recurso","ausencia referida","mixto"];
const KINDS=["emocion","pensamiento","conducta","consecuencia funcional"];
const TEMP=["actual referido","pasado referido","sin fecha precisa"];
function userMessages(messages){
 if(!Array.isArray(messages)||messages.length>50)throw Error("Entrada inválida");
 const out=[],ids=new Set();
 for(const m of messages){
  if(!m||typeof m.id!=="string"||!/^[-a-zA-Z0-9_]{1,64}$/.test(m.id)||ids.has(m.id)||!["user","assistant"].includes(m.role)||typeof m.text!=="string"||m.text.length>12000)throw Error("Mensaje inválido");
  ids.add(m.id);if(m.role==="user"&&m.text.trim())out.push({id:m.id,text:m.text});
 }
 if(out.reduce((n,m)=>n+m.text.length,0)>24000)throw Error("Fragmento demasiado largo");
 return out;
}
function validate(messages,response){
 const sources=new Map(userMessages(messages).map(m=>[m.id,m.text]));
 if(!response||!Array.isArray(response.observations)||response.observations.length>40)throw Error("Formato de propuestas inválido");
 const accepted=[],rejected=[],seen=new Set();
 const exact=(ref)=>{
  if(!ref||typeof ref.messageId!=="string"||typeof ref.quote!=="string"||ref.quote.trim().length<8||ref.quote.length>400)return null;
  const source=sources.get(ref.messageId);if(!source)return null;
  const i=source.indexOf(ref.quote);
  if(i<0||source.indexOf(ref.quote,i+1)>=0)return null;
  return {messageId:ref.messageId,quote:ref.quote,start:i,end:i+ref.quote.length};
 };
 for(const [i,p] of response.observations.entries()){
  const reject=reason=>rejected.push({index:i,reason});
  if(!p||!DIMS.includes(p.dimension)||!DIRECTIONS.includes(p.direction)||!KINDS.includes(p.kind)||!TEMP.includes(p.temporal)||!["explicito","inferencia"].includes(p.basis)){reject("categoría inválida");continue;}
  if(Object.keys(p).some(k=>!["dimension","direction","kind","temporal","basis","evidence","counterevidence","alternative"].includes(k))){reject("campo no autorizado");continue;}
  if(!Array.isArray(p.evidence)||p.evidence.length<1||p.evidence.length>3||!Array.isArray(p.counterevidence)||p.counterevidence.length>3){reject("evidencia inválida");continue;}
  const evidence=p.evidence.map(exact),counterevidence=p.counterevidence.map(exact);
  if(evidence.some(e=>!e)||counterevidence.some(e=>!e)){reject("cita no literal, repetida o de autor no admitido");continue;}
  if(p.direction==="mixto"&&!counterevidence.length){reject("contradicción sin evidencia");continue;}
  if(p.basis==="inferencia"&&(typeof p.alternative!=="string"||p.alternative.trim().length<12||p.alternative.length>300)){reject("inferencia sin alternativa");continue;}
  if(p.alternative!==null&&(typeof p.alternative!=="string"||p.alternative.length>300)){reject("alternativa inválida");continue;}
  const key=JSON.stringify([p.dimension,p.direction,evidence.map(e=>[e.messageId,e.start,e.end]).sort()]);
  if(seen.has(key)){reject("duplicado");continue;}seen.add(key);
  accepted.push({dimension:p.dimension,direction:p.direction,kind:p.kind,temporal:p.temporal,basis:p.basis,evidence,counterevidence,alternative:p.alternative,review:"pendiente",intensity:null,method:"semantico-experimental-1.0"});
 }
 return {accepted,rejected};
}
function metrics(fixtures,results){
 let tp=0,fp=0,fn=0,forbidden=0,rejected=0;
 for(const f of fixtures){
  const r=results[f.id];if(!r)throw Error("Falta resultado de "+f.id);
  const actual=new Set(r.accepted.map(p=>p.dimension+":"+p.direction)),expected=new Set(f.expected);
  for(const k of actual){if(expected.has(k))tp++;else fp++;if(f.forbidden.includes(k))forbidden++;}
  for(const k of expected)if(!actual.has(k))fn++;
  rejected+=r.rejected.length;
 }
 return {fixtures:fixtures.length,tp,fp,fn,forbidden,rejected,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null};
}
export {DIMS,DIRECTIONS,KINDS,TEMP,userMessages,validate,metrics};
