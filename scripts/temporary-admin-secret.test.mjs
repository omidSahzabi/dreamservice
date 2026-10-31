import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {load} from './test-loader.mjs';

test('owner generator makes fresh compatible 48-hour credentials privately without overwrite or disclosure',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'dreamservice-temp-admin-secret-'));
 const files=['first.json','second.json'].map(name=>path.join(directory,name));
 t.after(()=>{for(const file of files)if(fs.existsSync(file))fs.unlinkSync(file);fs.rmdirSync(directory);});
 const generate=file=>spawnSync(process.execPath,['scripts/create-temporary-admin-secret.mjs',file],{encoding:'utf8',windowsHide:true});
 const outputs=files.map(generate);for(const result of outputs)assert.equal(result.status,0);
 const [a,b]=files.map(file=>JSON.parse(fs.readFileSync(file,'utf8')));
 assert.match(a.password,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(a.password,b.password);assert.notEqual(a.TEMP_ADMIN_LOGIN_HASH,b.TEMP_ADMIN_LOGIN_HASH);
 assert.equal(Date.parse(a.TEMP_ADMIN_LOGIN_EXPIRES_AT)-Date.parse(a.TEMP_ADMIN_LOGIN_STARTED_AT),48*3600000);
 for(const result of outputs)for(const secret of [a.password,b.password,a.TEMP_ADMIN_LOGIN_HASH,b.TEMP_ADMIN_LOGIN_HASH]){assert.ok(!result.stdout.includes(secret));assert.ok(!result.stderr.includes(secret));}
 const {verifyPreviewPassword}=load('src/lib/auth/preview-password.ts');assert.equal(await verifyPreviewPassword(a.password,a.TEMP_ADMIN_LOGIN_HASH),true);assert.equal(await verifyPreviewPassword(b.password,a.TEMP_ADMIN_LOGIN_HASH),false);
 const before=fs.readFileSync(files[0]);assert.notEqual(generate(files[0]).status,0);assert.ok(before.equals(fs.readFileSync(files[0])));
 assert.notEqual(generate(path.resolve('package.json')).status,0);
});
