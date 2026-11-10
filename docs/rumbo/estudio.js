(() => {
 'use strict';
 const root=document.getElementById('apuntes-estudio');if(!root)return;
 const general='estudio:general';let dirty=false;
 root.innerHTML=`<div class="panel-head"><div><div class="eyebrow">ESTUDIO</div><h2>Apuntes de estudio</h2><p>Temario, dudas y recordatorios para preparar tus oposiciones.</p></div></div>
 <p>Estos apuntes se guardan solo en este navegador. Exporta una copia para conservarlos o llevarlos a otro dispositivo. El diario personal está separado.</p>
 <label for="study-topic">Convocatoria</label><select id="study-topic"><option value="estudio:general">Estudio general</option></select>
 <label for="study-text">Mis apuntes</label><textarea id="study-text" rows="7" maxlength="20000" placeholder="Anota una duda, un tema para repasar o lo que has estudiado…"></textarea>
 <div class="study-actions"><button type="button" class="button primary" id="study-save">Guardar apuntes</button><button type="button" class="button secondary" id="study-export">Exportar apuntes</button></div>
 <p id="study-status" role="status" aria-live="polite"></p><h3>Apuntes guardados</h3><div id="study-list"></div>`;
 const topic=root.querySelector('#study-topic'),text=root.querySelector('#study-text'),status=root.querySelector('#study-status');
 let selected=general;
 const store=()=>window.RumboStudyStore;
 function label(key,snapshot){const r=snapshot.records.find(x=>x.key===key);return key===general?'Estudio general':r?[r.title,r.organismo].filter(Boolean).join(' · '):'Convocatoria archivada · '+key;}
 function open(key){
  if(dirty&&!confirm('Hay cambios sin guardar. ¿Descartarlos y abrir otros apuntes?')){topic.value=selected;return;}
  selected=key;topic.value=key;text.value=store().snapshot().notes[key]||'';dirty=false;status.textContent='';text.focus();
 }
 function render(){
  if(!store())return;
  const snapshot=store().snapshot();const keys=[general,...new Set([...snapshot.records.map(r=>r.key),...Object.keys(snapshot.notes)])].filter((k,i,a)=>a.indexOf(k)===i);
  topic.replaceChildren(...keys.map(key=>{const opt=document.createElement('option');opt.value=key;opt.textContent=label(key,snapshot);return opt;}));topic.value=selected;
  const list=root.querySelector('#study-list');list.replaceChildren();
  const entries=Object.entries(snapshot.notes).filter(([,value])=>typeof value==='string'&&value.trim());
  if(!entries.length){const p=document.createElement('p');p.textContent='Todavía no hay apuntes. Elige una convocatoria y escribe.';list.append(p);}
  for(const [key,value] of entries){
   const card=document.createElement('article');card.className='study-note';
   const title=document.createElement('h4');title.textContent=label(key,snapshot);
   const excerpt=document.createElement('p');excerpt.textContent=value.slice(0,220)+(value.length>220?'…':'');
   const button=document.createElement('button');button.type='button';button.className='button secondary';button.textContent='Abrir apuntes';button.onclick=()=>open(key);card.append(title,excerpt,button);list.append(card);
  }
 }
 topic.addEventListener('change',()=>open(topic.value));text.addEventListener('input',()=>{dirty=true;status.textContent='Cambios sin guardar.';});
 root.querySelector('#study-save').addEventListener('click',()=>{
  if(!text.value.trim()&&(store().snapshot().notes[selected]||'').trim()&&!confirm('¿Vaciar los apuntes de esta convocatoria?'))return;
  if(store().write(selected,text.value)){dirty=false;status.textContent='Apuntes guardados en este navegador.';}
  else status.textContent='No se pudo guardar. Conserva el texto y vuelve a intentarlo.';
 });
 root.querySelector('#study-export').addEventListener('click',()=>{
  const snapshot=store().snapshot();const notes=Object.entries(snapshot.notes).map(([key,text])=>({key,convocatoria:label(key,snapshot),text}));
  const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,notes},null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='rumbo-apuntes-estudio.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  status.textContent=dirty?'Copia de los apuntes guardados preparada. El texto actual tiene cambios sin guardar.':'Copia de los apuntes preparada.';
 });
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 window.addEventListener('rumbo:study-updated',render);render();
})();
