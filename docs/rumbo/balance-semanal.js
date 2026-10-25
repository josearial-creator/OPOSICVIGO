(() => {
'use strict';
// Resumen puramente local. No envía diarios, sesiones ni texto a terceros.
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plural=(n,singular,pluralLabel)=>n+' '+(n===1?singular:pluralLabel);
function mondayOf(date){
  const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());
  d.setDate(d.getDate()-(d.getDay()+6)%7);
  return d;
}
function inRange(date,start,end){
  if(!date)return false;
  const when=new Date(date).getTime();
  return Number.isFinite(when)&&when>=start.getTime()&&when<end.getTime();
}
function html(data,skills){
  const monday=mondayOf(new Date());
  const sunday=new Date(monday);sunday.setDate(sunday.getDate()+6);
  const nextMonday=new Date(monday);nextMonday.setDate(nextMonday.getDate()+7);
  const lastMonday=new Date(monday);lastMonday.setDate(lastMonday.getDate()-7);
  const thisSessions=data.sessions.filter(s=>s.source!=='aportada'&&inRange(s.date,monday,nextMonday));
  const previousSessions=data.sessions.filter(s=>s.source!=='aportada'&&inRange(s.date,lastMonday,monday));
  const thisNotes=data.real.filter(r=>inRange(r.date,monday,nextMonday));
  const previousNotes=data.real.filter(r=>inRange(r.date,lastMonday,monday));
  const exercises=thisSessions.flatMap(s=>s.exercises||[]);
  const skillCounts=skills.map((skill,i)=>({i,name:skill[0],count:exercises.reduce((n,e)=>n+(Number.isFinite(e.skills?.[i])?1:0),0)})).filter(x=>x.count>0).sort((a,b)=>b.count-a.count||a.i-b.i);
  const most=skillCounts[0];
  const paired=exercises.filter(e=>Number.isFinite(e.before?.nerviosismo)&&Number.isFinite(e.after?.nerviosismo));
  const mean=(arr,key)=>(arr.reduce((acc,e)=>acc+e[key].nerviosismo,0)/arr.length).toFixed(1).replace('.',',');
  const fmt=new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short'});
  const period=fmt.format(monday)+' – '+fmt.format(sunday);
  const empty=thisSessions.length===0&&thisNotes.length===0;
  const nextAction=empty
    ?'Si te apetece, practica 5 minutos de escucha activa o anota una situación que te interese recordar.'
    :most
      ?'Próximo paso sugerido: dedica 5 minutos a '+most.name.toLowerCase()+' y prueba una respuesta alternativa.'
      :'Próximo paso sugerido: elige una habilidad y realiza una práctica breve cuando te resulte útil.';
  const nervous=paired.length
    ?'Nerviosismo declarado antes y después: '+mean(paired,'before')+' → '+mean(paired,'after')+' sobre 10 ('+plural(paired.length,'ejercicio','ejercicios')+' con ambos datos). Es un autoinforme; no demuestra un efecto del entrenamiento.'
    :'Sin suficientes autoinformes de antes y después para mostrar una comparación de nerviosismo.';
  return [
  '<section id="ev-weekly" class="ev-weekly" aria-label="Balance semanal de entrenamiento">',
  '<h3>Tu balance semanal</h3>',
  '<p class="ev-muted">Semana del '+escapeHTML(period)+' · solo registros guardados en este navegador</p>',
  '<div class="ev-weekly-metrics">',
  '<article><strong data-week-value="sessions">'+thisSessions.length+'</strong><span>sesiones registradas</span></article>',
  '<article><strong data-week-value="exercises">'+exercises.length+'</strong><span>ejercicios registrados</span></article>',
  '<article><strong data-week-value="notes">'+thisNotes.length+'</strong><span>apuntes de diario</span></article>',
  '</div>',
  '<p id="ev-week-compare">Semana anterior: '+plural(previousSessions.length,'sesión','sesiones')+' y '+plural(previousNotes.length,'apunte','apuntes')+' de diario. Se muestra actividad, no una valoración de tu capacidad.</p>',
  '<p id="ev-week-skill">'+(most?'Habilidad más practicada: '+escapeHTML(most.name)+' ('+plural(most.count,'ejercicio','ejercicios')+').':empty?'Esta semana todavía no hay registros. No hace falta anotar algo todos los días.':'Esta semana no se han registrado ejercicios por habilidad.')+'</p>',
  '<p id="ev-week-nervous">'+escapeHTML(nervous)+'</p>',
  '<p class="ev-weekly-next">'+escapeHTML(nextAction)+'</p>',
  '<div class="ev-weekly-actions"><a href="#ev-training" class="button secondary">Practicar</a><a href="#ev-diary" class="button secondary">Anotar una situación</a></div>',
  '</section>'
  ].join('');
}
window.RumboWeekly={html};
})();