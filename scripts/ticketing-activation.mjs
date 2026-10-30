// Staged, local-only additive activation. Credentials and rows are never printed.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID,randomBytes} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const mode=process.argv[2]??'inspect';
const run=process.argv[3]?path.resolve(root,process.argv[3]):path.join(root,'.backups','ticketing-activation-'+new Date().toISOString().replace(/\D/g,''));
assert.ok(run.startsWith(path.join(root,'.backups')+path.sep+'ticketing-activation-'));
fs.mkdirSync(run,{recursive:true});const stateFile=path.join(run,'state.json');
const state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):{};
const save=()=>fs.writeFileSync(stateFile,JSON.stringify(state,null,2)+'\n');
const binary='C:/Program Files/PostgreSQL/18/bin';const migration='202610290002_support_ticketing';
const hash=data=>createHash('sha256').update(data).digest('hex');
const equal=(left,right)=>assert.deepEqual(left,right);
const match=fs.readFileSync(path.join(root,'.env'),'utf8').match(/^DATABASE_URL\s*=\s*(.+)$/m);assert.ok(match);
const target=new URL(match[1].trim().replace(/^(["'])(.*)\1$/,'$2'));
assert.ok(['postgres:','postgresql:'].includes(target.protocol)&&['localhost','127.0.0.1','[::1]'].includes(target.hostname));
assert.equal(decodeURIComponent(target.pathname.slice(1)),'dreamservice');assert.equal(target.port||'5432','5432');
function environment(name,readOnly=false){
  assert.ok(name==='dreamservice'||name==='postgres'||/^dreamservice_tickets_test_[a-f0-9]{32}$/.test(name));
  const url=new URL(target);url.pathname='/'+name;
  return {...process.env,DATABASE_URL:url.toString(),PGHOST:target.hostname,PGPORT:target.port||'5432',PGUSER:decodeURIComponent(target.username),PGPASSWORD:decodeURIComponent(target.password),PGDATABASE:name,
    PGCONNECT_TIMEOUT:'5',PGOPTIONS:'-c statement_timeout=60000 -c lock_timeout=5000'+(readOnly?' -c default_transaction_read_only=on':''),
    PRISMA_SCHEMA_ENGINE_BINARY:path.join(root,'node_modules/@prisma/engines/schema-engine-windows.exe'),PRISMA_QUERY_ENGINE_LIBRARY:path.join(root,'node_modules/@prisma/engines/query_engine-windows.dll.node'),
    PRISMA_GENERATE_SKIP_AUTOINSTALL:'true',CHECKPOINT_DISABLE:'1',SECURITY_SMS_ENABLED:'false'};
}
function execute(file,args,env,label){
  const result=spawnSync(file,args,{cwd:run,env,encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024});
  fs.writeFileSync(path.join(run,label+'.log'),(result.stdout??'')+(result.stderr??''));
  assert.ok(!result.error&&result.status===0,label+' failed; STOP, private evidence retained');return result.stdout.trim();
}
function query(name,sql){return JSON.parse(execute(path.join(binary,'psql.exe'),['-X','-A','-t','-v','ON_ERROR_STOP=1','-c',sql],environment(name,true),'query'));}
const quote=value=>'"'+value.replaceAll('"','""')+'"';
function checksums(){return Object.fromEntries(fs.readdirSync(path.join(root,'prisma/migrations'),{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>[entry.name,hash(fs.readFileSync(path.join(root,'prisma/migrations',entry.name,'migration.sql')))]));}
function history(name,count){
  const rows=query(name,`SELECT json_agg(m ORDER BY migration_name) FROM (SELECT migration_name,checksum,finished_at IS NOT NULL AND rolled_back_at IS NULL AS applied FROM entity._prisma_migrations) m`);
  assert.equal(rows.length,count);const disk=checksums();assert.ok(rows.every(row=>row.applied&&disk[row.migration_name]===row.checksum));return rows;
}
function snapshot(name){
  const rows=query(name,`SELECT json_agg(t ORDER BY schema,name) FROM (SELECT table_schema AS schema,table_name AS name FROM information_schema.tables WHERE table_schema IN ('entity','public','upro') AND table_type='BASE TABLE') t`);
  const tables={};for(const row of rows)tables[row.schema+'.'+row.name]=query(name,`SELECT json_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(hash,'' ORDER BY hash),''))) FROM (SELECT md5(to_jsonb(t)::text) AS hash FROM ${quote(row.schema)}.${quote(row.name)} t) rows`);
  const indexes=query(name,`SELECT json_agg(i ORDER BY schema,name) FROM (SELECT n.nspname AS schema,c.relname AS name,c.oid,c.relfilenode,pg_get_indexdef(c.oid) AS definition,x.indisvalid AS valid,x.indisready AS ready FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_index x ON x.indexrelid=c.oid WHERE n.nspname IN ('entity','public','upro')) i`);
  const sequences={};for(const row of query(name,`SELECT json_agg(s ORDER BY schemaname,sequencename) FROM pg_sequences s WHERE schemaname IN ('entity','public','upro')`))sequences[row.schemaname+'.'+row.sequencename]={...row,...query(name,`SELECT row_to_json(s) FROM (SELECT last_value,is_called FROM ${quote(row.schemaname)}.${quote(row.sequencename)}) s`)};
  const migrations=query(name,`SELECT json_agg(m ORDER BY migration_name) FROM entity._prisma_migrations m`);
  return {tables,indexes,sequences,migrations};
}
function preserved(before,after,{restored=false,activated=false}={}){
  for(const [name,value] of Object.entries(before.tables)){if(activated&&name==='entity._prisma_migrations')continue;equal(value,after.tables[name]);}
  for(const index of before.indexes){const actual=after.indexes.find(item=>item.schema===index.schema&&item.name===index.name);assert.ok(actual);if(restored){const {oid,relfilenode,...logical}=index;const {oid:otherOid,relfilenode:otherNode,...other}=actual;void oid;void relfilenode;void otherOid;void otherNode;equal(logical,other);}else equal(index,actual);}
  for(const [name,value]of Object.entries(before.sequences))equal(value,after.sequences[name]);
  for(const row of before.migrations)assert.ok(after.migrations.some(candidate=>JSON.stringify(candidate)===JSON.stringify(row)));
  if(!activated){equal(Object.keys(before.tables),Object.keys(after.tables));assert.equal(before.indexes.length,after.indexes.length);equal(Object.keys(before.sequences),Object.keys(after.sequences));}
}
function additive(){
  const bytes=fs.readFileSync(path.join(root,'prisma/migrations',migration,'migration.sql'));
  const statements=bytes.toString('utf8').replace(/^\s*--.*$/gm,'').split(';').map(value=>value.trim()).filter(Boolean);
  assert.equal(statements.length,21);
  assert.ok(statements.every(sql=>/^(?:BEGIN|COMMIT)$/.test(sql)||/^SET LOCAL (?:lock_timeout|statement_timeout) = '\d+s'$/.test(sql)||
    /^CREATE TYPE "entity"\."SupportTicket(?:Status|Priority)" AS ENUM/.test(sql)||/^CREATE TABLE "entity"\."support_ticket(?:s|_messages|_notifications)" \(/.test(sql)||
    /^CREATE (?:UNIQUE )?INDEX "support_ticket[a-zA-Z_]+" ON "entity"\."support_ticket(?:s|_messages|_notifications)"\(/.test(sql)));
  return hash(bytes);
}
function prisma(name,operation,label){
  const directory=path.join(run,'prisma');fs.mkdirSync(directory,{recursive:true});
  fs.copyFileSync(path.join(root,'prisma/schema.prisma'),path.join(directory,'schema.prisma'));fs.cpSync(path.join(root,'prisma/migrations'),path.join(directory,'migrations'),{recursive:true});
  return execute(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate',operation,'--schema',path.join(directory,'schema.prisma')],environment(name,operation==='status'),label);
}
function activated(before,after){
  preserved(before,after,{activated:true});assert.equal(Object.keys(after.tables).length,Object.keys(before.tables).length+3);
  assert.equal(after.indexes.length,before.indexes.length+15);assert.ok(after.indexes.every(index=>index.valid&&index.ready));
  assert.equal(Object.keys(after.sequences).length,Object.keys(before.sequences).length+1);
  for(const table of ['support_tickets','support_ticket_messages','support_ticket_notifications'])assert.equal(after.tables['entity.'+table]?.count,0);
  assert.equal(after.migrations.length,before.migrations.length+1);
}
try{
  if(mode==='inspect'){
    assert.ok(!fs.existsSync(stateFile),'Use a fresh activation evidence directory');
    state.historical=history('dreamservice',5);state.migrationChecksum=additive();state.diskChecksums=checksums();state.before=snapshot('dreamservice');
    assert.ok(!state.before.tables['entity.support_tickets']);state.inspected=true;save();
    console.log(JSON.stringify({historicalChecksumsVerified:5,strictlyAdditive:true,tables:Object.keys(state.before.tables).length,indexes:state.before.indexes.length,evidence:path.relative(root,run)}));
  }else if(mode==='prepare'){
    assert.ok(state.inspected&&!state.backup);history('dreamservice',5);equal(checksums(),state.diskChecksums);preserved(state.before,snapshot('dreamservice'));
    const archive=path.join(run,'before-ticketing.dump');assert.ok(!fs.existsSync(archive));
    execute(path.join(binary,'pg_dump.exe'),['--format=custom','--no-owner','--no-privileges','--file',archive],environment('dreamservice',true),'backup');
    const list=execute(path.join(binary,'pg_restore.exe'),['--list',archive],environment('dreamservice',true),'backup-list');assert.ok(list.includes('TABLE DATA'));
    state.backup={bytes:fs.statSync(archive).size,sha256:hash(fs.readFileSync(archive))};assert.ok(state.backup.bytes>0);save();
    state.testDatabase='dreamservice_tickets_test_'+randomUUID().replaceAll('-','');save();
    const sql=path.join(run,'restore.sql');execute(path.join(binary,'pg_restore.exe'),['--no-owner','--no-privileges','--file',sql,archive],environment(state.testDatabase),'extract');
    // pg_restore 18 emits one SET unsupported by the verified local PG15 server.
    fs.writeFileSync(sql,fs.readFileSync(sql,'utf8').replace(/^SET transaction_timeout = 0;\r?\n/gm,''));
    execute(path.join(binary,'createdb.exe'),['--template=template0',state.testDatabase],environment('postgres'),'create-isolated');
    execute(path.join(binary,'psql.exe'),['-X','-v','ON_ERROR_STOP=1','--single-transaction','--file',sql],environment(state.testDatabase),'restore');
    equal(hash(fs.readFileSync(archive)),state.backup.sha256);const restored=snapshot(state.testDatabase);preserved(state.before,restored,{restored:true});history(state.testDatabase,5);state.restoreVerified=true;save();
    prisma(state.testDatabase,'deploy','trial-deploy');const after=snapshot(state.testDatabase);activated(restored,after);history(state.testDatabase,6);prisma(state.testDatabase,'status','trial-status');
    state.trialVerified=true;state.trialSnapshot=after;save();console.log(JSON.stringify({backup:state.backup,isolatedRestoreVerified:true,testDatabase:state.testDatabase,trialPassed:true,existingDataIndexesSequencesPreserved:true}));
  }else if(mode==='integration'||mode==='browser'){
    assert.ok(state.trialVerified);history(state.testDatabase,6);const env=environment(state.testDatabase);env.TICKETS_TEST_DATABASE_URL=env.DATABASE_URL;env.TICKETS_TEST_DATABASE_NAME=state.testDatabase;env.TICKETS_EVIDENCE_DIRECTORY=run;
    env.SECURITY_OTP_KEY=randomBytes(32).toString('hex');env.PUBLIC_TEAM_PROFILE_IDS='';
    const args=mode==='integration'?['--test','--test-reporter=spec',path.join(root,'scripts/ticketing.integration.mjs')]:[path.join(root,'scripts/ticketing-browser.mjs')];
    const output=execute(process.execPath,args,env,mode);state[mode+'Verified']=true;save();console.log(output);
  }else if(mode==='apply'){
    assert.ok(state.backup&&state.restoreVerified&&state.trialVerified&&state.integrationVerified&&state.browserVerified&&!state.originalAttempted);
    equal(checksums(),state.diskChecksums);equal(additive(),state.migrationChecksum);equal(hash(fs.readFileSync(path.join(run,'before-ticketing.dump'))),state.backup.sha256);
    history('dreamservice',5);const immediate=snapshot('dreamservice');preserved(state.before,immediate);state.originalAttempted=true;save();
    prisma('dreamservice','deploy','original-deploy');state.originalApplied=true;save();const after=snapshot('dreamservice');activated(immediate,after);history('dreamservice',6);
    prisma('dreamservice','status','original-status');state.after=after;state.originalIntegrityVerified=true;state.completedAt=new Date().toISOString();save();
    console.log(JSON.stringify({active:true,appliedMigrations:6,existingTablesPreserved:Object.keys(immediate.tables).length,existingIndexesPreserved:immediate.indexes.length,existingSequencesPreserved:Object.keys(immediate.sequences).length,newTables:3,newIndexes:15,ticketRows:0,evidence:path.relative(root,run)}));
  }else if(mode==='verify'){
    assert.ok(state.originalIntegrityVerified);history('dreamservice',6);preserved(state.after,snapshot('dreamservice'));prisma('dreamservice','status','final-status');
    state.finalVerifiedAt=new Date().toISOString();save();console.log(JSON.stringify({active:true,appliedMigrations:6,originalDataUnchangedSinceActivation:true,ticketTablesStillEmpty:true}));
  }else throw new Error('Unsupported stage');
}catch(error){save();console.error(JSON.stringify({STOP:true,stage:mode,category:error instanceof assert.AssertionError?'verification_failed':'operation_failed',detail:error instanceof assert.AssertionError?error.message.split('\n')[0]:'Inspect private evidence'}));process.exitCode=1;}
