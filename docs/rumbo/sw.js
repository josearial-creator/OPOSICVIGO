/* Aplicación pública: solo se guarda en caché el código estático, nunca datos personales o respuestas de API. */
const CACHE='rumbo-shell-v2';
const ASSETS=['./','./index.html','./styles.css','./asistente.css','./estudio.css','./evolucion.css','./organizacion.css','./sync-chatgpt.css','./hoy.js','./app.js','./estudio.js','./evolucion.js','./voz-ia.js','./balance-semanal.js','./sync-chatgpt.js','./asistente.js','./organizacion.js','./mobile.js','./copias.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
const paths=new Set(ASSETS.map(p=>new URL(p,self.registration.scope).pathname));
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rumbo-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin||!paths.has(url.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(req.mode==='navigate'){
      try{const res=await fetch(req);if(res.ok)await cache.put(new URL('./index.html',self.registration.scope),res.clone());return res;}
      catch{return await cache.match(new URL('./index.html',self.registration.scope))||Response.error();}
    }
    const cached=await cache.match(req);if(cached)return cached;
    const res=await fetch(req);if(res.ok)await cache.put(req,res.clone());return res;
  })());
});
