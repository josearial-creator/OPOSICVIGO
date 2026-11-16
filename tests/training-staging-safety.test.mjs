import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const code=readFileSync(new URL('../scripts/verify-training-cloudflare-isolated.mjs',import.meta.url),'utf8');

test('el Worker de prueba tiene nombre restringido y no utiliza el de producción',()=>{
 assert.match(code,/const staging=String\(process\.env\.PR36_STAGING_WORKER_NAME\|\|''\)\.trim\(\)/);
 assert.match(code,/if\(staging!=='snowy-river-c4rumbo-entrenamiento-pr36-test2a6'\)/);
 assert.match(code,/if\(bindings\.length>0\)throw Error/);
 assert.doesNotMatch(code,/const staging='rumbo-entrenador'/);
});

test('el secreto temporal utiliza Wrangler con su config propia y no el Worker principal',()=>{
 assert.match(code,/const args=\['secret','put','RUMBO_ACCESS_TOKEN','--config','release-training-test\.generated\.json','--name',staging\]/);
 assert.match(code,/input:password\+'\\n'/);
 assert.match(code,/putStagingSecret\(\);/);
 assert.doesNotMatch(code,/cf\(workerUrl\+'\/secrets','PUT'/);
 assert.doesNotMatch(code,/wrangler\.toml/);
});

test('solo se elimina Worker de prueba con binding KV de la ejecución y después su KV',()=>{
 assert.match(code,/const allowed=new Set\(\['RUMBO_ACCESS_TOKEN','NOTES_KV','ALLOWED_ORIGIN','FREE_TIER_CONFIRMED'\]\)/);
 assert.match(code,/kv\.namespace_id!==namespaceId/);
 assert.match(code,/if\(check\.status===404\)\{absent=true;break;\}/);
 assert.match(code,/if\(namespaceId\)\{\s*if\(absent\)\{/);
 assert.match(code,/if\(check\.status!==404\)throw Error\('No se confirmó ausencia del KV/);
});
