/* Informes diarios: agrupación y borrador extractivo, sin IA ni red. */
(function(root){'use strict';
function validDay(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
function dateOf(s){if(validDay(s))return s;if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(s)||!/(Z|[+-]\d{2}:\d{2})$/.test(s))return null;const d=new Date(s);return Number.isFinite(+d)?d.toLocaleDateString('sv-SE',{timeZone:'Europe/Madrid'}):null;}
function dailySources(items,date){
 if(!validDay(date))throw Error('Fecha inválida');
 const unique=new Map();
 for(const item of items){
  if(!item||!item.payload||typeof item.id!=='string')continue;
  const p=item.payload;
  const original=item.kind==='reflection'?dateOf(p.date):dateOf(item.date);
  const d=original||(item.kind==='reflection'?dateOf(p.recordedAt):null);
  if(d!==date)continue;
  const key=item.kind==='reflection'&&typeof p.sourceReference==='string'&&p.sourceReference.trim()?'reflection:'+p.sourceReference:item.id;
  const reported=typeof (item.kind==='reflection'?p.reported:p.text)==='string'?(item.kind==='reflection'?p.reported:p.text).trim():'';
  const summary=item.kind==='reflection'&&typeof p.summary==='string'?p.summary.trim():'';
  if(!reported&&!summary)continue;
  const source={id:key,title:typeof item.title==='string'?item.title.slice(0,160):'',reported,summary,kind:item.kind,dateBasis:item.kind==='diary'?'fecha de anotación, autoría sin verificar':original?'fecha original registrada':'fecha de registro, no necesariamente del suceso',project:typeof p.sourceProject==='string'?p.sourceProject.slice(0,120):''};
  const old=unique.get(key);
  if(!old)unique.set(key,source);
  else if(old.reported!==source.reported||old.summary!==source.summary){
    // Conservar variantes; no escoger automáticamente una versión como verdadera.
    if(!old.variants)old.variants=[];
    if(!old.variants.some(v=>v.reported===source.reported&&v.summary===source.summary))old.variants.push(source);
  }
 }
 return [...unique.values()];
}
function draft(date,sources,entries,labels){
 if(!validDay(date))throw Error('Fecha inválida');
 const rows=entries.filter(e=>e.date===date);
 const lines=['Informe del '+date,'Borrador descriptivo a partir de fuentes disponibles; no es una interpretación clínica ni una síntesis semántica generativa.', '', 'Fuentes del día: '+sources.length+' registros distintos.'];
 for(const [i,source] of sources.entries()){
  lines.push('',(i+1)+'. '+(source.title||'Registro sin título')+(source.project?' · '+source.project:'')+' ('+source.dateBasis+').');
  for(const [j,v] of [source,...(source.variants||[])].entries()){
   if(j)lines.push('Variante del mismo registro; no cuenta como otra interacción.');
   if(v.summary)lines.push('Resumen importado (no constituye palabras originales verificadas): '+v.summary);
   if(v.reported)lines.push((v.kind==='reflection'?'Palabras atribuidas al usuario: ':'Texto de la anotación, autoría sin verificar: ')+v.reported);
  }
 }
 if(!sources.length)lines.push('Sin fuentes disponibles para esa fecha. No equivale a ausencia de dificultades.');
 lines.push('','Valoraciones ya revisadas:');
 const grouped=new Map();
 for(const e of rows){if(!grouped.has(e.dimension))grouped.set(e.dimension,[]);grouped.get(e.dimension).push(e);}
 for(const [id,group] of grouped){
  const auto=[...new Set(group.filter(e=>e.source==='autovaloracion'&&e.value!==null).map(e=>e.value+'/4'))];
  const dirs=[...new Set(group.filter(e=>e.source==='texto'&&e.analysis).map(e=>e.analysis.direction))];
  lines.push((labels[id]||id)+': '+(dirs.length?'orientaciones registradas: '+dirs.join(' / ')+'. ':'')+(auto.length?'autovaloración declarada: '+auto.join(' / ')+'. ':'')+group.length+' observaciones; no son frecuencia de síntomas.');
 }
 if(!rows.length)lines.push('Sin valoraciones revisadas. No se asigna cero.');
 lines.push('','Reflexión y aspectos pendientes de aclarar (puedes redactarlos aquí):');
 return lines.join('\n');
}
function upsert(reports,report){if(!validDay(report.date)||typeof report.text!=='string'||!report.text.trim()||report.text.length>60000)throw Error('Informe inválido o demasiado largo');return [...reports.filter(r=>r.date!==report.date),{date:report.date,text:report.text}].sort((a,b)=>b.date.localeCompare(a.date));}
const api={validDay,dateOf,dailySources,draft,upsert};if(typeof module==='object'&&module.exports)module.exports=api;else root.RumboDailyReport=api;
})(typeof globalThis==='object'?globalThis:this);
