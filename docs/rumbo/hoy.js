(() => {
'use strict';
const byId = id => document.getElementById(id);
const el = (tag, className, value) => {
  const x = document.createElement(tag);
  if (className) x.className = className;
  if (value !== undefined) x.textContent = String(value);
  return x;
};
// Interpreta únicamente fechas completas y válidas, sin deducir plazos de textos libres.
function deadline(value) {
  const s = String(value || '').trim();
  let y,m,d,parts;
  if ((parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) [,y,m,d] = parts;
  else if ((parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s))) [,d,m,y] = parts;
  else return null;
  y=Number(y);m=Number(m);d=Number(d);
  const date=new Date(Date.UTC(y,m-1,d));
  if (date.getUTCFullYear()!==y || date.getUTCMonth()!==m-1 || date.getUTCDate()!==d) return null;
  return Date.UTC(y,m-1,d)/86400000;
}
function daysLeft(record) {
  const end=deadline(record.fin);
  if (end===null) return null;
  const now=new Date();
  const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())/86400000;
  return end-today;
}
function render({records,favorites,newKeys,recordKey,statusType,openDetail,goFavorites}) {
  const counts=byId('today-metrics'),list=byId('today-actions');
  if (!counts || !list) return;
  const fav=records.filter(r=>favorites.has(recordKey(r)));
  const open=fav.filter(r=>statusType(r)==='abierta' && (daysLeft(r)===null || daysLeft(r)>=0));
  const review=fav.filter(r=>statusType(r)!=='abierta'||(daysLeft(r)!==null&&daysLeft(r)<0));
  const fresh=records.filter(r=>newKeys.has(recordKey(r)));
  const cards=[['Favoritas abiertas según fuente',open.length],['Favoritas para revisar',review.length],['Nuevas en esta consulta',fresh.length]];
  counts.replaceChildren(...cards.map(([name,number])=>{const card=el('div','today-metric');card.append(el('strong','',number),el('span','',name));return card;}));
  const rank=r=>{
    const days=daysLeft(r),status=statusType(r);
    if(status==='abierta'&&days!==null&&days>=0&&days<=7)return 0;
    if(status==='abierta'&&(days===null||days>=0))return 1;
    if(status==='pendiente')return 2;
    if(status==='verificar'||(days!==null&&days<0))return 3;
    return 4;
  };
  const featured=(fav.length?fav:fresh).slice().sort((a,b)=>rank(a)-rank(b)||String(a.puesto).localeCompare(String(b.puesto),'es')).slice(0,4);
  list.replaceChildren();
  if(!featured.length){
    const msg=el('p','today-empty','Todavía no tienes convocatorias favoritas. Marca con ☆ las que te interesen para verlas aquí.');
    const action=el('button','button secondary','Explorar convocatorias');action.type='button';action.onclick=()=>byId('convocatorias').scrollIntoView({behavior:'smooth'});
    list.append(msg,action);return;
  }
  featured.forEach(r=>{
    const item=el('div','today-entry'),body=el('div');
    body.append(el('strong','',r.puesto||'Puesto sin verificar'));
    const d=daysLeft(r),status=statusType(r);
    let deadlineText='Fin de plazo no verificado';
    if(d!==null)deadlineText=d<0?'La fecha de fin indicada ya pasó: comprueba las bases':d===0?'Fecha de fin indicada: hoy':d<=7?'Fecha de fin indicada: en '+d+' día'+(d===1?'':'s'):'Fecha de fin: '+String(r.fin);
    const statusName={abierta:'Inscripción abierta según fuente',cerrada:'Inscripción cerrada',pendiente:'Pendiente de abrir',verificar:'Plazo por verificar',seguimiento:'En seguimiento'}[status]||'En seguimiento';
    body.append(el('p','',String(r.organismo||'Organismo por verificar')+' · '+statusName+' · '+deadlineText));
    const button=el('button','button secondary','Ver ficha');button.type='button';button.addEventListener('click',()=>openDetail(r));item.append(body,button);list.append(item);
  });
  if(fav.length>4){const a=el('button','plain','Ver todas mis favoritas');a.type='button';a.onclick=goFavorites;list.append(a);}
}
window.RumboHome={render};
})();