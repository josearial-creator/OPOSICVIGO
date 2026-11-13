const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../docs/rumbo/app.js'),'utf8');
function harness(seed){
 let raw=seed===undefined?null:JSON.stringify(seed),feed=[],blocked=false;const elements={};
 const c=vm.createContext({window:{addEventListener(){}},document:{getElementById:id=>elements[id]??={}},localStorage:{getItem:()=>raw,setItem:(k,v)=>{if(blocked)throw Error('quota');raw=v;}},fetch:async()=>({ok:true,json:async()=>feed})});
 vm.runInContext(source+'\nrender=()=>{};loadSaved();',c);
 return {run:s=>vm.runInContext(s,c),get raw(){return raw},set raw(v){raw=v},set feed(v){feed=v},set blocked(v){blocked=v}};
}
(async()=>{
 const r={puesto:'Auxiliar',organismo:'Vigo',plazas:1,convocatoria_id:'exp-1',estado:'En fase de presentación de solicitudes',fin:'2099-01-01'};
 const h=harness({records:[r],favorites:['vigo¦auxiliar¦¦¦1¦'],notes:{'vigo¦auxiliar¦¦¦1¦':'Nota'},previousKeys:[]});
 h.feed=[{...r,plazas:2}];await h.run('loadRemote()');assert.equal(h.run('state.records.length'),1);assert.equal(h.run('state.records[0].plazas'),2);assert.equal(h.run('state.notes[recordKey(state.records[0])]'),'Nota');assert(h.run('state.favorites.has(recordKey(state.records[0]))'));
 h.feed=[{puesto:'Otra'}];await h.run('loadRemote()');assert.equal(h.run('statusType(state.records[0])'),'verificar');assert.match(h.run('historicalDate(state.records[0],state.records[0].fin)'),/Histórico/);
 const saved=h.raw;h.blocked=true;h.feed=[{puesto:'Sin espacio'}];await h.run('loadRemote()');assert.equal(h.raw,saved);h.blocked=false;
 h.raw=JSON.stringify({...JSON.parse(saved),notes:{other:'Otra pestaña'}});const external=h.raw;await h.run('loadRemote()');assert.equal(h.raw,external);
 // Two legacy records that shared a key must not silently share a personal note after migration.
 const a={puesto:'A',organismo:'Vigo',plazas:1,fuente:'https://example.org/2026'},b={...a,fuente:'https://example.org/2027'};
 const ambiguous=harness({records:[a,b],notes:{'vigo¦a¦¦¦1¦':'Sin asociación inequívoca'},favorites:['vigo¦a¦¦¦1¦']});
 assert.equal(ambiguous.run('state.records.length'),2);assert.equal(ambiguous.run('Object.values(state.notes)[0]'),'Sin asociación inequívoca');assert.equal(ambiguous.run('state.notes[recordKey(state.records[0])]'),undefined);
 const invalid=harness({records:'broken',notes:{original:'No borrar'}});const original=invalid.raw;invalid.feed=[r];await invalid.run('loadRemote()');assert.equal(invalid.raw,original);
 console.log('PASS conservación unitaria: identidad, migración, asociaciones ambiguas, historial, cuota, pestañas y datos inválidos.');
})().catch(e=>{console.error(e);process.exitCode=1;});
