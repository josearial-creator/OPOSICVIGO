(() => {
  'use strict';
  // Sesión compartida solo en memoria; no se persisten credenciales.
  let credential='';
  const listeners=new Set();
  const notify=()=>{for(const fn of listeners){try{fn(Boolean(credential));}catch{}}};
  window.RumboSession=Object.freeze({
    available:()=>Boolean(credential),
    use:()=>credential,
    unlock(value){
      if(typeof value!=='string'||!value)return;
      credential=value;notify();
    },
    lock(){
      credential='';notify();
    },
    subscribe(fn){
      if(typeof fn!=='function')return ()=>{};
      listeners.add(fn);
      return ()=>listeners.delete(fn);
    }
  });
})();
