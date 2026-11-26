/* Coordinación local de reglas, contrato semántico y entrevista; no IA generativa. */
(function(root){'use strict';
function inspect(text,engine,verifier){
 if(typeof text!=='string'||!engine?.analyze||!verifier?.validate)return {hints:[],proposals:[]};
 const source=text.slice(0,2400);
 if(!source.trim())return {hints:[],proposals:[]};
 const mapped={"emoción":"emocion","pensamiento":"pensamiento","conducta":"conducta","funcionamiento":"consecuencia funcional"};
 const field={emocion:"emocion",pensamiento:"interpretacion",conducta:"conducta","consecuencia funcional":"consecuencia"};
 const raw=[];
 for(const hit of engine.analyze(source).observations.slice(0,40)){
  if(!mapped[hit.kind]||source.slice(hit.index,hit.end)!==hit.match||hit.temporal==="pasado referido")continue;
  raw.push({dimension:hit.dimension,direction:hit.direction==="malestar"?"dificultad":hit.direction,kind:mapped[hit.kind],temporal:hit.temporal==="hoy referido"?"actual referido":"sin fecha precisa",basis:"explicito",evidence:[{messageId:"u1",quote:hit.match}],counterevidence:[],alternative:null});
 }
 const result=verifier.validate([{id:"u1",role:"user",text:source}],{observations:raw});
 const seen=new Set(),hints=[];
 for(const p of result.accepted){
  const id=field[p.kind];if(!id||seen.has(id))continue;
  seen.add(id);hints.push({field:id,quote:p.evidence[0].quote});
 }
 return {hints,proposals:result.accepted.map(p=>({...p,method:"reglas-contextuales-verificadas-1.0"}))};
}
const api={inspect:(text,engine,verifier)=>inspect(text,engine,verifier??root.RumboSemanticEvidence)};if(typeof module==='object'&&module.exports)module.exports=api;else root.RumboPsychCoordinator=api;
})(typeof globalThis==='object'?globalThis:this);
