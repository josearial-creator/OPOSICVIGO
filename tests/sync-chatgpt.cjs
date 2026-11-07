const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH==='bundled'?undefined:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox']});
  const page=await browser.newPage({acceptDownloads:true});
  let inbox={version:1,items:[]};
  await page.route('https://raw.githubusercontent.com/**',route=>{
    if(route.request().url().includes('/rumbo-sync/inbox.json'))return route.fulfill({json:inbox});
    return route.fulfill({json:[{puesto:'Prueba',organismo:'Vigo'}]});
  });
  try{
    await page.goto('http://127.0.0.1:8086');
    await page.locator('#rs-pass').fill('frase-recup-muy-larga-2026');
    const download=page.waitForEvent('download');
    await page.locator('#rs-generate').click();
    const file=await download;
    assert.match(file.suggestedFilename(),/^rumbo-recuperacion-/);
    const pub=JSON.parse(await page.locator('#rs-public').inputValue());
    assert.equal(pub.type,'rumbo-sync-public-key');
    assert.match(pub.keyId,/^[a-f0-9]{24}$/);
    assert.equal(await page.locator('#rs-active').isVisible(),true);
    const note={id:'notatest123456',date:'2026-10-26',context:'Estudio de oposiciones, 25 minutos.',response:'Terminé y paré a tiempo.',felt:'',improve:'Repetir sin compensar el descanso.'};
    const envelope=await page.evaluate(async({pub,note})=>{
      const bytes=x=>Uint8Array.from(atob(x),c=>c.charCodeAt(0));
      const b64=x=>btoa(String.fromCharCode(...new Uint8Array(x)));
      const pk=await crypto.subtle.importKey('spki',bytes(pub.spki),{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
      const aes=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12));
      const aesKey=await crypto.subtle.importKey('raw',aes,{name:'AES-GCM'},false,['encrypt']);
      const wrappedKey=await crypto.subtle.encrypt({name:'RSA-OAEP'},pk,aes);
      const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},aesKey,new TextEncoder().encode(JSON.stringify(note)));
      return {id:note.id,keyId:pub.keyId,wrappedKey:b64(wrappedKey),iv:b64(iv),ciphertext:b64(ciphertext)};
    },{pub,note});
    inbox={version:1,items:[envelope]};
    assert.equal(JSON.stringify(inbox).includes(note.context),false);
    await Promise.all([
      page.waitForEvent('framenavigated',frame=>frame===page.mainFrame()),
      page.locator('#rs-fetch').click()
    ]);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('rumbo-evolucion-v1')||'{}').real?.some(x=>x.id==='chatgpt-notatest123456'));
    let real=await page.evaluate(()=>JSON.parse(localStorage.getItem('rumbo-evolucion-v1')).real);
    assert.equal(real.filter(x=>x.id==='chatgpt-notatest123456').length,1);
    assert.equal(real.find(x=>x.id==='chatgpt-notatest123456').context,note.context);
    await page.reload();
    await page.locator('#rs-fetch').click();
    real=await page.evaluate(()=>JSON.parse(localStorage.getItem('rumbo-evolucion-v1')).real);
    assert.equal(real.filter(x=>x.id==='chatgpt-notatest123456').length,1);
    console.log('Rumbo ChatGPT: cifrado, descarga, importación y deduplicación OK');
  } finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
