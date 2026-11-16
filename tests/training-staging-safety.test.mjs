import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const code=readFileSync(new URL('../scripts/verify-training-cloudflare-isolated.mjs',import.meta.url),'utf8');
test('el secreto temporal se instala por Wrangler dirigido solo a staging',()=>{
 assert.match(code,/const staging='fancy-sea-977drumbo-entrenamiento-pr36-test'/);
 assert.match(code,/const args=\['secret','put','RUMBO_ACCESS_TOKEN','--config','release-training-test\.generated\.json','--name',staging\]/);
 assert.match(code,/input:password\+'\\n'/);
 assert.match(code,/putStagingSecret\(\);/);
 assert.doesNotMatch(code,/cf\(workerUrl\+'\/secrets','PUT'/);
 assert.doesNotMatch(code,/wrangler\.toml/);
});
test('requiere Worker vacío y restaura el modo inerte antes de borrar KV',()=>{
 assert.match(code,/if\(bindings\.length>0\)throw Error/);
 assert.match(code,/wrangler\('release-training-disabled\.generated\.json'\)/);
 assert.match(code,/if\(!modified\|\|resetConfirmed\)/);
});
