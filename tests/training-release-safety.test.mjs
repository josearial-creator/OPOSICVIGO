import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const release=readFileSync(new URL('../scripts/release-training-production.mjs',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/release-training-production.yml',import.meta.url),'utf8');

test('la publicación requiere autorización explícita y la rama principal',()=>{
 assert.match(release,/PR36_RELEASE_CONFIRM!=='PUBLICAR-ENTRENAMIENTO-PR36'/);
 assert.match(release,/const authorizedBranch=new Set\(\['refs\/heads\/main'\]\)/);
 assert.match(workflow,/on:\s*\n  workflow_dispatch:/);
 assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
 assert.doesNotMatch(workflow,/^  push:/m);
 assert.doesNotMatch(workflow,/^  pull_request:/m);
});

test('el script conserva KV, D1, secretos y controla respuestas anónimas tras desplegar',()=>{
 assert.match(release,/configuration\(before,notes\.namespace_id\)/);
 assert.match(release,/--keep-vars/);
 assert.match(release,/fingerprint\(currentBinding\)===fingerprint\(b\)/);
 assert.match(release,/for\(let i=0;i<40;i\+\+\)/);
 assert.match(release,/verified>=2/);
 assert.match(release,/notesRes\.status===401&&trainingRes\.status===401/);
 assert.match(release,/Una ruta privada respondió sin autenticación/);
 assert.doesNotMatch(release,/\bsecrets\/RUMBO_ACCESS_TOKEN\b/);
});
