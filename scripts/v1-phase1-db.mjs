// Local-only backup/restore and migration trial. Deliberately NO original apply mode.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import dotenv from 'dotenv';

const root=path.resolve(import.meta.dirname,'..');
const verifyOnly=process.argv[3]==='verify-original';
const run=process.argv[2]?path.resolve(root,process.argv[2]):path.join(root,'.backups','v1-phase1-'+Date.now());
assert.ok(run.startsWith(path.join(root,'.backups','v1-phase1-')));
fs.mkdirSync(run,{recursive:true});
const binary='C:/Program Files/PostgreSQL/18/bin';
let connection=process.env.DATABASE_URL;
for(const file of ['.env.development.local','.env.local','.env.development','.env']) if(!connection&&fs.existsSync(path.join(root,file))) connection=dotenv.parse(fs.readFileSync(path.join(root,file),'utf8')).DATABASE_URL;
const original=new URL(connection);
assert.ok(['postgres:','postgresql:'].includes(original.protocol)&&['localhost','127.0.0.1','[::1]'].includes(original.hostname));
assert.equal(original.pathname,'/dreamservice');
const testDatabase='dreamservice_phase1_test_'+randomUUID().replaceAll('-','');
const hash=data=>createHash('sha256').update(data).digest('hex');
const quote=value=>'"'+value.replaceAll('"','""')+'"';
const state={testDatabase,stage:'preflight',originalApplied:false};
const save=()=>fs.writeFileSync(path.join(run,'state.json'),JSON.stringify(state,null,2)+'\n');
function environment(database,readOnly=false){
  assert.ok(database==='dreamservice'||database==='postgres'||database===testDatabase);
  const url=new URL(original);url.pathname='/'+database;
  return {...process.env,DATABASE_URL:url.toString(),PGHOST:original.hostname,PGPORT:original.port||'5432',PGUSER:decodeURIComponent(original.username),PGPASSWORD:decodeURIComponent(original.password),PGDATABASE:database,
    PGCONNECT_TIMEOUT:'5',PGOPTIONS:'-c statement_timeout=60000 -c lock_timeout=5000'+(readOnly?' -c default_transaction_read_only=on':''),
    CHECKPOINT_DISABLE:'1',PRISMA_GENERATE_SKIP_AUTOINSTALL:'true',SECURITY_SMS_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1'};
}
function execute(file,args,database,label,readOnly=false){
  const result=spawnSync(file,args,{cwd:run,env:environment(database,readOnly),encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024});
  fs.writeFileSync(path.join(run,label+'.log'),(result.stdout??'')+(result.stderr??''));
  assert.ok(!result.error&&result.status===0,label+' failed; private evidence retained');
  return result.stdout.trim();
}
function query(database,sql,label='query'){
  return JSON.parse(execute(path.join(binary,'psql.exe'),['-X','-A','-t','-v','ON_ERROR_STOP=1','-c',sql],database,label,true));
}
function snapshot(database){
  const tables=query(database,`SELECT coalesce(json_agg(t ORDER BY schema,name),'[]') FROM (SELECT table_schema AS schema,table_name AS name FROM information_schema.tables WHERE table_schema IN ('entity','upro','public') AND table_type='BASE TABLE') t`);
  const rows={};for(const table of tables){
    const value=table.schema==='entity'&&table.name==='users'?`to_jsonb(t)-'username'`:'to_jsonb(t)';
    rows[table.schema+'.'+table.name]=query(database,`SELECT json_build_object('count',count(*),'hash',md5(coalesce(string_agg(h,'' ORDER BY h),''))) FROM (SELECT md5((${value})::text) AS h FROM ${quote(table.schema)}.${quote(table.name)} t) s`);
  }
  const indexes=query(database,`SELECT coalesce(json_agg(i ORDER BY schema,name),'[]') FROM (SELECT n.nspname AS schema,c.relname AS name,pg_get_indexdef(c.oid) AS definition,x.indisvalid AS valid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_index x ON x.indexrelid=c.oid WHERE n.nspname IN ('entity','upro','public')) i`);
  const sequences={};for(const s of query(database,`SELECT coalesce(json_agg(s ORDER BY schemaname,sequencename),'[]') FROM pg_sequences s WHERE schemaname IN ('entity','upro','public')`)) sequences[s.schemaname+'.'+s.sequencename]=query(database,`SELECT row_to_json(t) FROM (SELECT last_value,is_called FROM ${quote(s.schemaname)}.${quote(s.sequencename)}) t`);
  const migrations=query(database,'SELECT json_agg(m ORDER BY migration_name) FROM entity._prisma_migrations m');
  return {rows,indexes,sequences,migrations};
}
function preserved(before,after,migrated=false){
  for(const [table,row]of Object.entries(before.rows))if(!migrated||table!=='entity._prisma_migrations')assert.deepEqual(after.rows[table],row,table+' changed');
  for(const index of before.indexes)assert.deepEqual(after.indexes.find(i=>i.schema===index.schema&&i.name===index.name),index,'Existing index changed');
  assert.deepEqual(after.sequences,before.sequences);
  for(const migration of before.migrations)assert.ok(after.migrations.some(m=>JSON.stringify(m)===JSON.stringify(migration)),'Historical migration changed');
}
try{
  if(verifyOnly){
    const previous=JSON.parse(fs.readFileSync(path.join(run,'state.json'),'utf8'));
    preserved(previous.before,snapshot('dreamservice'));
    for(const migration of previous.history)assert.equal(hash(fs.readFileSync(path.join(root,'prisma/migrations',migration.name,'migration.sql'))),migration.checksum);
    assert.equal(hash(fs.readFileSync(path.join(run,'before-phase1.dump'))),previous.backup.sha256);
    console.log(JSON.stringify({originalPreserved:true,allOriginalTableHashes:true,existingIndexesSequencesMigrations:true,backupChecksumVerified:true,originalApplied:false}));
  }else{
  state.before=snapshot('dreamservice');
  state.history=state.before.migrations.map(m=>{assert.ok(m.finished_at&&!m.rolled_back_at);const checksum=hash(fs.readFileSync(path.join(root,'prisma/migrations',m.migration_name,'migration.sql')));assert.equal(checksum,m.checksum);return {name:m.migration_name,checksum};});
  state.openConflicts=query('dreamservice',`SELECT coalesce(json_agg(c),'[]') FROM (SELECT client_id,array_agg(order_id ORDER BY order_id) AS order_ids,count(*)::int AS count FROM entity.orders WHERE status IN ('PENDING','NEGOTIATING','PROCESSING') GROUP BY client_id HAVING count(*)>1) c`);
  state.openOrderIndexBlocked=state.openConflicts.length>0;save();
  state.stage='backup';save();
  const archive=path.join(run,'before-phase1.dump');
  execute(path.join(binary,'pg_dump.exe'),['--format=custom','--no-owner','--no-privileges','--file',archive],'dreamservice','backup',true);
  const list=execute(path.join(binary,'pg_restore.exe'),['--list',archive],'dreamservice','backup-list',true);assert.ok(list.includes('TABLE DATA'));
  state.backup={sha256:hash(fs.readFileSync(archive)),bytes:fs.statSync(archive).size};assert.ok(state.backup.bytes>0);save();
  state.stage='restore';save();
  execute(path.join(binary,'createdb.exe'),['--template=template0',testDatabase],'postgres','create-isolated');
  const sql=path.join(run,'restore.sql');execute(path.join(binary,'pg_restore.exe'),['--no-owner','--no-privileges','--file',sql,archive],testDatabase,'extract');
  fs.writeFileSync(sql,fs.readFileSync(sql,'utf8').replace(/^SET transaction_timeout = 0;\r?\n/gm,''));
  execute(path.join(binary,'psql.exe'),['-X','-v','ON_ERROR_STOP=1','--single-transaction','--file',sql],testDatabase,'restore');
  assert.equal(hash(fs.readFileSync(archive)),state.backup.sha256);preserved(state.before,snapshot(testDatabase));state.restoreVerified=true;save();
  state.stage='identity-trial';save();
  const schema=path.join(run,'prisma');fs.mkdirSync(schema);fs.copyFileSync(path.join(root,'prisma/schema.prisma'),path.join(schema,'schema.prisma'));fs.cpSync(path.join(root,'prisma/migrations'),path.join(schema,'migrations'),{recursive:true});
  execute(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy','--schema',path.join(schema,'schema.prisma')],testDatabase,'migration-trial');
  const after=snapshot(testDatabase);preserved(state.before,after,true);
  assert.equal(after.migrations.length,state.before.migrations.length+1);
  assert.equal(query(testDatabase,`SELECT count(*)::int FROM entity.users WHERE username IS NOT NULL`),0);
  execute(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','status','--schema',path.join(schema,'schema.prisma')],testDatabase,'trial-status');
  preserved(state.before,snapshot('dreamservice'));
  state.trialVerified=true;state.originalPreserved=true;state.stage='approval-required';save();
  console.log(JSON.stringify({evidence:path.relative(root,run),testDatabase,backup:state.backup,restoreVerified:true,identityTrialVerified:true,originalPreserved:true,openOrderIndexBlocked:state.openOrderIndexBlocked,openConflicts:state.openConflicts,originalApplied:false}));
  }
}catch(error){if(!verifyOnly)save();console.error(JSON.stringify({STOP:true,stage:state.stage,reason:error instanceof assert.AssertionError?error.message.split('\n')[0]:'Operation failed; inspect private evidence',originalApplied:false}));process.exitCode=1;}
