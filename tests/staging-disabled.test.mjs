import test from 'node:test';
import assert from 'node:assert/strict';
import disabled from '../rumbo-worker/staging-disabled.mjs';
test('Worker temporal desactivado no expone rutas ni datos',async()=>{
 const res=await disabled.fetch(new Request('https://rumbo-entrenamiento-pr36-test.jose-arial.workers.dev/training'));
 assert.equal(res.status,410);
 assert.equal(res.headers.get('Cache-Control'),'no-store');
 const body=await res.json();
 assert.equal(body.error,'Prueba de Entrenamiento desactivada');
 assert.equal(JSON.stringify(body).includes('secret'),false);
});
