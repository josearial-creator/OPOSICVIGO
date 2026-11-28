(() => {
 'use strict';
 const tools=document.querySelector('.topbar-tools');
 if(!tools||!window.RumboNavigation)return;
 const routes=[
  ['inicio','Portada','Inicio'],['mi-dia','Mi día','Organización'],
  ['panel-hoy','Mi radar','Organización'],['convocatorias','Convocatorias','Oposiciones'],
  ['favoritos','Favoritas','Oposiciones'],['apuntes-estudio','Apuntes de estudio','Oposiciones'],
  ['mi-espacio','Mi espacio','Diario'],['ev-diary','Diario','Diario'],
  ['historial-rumbo','Historial recuperado','Diario'],['mi-evolucion','Mis prácticas','Diario'],['observatorio-personal','Observatorio emocional','Diario'],
  ['ev-training','Entrenamiento','Diario'],['productividad','Productividad','Herramientas'],
  ['proyectos','Proyectos','Herramientas'],['metricas-personales','Métricas','Herramientas']
 ];
 const keywords={
  inicio:'inicio portada resumen', 'mi-dia':'hoy agenda plan mi camino hábitos habitos rutinas',
  'panel-hoy':'radar novedades prioridades',convocatorias:'oposiciones empleo plazas vigo sergas xunta hacienda aeat',
  favoritos:'favoritos favoritas guardados seguimiento', 'apuntes-estudio':'estudiar temario notas apuntes',
  'mi-espacio':'escribir notas personales cuaderno', 'ev-diary':'diario emociones situaciones conversaciones',
  'historial-rumbo':'historial registros anteriores recuperados', 'mi-evolucion':'mi evolución evolucion progreso habilidades prácticas practicas',
  'observatorio-personal':'observatorio emocional emociones tendencias', 'ev-training':'entrenar entrenamiento simulaciones ejercicios voz',
  productividad:'tareas productividad foco pomodoro anytype',proyectos:'proyectos objetivos planificación planificacion',
  'metricas-personales':'estadísticas estadisticas métricas metricas resultados tiempo'
 };
 const norm=text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
 const button=document.createElement('button');
 button.type='button';button.className='rumbo-quick-nav-trigger';
 button.id='rumbo-quick-nav-open';button.setAttribute('aria-label','Buscar un apartado de Rumbo');
 button.setAttribute('aria-expanded','false');button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','rumbo-quick-nav-dialog');
 button.innerHTML='<svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg><span>Ir a…</span>';
 const date=tools.querySelector('.top-date');
 if(date)date.insertAdjacentElement('afterend',button);
 else tools.prepend(button);
 const dialog=document.createElement('dialog');dialog.id='rumbo-quick-nav-dialog';dialog.className='rumbo-quick-nav-dialog';
 const panel=document.createElement('div');panel.className='rumbo-quick-nav-panel';
 const header=document.createElement('div');header.className='rumbo-quick-nav-header';
 const title=document.createElement('h2');title.id='rumbo-quick-nav-title';title.textContent='Ir a un apartado';
 const close=document.createElement('button');close.type='button';close.className='rumbo-quick-nav-close';close.setAttribute('aria-label','Cerrar buscador');close.textContent='Cerrar';
 header.append(title,close);
 const input=document.createElement('input');input.type='search';input.id='rumbo-quick-nav-search';
 input.autocomplete='off';input.placeholder='Buscar: diario, oposiciones, tareas…';
 input.setAttribute('aria-label','Buscar un apartado');
 input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');
 input.setAttribute('aria-controls','rumbo-quick-nav-results');input.setAttribute('aria-expanded','false');
 const list=document.createElement('div');list.id='rumbo-quick-nav-results';list.className='rumbo-quick-nav-results';
 list.setAttribute('role','listbox');list.setAttribute('aria-label','Apartados disponibles');
 const empty=document.createElement('p');empty.className='rumbo-quick-nav-empty';empty.textContent='No hay apartados con ese nombre.';
 const count=document.createElement('p');count.className='rumbo-quick-nav-count';count.setAttribute('role','status');count.setAttribute('aria-live','polite');
 const hint=document.createElement('p');hint.className='rumbo-quick-nav-hint';hint.textContent='Ctrl + K para abrir · Esc para cerrar';
 panel.append(header,input,count,list,empty,hint);dialog.append(panel);
 dialog.setAttribute('aria-labelledby',title.id);document.body.append(dialog);
 let matched=[],highlight=0;
 function closeDialog(){
  input.setAttribute('aria-expanded','false');button.setAttribute('aria-expanded','false');
  input.removeAttribute('aria-activedescendant');dialog.close();
 }
 const move=id=>{
   closeDialog();
   window.RumboNavigation.go(id);
   // La navegación ya gestiona el foco en el título del apartado.
 };
 function draw(){
  const words=norm(input.value).split(/\s+/).filter(Boolean);
  matched=routes.filter(([id,label,group])=>{const text=norm(label+' '+group+' '+keywords[id]);return words.every(word=>text.includes(word));});
  count.textContent=matched.length+' apartado'+(matched.length===1?'':'s')+' disponible'+(matched.length===1?'':'s');
  highlight=0;list.replaceChildren();empty.hidden=matched.length>0;
  matched.forEach(([id,label,group],i)=>{
   const item=document.createElement('button');item.type='button';item.className='rumbo-quick-nav-result';
   item.id='rumbo-quick-nav-option-'+i;
   item.setAttribute('role','option');item.setAttribute('aria-selected',String(i===highlight));
   const name=document.createElement('span');name.textContent=label;
   const section=document.createElement('small');section.textContent=group;
   item.append(name,section);item.addEventListener('click',()=>move(id));list.append(item);
  });
  if(matched.length)input.setAttribute('aria-activedescendant',list.firstElementChild.id);else input.removeAttribute('aria-activedescendant');
 }
 function select(i){
  if(!matched.length)return;
  highlight=(i+matched.length)%matched.length;
  [...list.children].forEach((el,index)=>el.setAttribute('aria-selected',String(index===highlight)));
  input.setAttribute('aria-activedescendant',list.children[highlight].id);
  list.children[highlight]?.scrollIntoView({block:'nearest'});
 }
 function open(){
  if(document.querySelector('dialog[open]'))return;
  input.value='';draw();dialog.showModal();input.setAttribute('aria-expanded','true');button.setAttribute('aria-expanded','true');input.focus();
 }
 button.addEventListener('click',open);
 dialog.addEventListener('close',()=>{if(dialog.open)return;input.setAttribute('aria-expanded','false');button.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');});
 close.addEventListener('click',()=>closeDialog());
 input.addEventListener('input',draw);
 input.addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'){event.preventDefault();select(highlight+1);}
  if(event.key==='ArrowUp'){event.preventDefault();select(highlight-1);}
  if(event.key==='Enter'&&matched.length){event.preventDefault();move(matched[highlight][0]);}
 });
 dialog.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
   event.preventDefault();event.stopPropagation();closeDialog();button.focus();
  }
 });
 dialog.addEventListener('click',event=>{if(event.target===dialog)closeDialog();});
 document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!event.altKey){
   event.preventDefault();if(dialog.open)closeDialog();else open();
  }
 });
})();