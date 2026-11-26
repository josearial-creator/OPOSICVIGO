import engine from '../../docs/rumbo/motor-psicologia.js';
import {userMessages,metrics} from './validator.mjs';
// Comparación por episodio. La referencia de etiquetas es provisional y no clínica.
export function baseline(fixtures){
 const results={};
 for(const f of fixtures){
  const grouped=new Map();
  for(const m of userMessages(f.messages)){
   for(const p of engine.uniqueByDimension(m.text)){
    const direction=p.direction==='malestar'?'dificultad':p.direction;
    if(!grouped.has(p.dimension))grouped.set(p.dimension,new Set());
    grouped.get(p.dimension).add(direction);
   }
  }
  results[f.id]={accepted:[...grouped].map(([dimension,directions])=>({dimension,direction:directions.size>1?'mixto':[...directions][0]})),rejected:[]};
 }
 return {metrics:metrics(fixtures,results),results};
}
