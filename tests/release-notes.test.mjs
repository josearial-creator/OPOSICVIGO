import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configuration,secretSyncNeeded} from '../scripts/activate-notes-20261114.mjs';
const settings={bindings:[{name:'db',type:'d1',id:'7752c042-d26f-4a4b-8b81-5bdbf17ff0fd'},{name:'RUMBO_ACCESS_TOKEN',type:'secret_text'},{name:'OTHER',type:'kv_namespace',namespace_id:'old'},{name:'ALLOWED_ORIGIN',type:'plain_text',text:'https://existing.example'}]};
test('release preserves existing stores and origins without materializing secrets',()=>{const c=configuration(settings,'new');assert.equal(c.d1_databases[0].database_id,settings.bindings[0].id);assert.deepEqual(c.kv_namespaces,[{binding:'OTHER',id:'old'},{binding:'NOTES_KV',id:'new'}]);assert(c.vars.ALLOWED_ORIGIN.includes('https://existing.example'));assert.equal(c.keep_vars,true);assert.equal(c.vars.RUMBO_ACCESS_TOKEN,undefined);});
test('release refuses unknown bindings, changed D1 and missing secret',()=>{assert.throws(()=>configuration({bindings:[...settings.bindings,{name:'object',type:'durable_object_namespace'}]},'new'));assert.throws(()=>configuration({bindings:settings.bindings.filter(b=>b.type!=='d1')},'new'));assert.throws(()=>configuration({bindings:settings.bindings.filter(b=>b.type!=='secret_text')},'new'));});
test('release refuses replacing an existing notes namespace',()=>{const bound={bindings:[...settings.bindings,{name:'NOTES_KV',type:'kv_namespace',namespace_id:'existing'}]};assert.throws(()=>configuration(bound,'new'));assert.equal(configuration(bound,'existing').kv_namespaces.filter(b=>b.binding==='NOTES_KV').length,1);});

test('se instala el secreto solo cuando falta y los bindings son seguros',()=>{
 const missing={bindings:settings.bindings.filter(b=>b.name!=='RUMBO_ACCESS_TOKEN')};
 assert.equal(secretSyncNeeded(missing),true);
 assert.equal(secretSyncNeeded(settings),false);
});
test('se bloquea la sincronización si faltan D1 o hay un binding desconocido',()=>{
 const missing={bindings:settings.bindings.filter(b=>b.name!=='RUMBO_ACCESS_TOKEN')};
 assert.throws(()=>secretSyncNeeded({bindings:missing.bindings.filter(b=>b.type!=='d1')}));
 assert.throws(()=>secretSyncNeeded({bindings:[...missing.bindings,{name:'OBJECT',type:'durable_object_namespace'}]}));
 assert.throws(()=>secretSyncNeeded({bindings:[...missing.bindings,{name:'RUMBO_ACCESS_TOKEN',type:'plain_text'}]}));
});
