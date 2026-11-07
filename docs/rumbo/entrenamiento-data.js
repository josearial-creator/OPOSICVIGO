(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.RumboRunningData=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clean=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  function number(raw){
    if(typeof raw==='number')return Number.isFinite(raw)?raw:null;
    let s=String(raw??'').trim().replace(/\s/g,'').replace(/[^\d.,-]/g,'');
    if(!s || s==='-')return null;
    if(s.includes(',') && s.includes('.')){
      s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
    }else if(s.includes(','))s=s.replace(',','.');
    const n=Number(s);return Number.isFinite(n)?n:null;
  }
  function seconds(raw){
    if(typeof raw==='number')return Number.isFinite(raw)&&raw>=0?raw:null;
    const str=String(raw??'').trim();
    if(!str)return null;
    if(/^\d+(?:[.,]\d+)?$/.test(str))return number(str);
    const parts=str.split(':').map(number);
    if(parts.length<2||parts.length>3||parts.some(x=>x===null||x<0))return null;
    if(parts.length===2)return parts[0]*60+parts[1];
    return parts[0]*3600+parts[1]*60+parts[2];
  }
  function day(raw){
    if(raw instanceof Date && Number.isFinite(raw.getTime()))return raw.toISOString().slice(0,10);
    const s=String(raw??'').trim();
    if(!s)return null;
    if(/^\d{4}-\d{2}-\d{2}/.test(s))return validDay(s.slice(0,10))?s.slice(0,10):null;
    const eu=s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
    if(eu){const k=eu[3]+'-'+eu[2].padStart(2,'0')+'-'+eu[1].padStart(2,'0');return validDay(k)?k:null;}
    const ts=Date.parse(s);
    return Number.isFinite(ts)?new Date(ts).toISOString().slice(0,10):null;
  }
  function validDay(s){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
    const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;
  }
  function delimited(text){
    const raw=String(text??'').replace(/^\uFEFF/,'');
    const first=raw.slice(0,raw.indexOf('\n')<0?raw.length:raw.indexOf('\n'));
    const count=char=>{let q=false,n=0;for(let i=0;i<first.length;i++){if(first[i]==='"'){if(q&&first[i+1]==='"')i++;else q=!q;}else if(!q&&first[i]===char)n++;}return n;};
    const delim=count(';')>count(',')?';':count('\t')>count(',')?'\t':',';
    const rows=[];let row=[],v='',quoted=false;
    for(let i=0;i<raw.length;i++){
      const ch=raw[i];
      if(ch==='"'){if(quoted&&raw[i+1]==='"'){v+='"';i++;}else quoted=!quoted;}
      else if(!quoted&&ch===delim){row.push(v.trim());v='';}
      else if(!quoted&&(ch==='\n'||ch==='\r')){
        if(ch==='\r'&&raw[i+1]==='\n')i++;
        row.push(v.trim());v='';if(row.some(Boolean))rows.push(row);row=[];
      }else v+=ch;
    }
    row.push(v.trim());if(row.some(Boolean))rows.push(row);
    if(rows.length<2)return [];
    const heads=rows[0].map(clean);
    return rows.slice(1).map(cells=>Object.fromEntries(heads.map((k,i)=>[k,cells[i]??''])));
  }
  function pick(row,names){
    for(const n of names){const key=clean(n);if(row[key]!==undefined && String(row[key]).trim()!=='')return row[key];}
    return null;
  }
  function metric(row,names){return number(pick(row,names));}
  function normalise(raw,source='garmin-csv'){
    if(!raw||typeof raw!=='object')return null;
    const r=Object.fromEntries(Object.entries(raw).map(([k,v])=>[clean(k),v]));
    const date=day(pick(r,['date','fecha','start time','starttime','start date','startdate','activity date','activitydate']));
    const duration=seconds(pick(r,['time','tiempo','duration','duracion','elapsed time','elapsedtime','moving time','movingtime']));
    const distanceRaw=pick(r,['distance','distancia','distance km','distancekm']);
    let distance=number(distanceRaw);
    if(distance!==null && /mi\b/i.test(String(distanceRaw)))distance*=1.609344;
    if(!date||(duration===null&&distance===null))return null;
    const id=pick(r,['activity id','activityid','id actividad','idactividad','id']);
    const type=pick(r,['activity type','activitytype','tipo de actividad','tipodeactividad','type','tipo'])||'Carrera';
    const name=pick(r,['title','titulo','nombre','activity name','activityname','nombre de actividad','nombredeactividad'])||type;
    const avgHr=metric(r,['avg hr','avghr','average heart rate','averageheartrate','frecuencia cardiaca media','frecuenciacardiacamedia','fc media','fcmedia']);
    const maxHr=metric(r,['max hr','maxhr','maximum heart rate','maximumheartrate','frecuencia cardiaca maxima','frecuenciacardiacamaxima']);
    const ascentM=metric(r,['total ascent','totalascent','elevation gain','elevationgain','ascenso total','ascensototal']);
    const cadence=metric(r,['avg run cadence','avgruncadence','avg cadence','avgcadence','cadencia media de carrera','cadenciamediadecarrera']);
    const aerobic=metric(r,['aerobic te','aerobicte','aerobic training effect','aerobictrainingeffect','aerobica']);
    const anaerobic=metric(r,['anaerobic te','anaerobicte','anaerobic training effect','anaerobictrainingeffect','anaerobica']);
    const load=metric(r,['exercise load','exerciseload','training load','trainingload','carga de ejercicio','cargadeejercicio']);
    return {id:id?'garmin:'+String(id):'csv:'+date+':'+(distance??'x')+':'+(duration??'x'),source,date,type:String(type).slice(0,80),title:String(name).slice(0,150),distanceKm:distance,durationSeconds:duration,avgHr,maxHr,ascentM,cadence,aerobic,anaerobic,load,notes:'',testDistanceKm:null,testDurationSeconds:null,dateConfidence:'confirmada'};
  }
  function key(a){return String(a?.id||'');}
  function equivalent(a,b){
    if(a.source==='garmin-csv' && b.source==='garmin-csv' && a.id===b.id)return true;
    if(!a.date || !b.date || a.date!==b.date)return false;
    if(a.distanceKm===null||b.distanceKm===null||a.durationSeconds===null||b.durationSeconds===null)return false;
    return Math.abs(a.distanceKm-b.distanceKm)<=0.03 && Math.abs(a.durationSeconds-b.durationSeconds)<=20;
  }
  function merge(current,incoming){
    const out=[...current];let added=0,updated=0;
    for(const a of incoming){
      if(!a||!validDay(a.date)||!(a.durationSeconds>=0||a.distanceKm>=0))continue;
      const index=out.findIndex(b=>(key(a)&&key(b)===key(a))||equivalent(a,b));
      if(index<0){out.push(a);added++;continue;}
      const prev=out[index];
      const fromGarmin=a.source==='garmin-csv'||a.source==='garmin-api';
      const next={...prev};
      for(const [k,v] of Object.entries(a))if(v!==null&&v!==undefined&&v!==''){
        if(k==='notes'&&prev.notes)continue;
        if(k==='id'&&prev.source==='historico-chat' && fromGarmin)next.id=a.id;
        else if(k==='source'&&fromGarmin)next.source=a.source;
        else if(next[k]===null||next[k]===undefined||next[k]===''||fromGarmin)next[k]=v;
      }
      out[index]=next;updated++;
    }
    out.sort((a,b)=>b.date.localeCompare(a.date));
    return {activities:out,added,updated};
  }
  return {number,seconds,day,validDay,delimited,normalise,merge};
});