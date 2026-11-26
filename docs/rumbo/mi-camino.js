/* Mi camino: progreso voluntario local; sin datos personales en el código. */
(function mount(C){
 'use strict';
 const home=document.getElementById('mi-dia'),body=home?.querySelector('.assistant-body');if(!body||document.getElementById('mi-camino'))return;
 const KEY='rumbo-mi-camino-v1';let state={version:1,days:{}},raw=null,locked=false;
 try{raw=localStorage.getItem(KEY);if(raw!==null){state=JSON.parse(raw);if(!C.valid(state))throw Error('invalid');}}catch{locked=true;state={version:1,days:{}};}
 const panel=document.createElement('section');panel.id='mi-camino';panel.className='assistant-card camino-card';panel.setAttribute('aria-label','Mi camino');
 panel.innerHTML=`<div class="camino-head"><div><p class="camino-kicker">MI CAMINO</p><h3 id="camino-level"></h3><p id="camino-xp"></p></div><strong id="camino-today"></strong></div><progress id="camino-progress" aria-label="Progreso al siguiente nivel"></progress><p id="camino-next" class="camino-muted"></p><details id="camino-plan"><summary>Planificar mi día <span id="camino-plan-status"></span></summary><form id="camino-form"><p class="camino-muted">Elige hasta tres prioridades. Puedes cambiarlas sin perder puntos.</p><label>Prioridad principal<input id="camino-p1" maxlength="180" required placeholder="Lo importante de hoy"></label><label>Prioridad 2 (opcional)<input id="camino-p2" maxlength="180"></label><label>Prioridad 3 (opcional)<input id="camino-p3" maxlength="180"></label><button type="button" class="button secondary" id="camino-use">Usar mis prioridades de Rumbo</button><button class="button primary" type="submit">Confirmar mi plan</button></form></details><details id="camino-actions"><summary>Registrar avances <span id="camino-action-count"></span></summary><div id="camino-buttons"></div><button type="button" class="button secondary" id="camino-difficult" hidden>He retomado el plan en un día difícil</button><p class="camino-muted">Hasta 100 XP diarios. Registra solo lo que has hecho; no necesitas llegar al máximo.</p></details><details id="camino-awards"><summary>Mis insignias <span id="camino-badge-count"></span></summary><div id="camino-badges"></div></details><details id="camino-week"><summary>Mis últimos 7 días</summary><div id="camino-history"></div></details><p id="camino-msg" role="status" aria-live="polite"></p><p class="camino-muted">Progreso personal, no una medida clínica. Guardado en este navegador; incluido en copias privadas cifradas. Sin rachas ni penalizaciones.</p>`;
 body.prepend(panel);
 const $=id=>panel.querySelector('#'+id),fields=[1,2,3].map(i=>$('camino-p'+i)),message=s=>{$('camino-msg').textContent=s;},day=()=>state.days[C.date()]||C.empty();
 const node=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
 let renderedDay='';
 function render(resetPlan=false){
   const date=C.date(),d=day(),t=C.totals(state),i=C.levels.reduce((n,l,j)=>t.xp>=l[0]?j:n,0),level=C.levels[i],next=C.levels[i+1];
   $('camino-level').textContent='Nivel '+(i+1)+' · '+level[1];$('camino-xp').textContent=t.xp.toLocaleString('es-ES')+' XP acumulados';$('camino-today').textContent='Hoy +'+C.points(d)+' XP';
   $('camino-progress').max=next?next[0]-level[0]:1;$('camino-progress').value=next?t.xp-level[0]:1;$('camino-next').textContent=next?(next[0]-t.xp).toLocaleString('es-ES')+' XP hasta '+next[1]:'Has llegado a Horizonte. Sigue a tu ritmo.';
   if(resetPlan||renderedDay!==date){fields.forEach((f,i)=>f.value=d.plan[i]||'');$('camino-plan').open=!d.counts.plan&&!locked;renderedDay=date;}
   $('camino-plan-status').textContent=d.counts.plan?' · Listo':' · +10 XP';
   $('camino-action-count').textContent=' · '+Object.values(d.counts).reduce((a,b)=>a+b,0)+' registros';
   const buttons=C.actions.filter(a=>a[0]!=='plan').map(([id,label,xp,max])=>{const b=node('button',label+' · '+(d.counts[id]||0)+'/'+max+' · +'+xp+' XP','button secondary');b.type='button';b.disabled=locked||(d.counts[id]||0)>=max;b.addEventListener('click',()=>record(id));return b;});$('camino-buttons').replaceChildren(...buttons);
   $('camino-difficult').hidden=!d.counts.return||d.difficult;$('camino-difficult').disabled=locked;
   $('camino-badge-count').textContent=' · '+t.badges.filter(b=>b[2]>=b[3]).length+'/'+t.badges.length;
   $('camino-badges').replaceChildren(...t.badges.map(([icon,name,n,goal])=>{const row=node('div','','camino-badge');row.append(node('strong',icon+' '+name),node('span',n>=goal?'Conseguida':Math.min(n,goal)+'/'+goal,'camino-muted'));return row;}));
   const week=Array.from({length:7},(_,i)=>{const dt=new Date(date+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()-i);const key=dt.toISOString().slice(0,10);const v=state.days[key];return node('div',key.slice(8)+'/'+key.slice(5,7)+' · '+(v?C.points(v)+' XP':'Sin registro'),'camino-history-row');});$('camino-history').replaceChildren(...week);
   panel.querySelectorAll('#camino-form input,#camino-form button').forEach(x=>x.disabled=locked);
 }
 function commit(next,text,resetPlan=false){
   if(locked||!next||!C.valid(next))return;
   try{if(localStorage.getItem(KEY)!==raw)throw Error('Otra pestaña modificó Mi camino. Recarga antes de continuar.');const before=C.totals(state),beforeDay=C.points(day()),serialized=JSON.stringify(next);localStorage.setItem(KEY,serialized);raw=serialized;state=next;const after=C.totals(state);render(resetPlan);const earned=C.points(day())-beforeDay;const awards=after.badges.filter((b,i)=>b[2]>=b[3]&&before.badges[i][2]<b[3]).map(b=>b[1]);const level=C.levels.filter(l=>l[0]<=after.xp).at(-1);const oldLevel=C.levels.filter(l=>l[0]<=before.xp).at(-1);message(text+(earned?' +'+earned+' XP.':'')+(awards.length?' Insignia conseguida: '+awards.join(', ')+'.':'')+(level!==oldLevel?' Nuevo nivel: '+level[1]+'.':''));}
   catch(e){message('No se guardó: '+e.message);}
 }
 function record(id){if(C.date()!==renderedDay){render(true);message('Ha cambiado el día. Registra el avance de hoy.');return;}commit(C.add(state,C.date(),id),'Avance registrado.');}
 $('camino-form').addEventListener('submit',e=>{e.preventDefault();if(C.date()!==renderedDay){render(true);message('Ha cambiado el día. Confirma el plan de hoy.');return;}const next=C.plan(state,C.date(),fields.map(f=>f.value));if(!next){message('Escribe al menos una prioridad.');return;}commit(next,'Plan guardado.',true);$('camino-plan').open=false;});
 $('camino-use').addEventListener('click',()=>{try{const a=JSON.parse(localStorage.getItem('rumbo-asistente-v1')||'null');const p=(a?.priorityIds||[]).map(id=>a.items.find(t=>t.id===id&&!t.done)?.text).filter(Boolean).slice(0,3);if(!p.length){message('Aún no hay prioridades seleccionadas en Mi día. Puedes escribirlas aquí.');return;}fields.forEach((f,i)=>f.value=(p[i]||'').slice(0,180));message('Prioridades copiadas. Confirma el plan cuando esté listo.');}catch{message('No se pudieron leer las prioridades. Puedes escribirlas.');}});
 $('camino-difficult').addEventListener('click',()=>commit(C.difficult(state,C.date()),'Recuperación reconocida.'));
 window.addEventListener('rumbo:activity-parked',()=>{if(!locked&&C.date()===renderedDay&&!(day().counts.stop||0))commit(C.add(state,C.date(),'stop'),'Actividad aparcada: has practicado detenerte.');});
 window.addEventListener('storage',e=>{if(e.key===KEY){locked=true;render();message('El progreso cambió en otra pestaña. Recarga antes de registrar.');}});
 const refresh=()=>{if(C.date()!==renderedDay)render(true);};window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);setInterval(refresh,30000);
 render(true);if(locked)message('El progreso existente no es compatible. No se modificará.');
})((function core(){
 const actions=[['plan','Planificar la mañana',10,1],['start','Empezar mi prioridad',10,1],['study','Completar un bloque de estudio',10,3],['stop','Detenerme a tiempo',20,2],['return','Retomar mi prioridad',20,2],['meal','Comer a la hora prevista',10,1],['exercise','Ejercicio o movimiento previsto',15,1],['family','Tiempo de calidad con mi familia',15,1],['rest','Descanso consciente',10,1]];
 const levels=[[0,'Primer paso'],[100,'Explorador'],[300,'Constructor de hábitos'],[600,'Enfoque consciente'],[1000,'Navegante'],[2000,'Capitán de mi día'],[4000,'Maestro del rumbo'],[8000,'Horizonte']];
 const date=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const empty=()=>({plan:[],counts:{},difficult:false});
 const valid=s=>!!s&&s.version===1&&s.days&&typeof s.days==='object'&&!Array.isArray(s.days)&&Object.entries(s.days).every(([k,v])=>/^\d{4}-\d{2}-\d{2}$/.test(k)&&v&&Array.isArray(v.plan)&&v.plan.length<=3&&v.plan.every(x=>typeof x==='string'&&x.length>0&&x.length<=180)&&typeof v.difficult==='boolean'&&v.counts&&typeof v.counts==='object'&&!Array.isArray(v.counts)&&Object.entries(v.counts).every(([id,n])=>actions.some(a=>a[0]===id&&Number.isInteger(n)&&n>=0&&n<=a[3]))&&(!v.counts.plan||v.plan.length>0)&&(!v.difficult||v.counts.return>0));
 const points=d=>Math.min(100,actions.reduce((n,a)=>n+(d.counts[a[0]]||0)*a[2],0));
 const totals=s=>{const ds=Object.values(s.days),count=id=>ds.reduce((n,d)=>n+(d.counts[id]||0),0);return {xp:ds.reduce((n,d)=>n+points(d),0),badges:[['☀','Dueño de mi mañana',count('plan'),5],['✋','Yo decido',count('stop'),10],['↪','Volver al rumbo',count('return'),10],['◎','Mente enfocada',count('study'),20],['☘','Aprender a descansar',count('rest'),10],['♡','Presente',count('family'),10],['▣','Constancia',count('plan'),20],['◇','Capacidad de recuperación',ds.filter(d=>d.difficult).length,5]]};};
 const add=(s,day,id)=>{const a=actions.find(x=>x[0]===id);if(!a||id==='plan')return null;const d=s.days[day]||empty();if((d.counts[id]||0)>=a[3])return null;return {...s,days:{...s.days,[day]:{...d,counts:{...d.counts,[id]:(d.counts[id]||0)+1}}}};};
 const plan=(s,day,values)=>{const p=values.map(x=>x.trim()).filter(Boolean).slice(0,3);if(!p.length||p.some(x=>x.length>180))return null;const d=s.days[day]||empty();return {...s,days:{...s.days,[day]:{...d,plan:p,counts:{...d.counts,plan:1}}}};};
 const difficult=(s,day)=>{const d=s.days[day];return d&&d.counts.return&&!d.difficult?{...s,days:{...s.days,[day]:{...d,difficult:true}}}:null;};
 return {actions,levels,date,empty,valid,points,totals,add,plan,difficult};
})());
