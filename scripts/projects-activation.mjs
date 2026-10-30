// Local-only, staged database recovery/activation. Never prints credentials or row data.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';

const root=path.resolve(import.meta.dirname,'..');
const migration='prisma/migrations/202610170001_security_foundation/migration.sql';
const projectMigration='202610290001_projects';
const binary='C:/Program Files/PostgreSQL/18/bin';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const mode=process.argv[2]??'inspect';
const run=process.argv[3]?path.resolve(root,process.argv[3]):path.join(root,'.backups','projects-activation-'+new Date().toISOString().replace(/\D/g,''));
if(!run.startsWith(path.join(root,'.backups')+path.sep)||!path.basename(run).startsWith('projects-activation-'))throw new Error('Invalid private evidence directory');
fs.mkdirSync(run,{recursive:true});
const stateFile=path.join(run,'state.json');
let state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):{};
function save(){fs.writeFileSync(stateFile,JSON.stringify(state,null,2)+'\n');}
function stop(message){save();console.error('STOP: '+message);process.exit(1);}
function execute(executable,args,env,label,{input,allowFailure=false}={}){
  const result=spawnSync(executable,args,{cwd:run,env,encoding:input instanceof Buffer?undefined:'utf8',input,windowsHide:true,maxBuffer:64*1024*1024});
  if(result.error||result.status!==0){
    fs.writeFileSync(path.join(run,label+'-error.log'),result.error?.code??result.stderr??'OPERATION_FAILED');
    if(!allowFailure)stop(label+' failed; details retained privately.');
  }
  return result;
}
function git(args){const result=spawnSync('git',args,{cwd:root,windowsHide:true,maxBuffer:16*1024*1024});if(result.error||result.status!==0)stop('Git inspection failed.');return result.stdout;}
let target;
try{
  const match=fs.readFileSync(path.join(root,'.env'),'utf8').match(/^DATABASE_URL\s*=\s*(.+)$/m);
  if(!match)throw new Error();
  target=new URL(match[1].trim().replace(/^(["'])(.*)\1$/,'$2'));
  if(!['postgres:','postgresql:'].includes(target.protocol)||!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||
     (target.port&&target.port!=='5432')||decodeURIComponent(target.pathname.slice(1))!=='dreamservice')throw new Error();
}catch{stop('The known loopback development database could not be identified.');}
function environment(database,readOnly=true){
  const url=new URL(target);url.pathname='/'+database;
  return {...process.env,DATABASE_URL:url.toString(),PGHOST:target.hostname,PGPORT:target.port||'5432',PGUSER:decodeURIComponent(target.username),
    PGPASSWORD:decodeURIComponent(target.password),PGDATABASE:database,PGCONNECT_TIMEOUT:'5',
    PGOPTIONS:'-c statement_timeout=60000 -c lock_timeout=5000'+(readOnly?' -c default_transaction_read_only=on':''),
    SECURITY_SMS_ENABLED:'false',CHECKPOINT_DISABLE:'1',PRISMA_GENERATE_SKIP_AUTOINSTALL:'true',
    PRISMA_SCHEMA_ENGINE_BINARY:path.join(root,'node_modules/@prisma/engines/schema-engine-windows.exe'),
    PRISMA_QUERY_ENGINE_LIBRARY:path.join(root,'node_modules/@prisma/engines/query_engine-windows.dll.node')};
}
function query(database,sql,{write=false}={}){
  return execute(path.join(binary,'psql.exe'),['-X','-A','-t','-v','ON_ERROR_STOP=1','-c',sql],environment(database,!write),'psql').stdout.trim();
}
function history(database){return JSON.parse(query(database,`SELECT coalesce(json_agg(m ORDER BY migration_name), '[]'::json) FROM (SELECT migration_name, checksum, finished_at IS NOT NULL AND rolled_back_at IS NULL AS applied FROM entity._prisma_migrations) m`));}
function diskMigrations(){return Object.fromEntries(fs.readdirSync(path.join(root,'prisma/migrations'),{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>[entry.name,hash(fs.readFileSync(path.join(root,'prisma/migrations',entry.name,'migration.sql')))]));}
function checkHistory(database,{projectApplied=false}={}){
  const rows=history(database);const disk=diskMigrations();
  if(rows.length!==(projectApplied?5:4)||rows.some(row=>!row.applied||disk[row.migration_name]!==row.checksum)||
    rows.some(row=>row.migration_name===projectMigration)!==projectApplied)stop('Migration history/checksum precondition failed.');
  return rows;
}
const quote=value=>'"'+value.replaceAll('"','""')+'"';
function jsonQuery(database,sql){return JSON.parse(query(database,sql));}
function snapshot(database){
  const tables=jsonQuery(database,`SELECT coalesce(json_agg(t ORDER BY schema,name),'[]'::json) FROM (SELECT table_schema AS schema,table_name AS name FROM information_schema.tables WHERE table_schema IN ('entity','public','upro') AND table_type='BASE TABLE') t`);
  const contents={};
  for(const table of tables){
    contents[table.schema+'.'+table.name]=jsonQuery(database,`SELECT json_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(hash,'' ORDER BY hash),''))) FROM (SELECT md5(to_jsonb(t)::text) AS hash FROM ${quote(table.schema)}.${quote(table.name)} t) rows`);
  }
  const catalog={
    indexes:jsonQuery(database,`SELECT coalesce(json_agg(i ORDER BY schema,name),'[]'::json) FROM (SELECT n.nspname AS schema,c.relname AS name,t.relname AS table,pg_get_indexdef(c.oid) AS definition,x.indisvalid AS valid,x.indisready AS ready FROM pg_index x JOIN pg_class c ON c.oid=x.indexrelid JOIN pg_class t ON t.oid=x.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('entity','public','upro')) i`),
    constraints:jsonQuery(database,`SELECT coalesce(json_agg(c ORDER BY schema,name),'[]'::json) FROM (SELECT n.nspname AS schema,t.relname AS table,c.conname AS name,pg_get_constraintdef(c.oid) AS definition,c.convalidated AS validated FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname IN ('entity','public','upro')) c`),
    columns:jsonQuery(database,`SELECT coalesce(json_agg(c ORDER BY table_schema,table_name,position),'[]'::json) FROM (SELECT table_schema,table_name,column_name,row_number() OVER (PARTITION BY table_schema,table_name ORDER BY ordinal_position) AS position,column_default,is_nullable,data_type,character_maximum_length,datetime_precision,udt_schema,udt_name,is_identity,identity_generation FROM information_schema.columns WHERE table_schema IN ('entity','public','upro')) c`),
    triggers:jsonQuery(database,`SELECT coalesce(json_agg(t ORDER BY schema,name),'[]'::json) FROM (SELECT n.nspname AS schema,t.tgname AS name,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('entity','public','upro')) t`),
    functions:jsonQuery(database,`SELECT coalesce(json_agg(f ORDER BY schema,name),'[]'::json) FROM (SELECT n.nspname AS schema,p.proname AS name,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('entity','public','upro') AND p.prokind='f') f`),
    enums:jsonQuery(database,`SELECT coalesce(json_agg(e ORDER BY schema,name,sort),'[]'::json) FROM (SELECT n.nspname AS schema,t.typname AS name,e.enumsortorder AS sort,e.enumlabel AS label FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('entity','public','upro')) e`),
  };
  const sequences={};
  for(const row of jsonQuery(database,`SELECT coalesce(json_agg(s ORDER BY schemaname,sequencename),'[]'::json) FROM pg_sequences s WHERE schemaname IN ('entity','public','upro')`)){
    sequences[row.schemaname+'.'+row.sequencename]={...row,...jsonQuery(database,`SELECT row_to_json(s) FROM (SELECT last_value,is_called FROM ${quote(row.schemaname)}.${quote(row.sequencename)}) s`)};
  }
  const physicalIndexes=jsonQuery(database,`SELECT coalesce(json_agg(i ORDER BY schema,name),'[]'::json) FROM (SELECT n.nspname AS schema,c.relname AS name,c.oid,c.relfilenode FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='i' AND n.nspname IN ('entity','public','upro')) i`);
  const migrationRecords=jsonQuery(database,`SELECT coalesce(json_agg(m ORDER BY migration_name),'[]'::json) FROM entity._prisma_migrations m`);
  return {tables:contents,catalog,sequences,physicalIndexes,migrationRecords};
}
function equal(left,right){return JSON.stringify(left)===JSON.stringify(right);}
function equivalentRestoredConstraint(left,right){
  // pg_dump 18 redistributes this constant varchar[] -> text[] cast when restoring
  // to PostgreSQL 15. Accept only these two exact forms for this named CHECK.
  const original="CHECK (((action)::text = ANY ((ARRAY['promote'::character varying, 'demote'::character varying, 'ban'::character varying, 'unban'::character varying])::text[])))";
  const restored="CHECK (((action)::text = ANY (ARRAY[('promote'::character varying)::text, ('demote'::character varying)::text, ('ban'::character varying)::text, ('unban'::character varying)::text])))";
  return left.schema==='entity'&&left.table==='user_management_audit'&&left.name==='user_management_audit_action_check'&&
    left.definition===original&&right.definition===restored&&equal({...left,definition:''},{...right,definition:''})&&state.restoreConstantCastVerified===true;
}
function verifyRestoreConstantCast(database){
  const result=jsonQuery(database,`SELECT json_build_object('equal',ARRAY['promote'::varchar,'demote'::varchar,'ban'::varchar,'unban'::varchar]::text[] IS NOT DISTINCT FROM ARRAY[('promote'::varchar)::text,('demote'::varchar)::text,('ban'::varchar)::text,('unban'::varchar)::text], 'leftType',pg_typeof(ARRAY['promote'::varchar,'demote'::varchar,'ban'::varchar,'unban'::varchar]::text[])::text,'rightType',pg_typeof(ARRAY[('promote'::varchar)::text,('demote'::varchar)::text,('ban'::varchar)::text,('unban'::varchar)::text])::text)`);
  if(!result.equal||result.leftType!=='text[]'||result.rightType!=='text[]')stop('Restore CHECK constant-array equivalence verification failed.');
  state.restoreConstantCastVerified=true;state.restoreConstantCastEvidence=result;save();
}
function sameOriginal(before,after,{physical=false,projectAdded=false,restored=false}={}){
  for(const [name,table]of Object.entries(before.tables)){
    if(projectAdded&&name==='entity._prisma_migrations')continue;
    if(!equal(table,after.tables[name]))stop('Existing table contents changed during verification.');
  }
  for(const [kind,items]of Object.entries(before.catalog)){
    if(!projectAdded&&items.length!==after.catalog[kind].length)stop('Catalog object count changed during verification.');
    if(items.some(item=>!after.catalog[kind].some(candidate=>equal(item,candidate)||(restored&&kind==='constraints'&&equivalentRestoredConstraint(item,candidate)))))stop('Existing '+kind+' changed during verification.');
  }
  if(!equal(before.sequences,after.sequences))stop('Existing sequence state changed.');
  if(physical&&before.physicalIndexes.some(item=>!after.physicalIndexes.some(candidate=>equal(item,candidate))))stop('Existing physical indexes changed.');
  if(before.migrationRecords.some(item=>!after.migrationRecords.some(candidate=>equal(item,candidate))))stop('Historical migration records changed.');
  if(!projectAdded&&!equal(Object.keys(before.tables),Object.keys(after.tables)))stop('Restored table set differs.');
}
function preparePrisma(){
  const directory=path.join(run,'prisma');fs.mkdirSync(directory,{recursive:true});
  fs.copyFileSync(path.join(root,'prisma/schema.prisma'),path.join(directory,'schema.prisma'));
  fs.cpSync(path.join(root,'prisma/migrations'),path.join(directory,'migrations'),{recursive:true});
  return path.join(directory,'schema.prisma');
}
function prisma(database,operation,label){
  const schema=preparePrisma();
  const result=execute(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate',operation,'--schema',schema],environment(database,operation==='status'),label,{allowFailure:operation==='status'});
  fs.writeFileSync(path.join(run,label+'.log'),(result.stdout??'')+(result.stderr??''));
  return result.status;
}
function verifyAdditive(){
  const file=path.join(root,'prisma/migrations',projectMigration,'migration.sql');
  const bytes=fs.readFileSync(file);
  if(hash(bytes)!==state.originalMigrations?.[projectMigration])stop('Project migration changed since inspection.');
  const statements=bytes.toString('utf8').replace(/^\s*--.*$/gm,'').split(';').map(value=>value.trim()).filter(Boolean);
  const allowed=[/^BEGIN$/,/^COMMIT$/,/^SET LOCAL (?:lock_timeout|statement_timeout) = '[0-9]+s'$/,
    /^CREATE TYPE "entity"\."ProjectStatus" AS ENUM \(/,/^CREATE TABLE "entity"\."projects" \(/,
    /^CREATE (?:UNIQUE )?INDEX "projects_[A-Za-z_]+" ON "entity"\."projects"\(/];
  if(statements.length!==9||statements.some(statement=>!allowed.some(pattern=>pattern.test(statement))))stop('Unexpected statement in additive migration review.');
  return hash(bytes);
}
function requireStages(...stages){if(stages.some(stage=>!state[stage]))stop('Required verification stages are incomplete.');}
function verifyProject(database,before,after){
  sameOriginal(before,after,{physical:true,projectAdded:true});checkHistory(database,{projectApplied:true});
  if(Object.keys(after.tables).length!==Object.keys(before.tables).length+1||after.tables['entity.projects']?.count!==0||
    after.tables['entity._prisma_migrations']?.count!==before.tables['entity._prisma_migrations'].count+1||
    after.migrationRecords.length!==before.migrationRecords.length+1)stop('Unexpected Project table or migration-history delta.');
  const expected={indexes:['projects_pkey','projects_orderId_key','projects_status_createdAt_idx','projects_single_homepage_key'],
    constraints:['projects_pkey','projects_orderId_fkey','projects_dates_check','projects_titles_check','projects_homepage_check']};
  for(const [kind,names]of Object.entries(expected)){
    const additions=after.catalog[kind].filter(item=>!before.catalog[kind].some(previous=>equal(previous,item)));
    if(!equal(additions.map(item=>item.name).sort(),names.sort())||additions.some(item=>item.schema!=='entity'||item.table!=='projects'))stop('Unexpected new Project '+kind+'.');
  }
  const singleton=after.catalog.indexes.find(item=>item.name==='projects_single_homepage_key');
  if(!singleton?.valid||!singleton.ready||!singleton.definition.includes('UNIQUE INDEX')||!singleton.definition.includes('WHERE ("showOnHomepage" = true)'))stop('Homepage singleton index is missing or invalid.');
  const labels=after.catalog.enums.filter(item=>item.schema==='entity'&&item.name==='ProjectStatus').map(item=>item.label);
  if(!equal(labels,['PLANNED','ACTIVE','COMPLETED','CANCELLED']))stop('Unexpected ProjectStatus enum.');
  if(after.catalog.columns.length!==before.catalog.columns.length+13||after.catalog.enums.length!==before.catalog.enums.length+4||
     after.catalog.triggers.length!==before.catalog.triggers.length||after.catalog.functions.length!==before.catalog.functions.length)stop('Unexpected additive catalog delta.');
}
if(mode==='inspect'){
  if(fs.existsSync(stateFile))stop('Use a fresh inspection directory.');
  const rows=history('dreamservice');const applied=rows.find(row=>row.migration_name==='202610170001_security_foundation');
  if(!applied?.applied)stop('Applied security migration was not found.');
  const current=fs.readFileSync(path.join(root,migration));
  const revisions=[...new Set(['HEAD',...git(['rev-list','--all','--',migration]).toString('utf8').trim().split(/\s+/).filter(Boolean)])];
  const versions=revisions.map(revision=>{const bytes=git(['show',revision+':'+migration]);return {revision,bytes,checksum:hash(bytes)};});
  const match=versions.find(version=>version.checksum===applied.checksum);
  state={createdAt:new Date().toISOString(),currentChecksum:hash(current),recordedChecksum:applied.checksum,currentBytes:current.length,
    versions:versions.map(({revision,checksum,bytes})=>({revision,checksum,bytes:bytes.length})),trustedRevision:match?.revision??null,originalMigrations:diskMigrations()};
  fs.writeFileSync(path.join(run,'security-before.sql'),current);
  if(match){
    fs.writeFileSync(path.join(run,'security-applied.sql'),match.bytes);
    let prefix=0;while(prefix<Math.min(current.length,match.bytes.length)&&current[prefix]===match.bytes[prefix])prefix++;
    state.difference={identicalPrefixBytes:prefix,currentSuffixHex:current.subarray(prefix).toString('hex'),appliedSuffixHex:match.bytes.subarray(prefix).toString('hex')};
  }
  save();console.log(JSON.stringify(state,null,2));console.log('Evidence: '+path.relative(root,run));
  if(!match)stop('No trusted Git version matches the applied checksum. No correction made.');
}else if(mode==='correct'){
  if(!state.trustedRevision)stop('A verified inspection is required.');
  const bytes=fs.readFileSync(path.join(run,'security-applied.sql'));
  const current=fs.readFileSync(path.join(root,migration));
  if(hash(bytes)!==state.recordedChecksum||hash(current)!==state.currentChecksum||history('dreamservice').find(row=>row.migration_name==='202610170001_security_foundation')?.checksum!==state.recordedChecksum)stop('Files or history changed since inspection.');
  if(!git(['show',state.trustedRevision+':'+migration]).equals(bytes))stop('Trusted Git bytes changed.');
  fs.writeFileSync(path.join(root,migration),bytes);
  checkHistory('dreamservice');state.corrected=true;save();
  console.log('Restored exact trusted Git bytes; checksum matches the applied record: '+hash(bytes));
  const status=prisma('dreamservice','status','status-after-correction');
  if(status!==1)stop('Expected exactly the pending project migration after correction.');
  state.statusAfterCorrection={exitCode:status,pending:[projectMigration]};save();
  console.log('Prisma migrate status: four applied migrations; only '+projectMigration+' pending (expected exit 1).');
}else if(mode==='backup'){
  requireStages('corrected','statusAfterCorrection');checkHistory('dreamservice');
  state.projectChecksum=verifyAdditive();
  const before=snapshot('dreamservice');
  if(before.tables['entity.projects'])stop('Project table already exists.');
  fs.writeFileSync(path.join(run,'before.json'),JSON.stringify(before,null,2));
  const archive=path.join(run,'before-projects.dump');
  if(fs.existsSync(archive))stop('A backup already exists for this run. Start a fresh run instead of overwriting it.');
  execute(path.join(binary,'pg_dump.exe'),['--format=custom','--no-owner','--no-privileges','--file',archive],environment('dreamservice'),'backup');
  if(!fs.statSync(archive).size)stop('Backup archive is empty.');
  const list=execute(path.join(binary,'pg_restore.exe'),['--list',archive],environment('dreamservice'),'archive-list').stdout;
  if(!list.includes('TABLE DATA'))stop('Backup archive listing lacks table data.');
  fs.writeFileSync(path.join(run,'archive-list.txt'),list);
  const after=snapshot('dreamservice');sameOriginal(before,after,{physical:true});
  state.backup={bytes:fs.statSync(archive).size,sha256:hash(fs.readFileSync(archive)),tables:Object.keys(before.tables).length,indexes:before.catalog.indexes.length};
  save();console.log(JSON.stringify({backupVerified:state.backup,additiveMigrationChecksum:state.projectChecksum,evidence:path.relative(root,run)},null,2));
}else if(mode==='restore'){
  requireStages('backup');checkHistory('dreamservice');
  if(state.restoreDatabase)stop('An isolated restore already exists for this run.');
  const archive=path.join(run,'before-projects.dump');
  if(hash(fs.readFileSync(archive))!==state.backup.sha256)stop('Backup checksum changed.');
  const name='dreamservice_projects_test_'+new Date().toISOString().slice(0,10).replaceAll('-','')+'_'+randomUUID().replaceAll('-','').slice(0,12);
  if(!/^dreamservice_projects_test_\d{8}_[a-f0-9]{12}$/.test(name)||name==='dreamservice')stop('Unsafe restore target.');
  const extracted=path.join(run,'restore-original.sql');
  execute(path.join(binary,'pg_restore.exe'),['--no-owner','--no-privileges','--file',extracted,archive],environment('dreamservice'),'extract');
  const source=fs.readFileSync(extracted,'utf8');
  // pg_restore 18 emits this setting; local server 15 does not support it.
  const compatible=source.replace(/^SET transaction_timeout = 0;\r?\n/gm,'');
  fs.writeFileSync(path.join(run,'restore-compatible.sql'),compatible);
  execute(path.join(binary,'createdb.exe'),['--template=template0',name],environment('postgres',false),'create-isolated');
  state.restoreDatabase=name;save();
  execute(path.join(binary,'psql.exe'),['-X','-v','ON_ERROR_STOP=1','--single-transaction','--file',path.join(run,'restore-compatible.sql')],environment(name,false),'restore');
  const restored=snapshot(name);const before=JSON.parse(fs.readFileSync(path.join(run,'before.json'),'utf8'));
  sameOriginal(before,restored);checkHistory(name);
  fs.writeFileSync(path.join(run,'restored.json'),JSON.stringify(restored,null,2));
  state.restoreVerified=true;save();
  console.log('Full isolated restore verified: '+name+'; all original table contents, indexes, columns, constraints, triggers, functions, enums, sequence states and migration records match.');
}else if(mode==='diagnose-restore'){
  requireStages('backup','restoreDatabase');
  const before=JSON.parse(fs.readFileSync(path.join(run,'before.json'),'utf8'));const restored=snapshot(state.restoreDatabase);
  fs.writeFileSync(path.join(run,'restored.json'),JSON.stringify(restored,null,2));
  const differences={};
  for(const [kind,items]of Object.entries(before.catalog)){
    const missing=items.filter(item=>!restored.catalog[kind].some(candidate=>equal(item,candidate)));
    if(missing.length)differences[kind]=missing.map(item=>({before:item,after:restored.catalog[kind].filter(candidate=>candidate.schema===item.schema&&candidate.name===item.name&&candidate.table===item.table)}));
  }
  fs.writeFileSync(path.join(run,'restore-differences.json'),JSON.stringify(differences,null,2));
  console.log(JSON.stringify(differences,null,2));
}else if(mode==='verify-restore'){
  requireStages('backup','restoreDatabase');checkHistory('dreamservice');checkHistory(state.restoreDatabase);
  verifyRestoreConstantCast(state.restoreDatabase);
  const before=JSON.parse(fs.readFileSync(path.join(run,'before.json'),'utf8'));const restored=snapshot(state.restoreDatabase);
  sameOriginal(before,restored,{restored:true});sameOriginal(before,snapshot('dreamservice'),{physical:true});
  fs.writeFileSync(path.join(run,'restored.json'),JSON.stringify(restored,null,2));state.restoreVerified=true;save();
  console.log('Full isolated restore verified. The sole catalog text difference is a proven-equivalent constant text[] cast in the existing audit CHECK; all data, other catalog objects and sequence states match. Original database remains unchanged.');
}else if(mode==='trial'){
  requireStages('restoreVerified');verifyAdditive();checkHistory(state.restoreDatabase);
  const before=snapshot(state.restoreDatabase);
  fs.writeFileSync(path.join(run,'trial-before.json'),JSON.stringify(before,null,2));
  if(prisma(state.restoreDatabase,'deploy','trial-deploy')!==0)stop('Trial migration failed.');
  const after=snapshot(state.restoreDatabase);verifyProject(state.restoreDatabase,before,after);
  fs.writeFileSync(path.join(run,'trial-after.json'),JSON.stringify(after,null,2));
  if(prisma(state.restoreDatabase,'status','trial-status')!==0)stop('Trial migration status failed.');
  state.trialVerified=true;save();
  console.log('Project migration trial passed on the restored database. Existing rows, migration records, sequence states and physical indexes are intact; only the expected Project objects and migration record were added.');
}else if(mode==='integration'){
  requireStages('trialVerified');
  if(!/^dreamservice_projects_test_\d{8}_[a-f0-9]{12}$/.test(state.restoreDatabase))stop('Unsafe integration target.');
  checkHistory(state.restoreDatabase,{projectApplied:true});
  const env=environment(state.restoreDatabase,false);
  env.PROJECTS_TEST_DATABASE_URL=env.DATABASE_URL;env.PROJECTS_TEST_DATABASE_NAME=state.restoreDatabase;
  const result=execute(process.execPath,['--test','--test-reporter=spec',path.join(root,'scripts/projects.integration.mjs')],env,'integration');
  fs.writeFileSync(path.join(run,'integration.log'),(result.stdout??'')+(result.stderr??''));
  state.integrationVerified=true;save();
  console.log('Live PostgreSQL project integration passed on isolated synthetic fixtures. Private detailed results retained in integration.log.');
}else if(mode==='apply'){
  requireStages('corrected','backup','restoreVerified','trialVerified','integrationVerified');
  if(state.originalDeploymentAttempted)stop('Original deployment was already attempted; inspect evidence instead of repeating automatically.');
  const expected={...state.originalMigrations,'202610170001_security_foundation':state.recordedChecksum};
  if(!equal(diskMigrations(),expected))stop('Migration files changed after the verified trial.');
  if(verifyAdditive()!==state.projectChecksum||hash(fs.readFileSync(path.join(run,'before-projects.dump')))!==state.backup.sha256)stop('Trialled migration or backup archive checksum changed.');
  checkHistory('dreamservice');
  const before=JSON.parse(fs.readFileSync(path.join(run,'before.json'),'utf8'));
  const immediate=snapshot('dreamservice');sameOriginal(before,immediate,{physical:true});
  fs.writeFileSync(path.join(run,'immediately-before-apply.json'),JSON.stringify(immediate,null,2));
  state.originalDeploymentAttempted=true;save();
  if(prisma('dreamservice','deploy','original-deploy')!==0)stop('Original migration deployment failed. Inspect private evidence; no automatic reset or history repair will run.');
  state.originalApplied=true;save();
  const after=snapshot('dreamservice');fs.writeFileSync(path.join(run,'after.json'),JSON.stringify(after,null,2));
  verifyProject('dreamservice',before,after);
  if(prisma('dreamservice','status','original-status')!==0)stop('Original migration status is not up to date.');
  state.originalIntegrityVerified=true;state.completedAt=new Date().toISOString();save();
  console.log(JSON.stringify({applied:projectMigration,status:'up-to-date',originalTablesPreserved:Object.keys(before.tables).length,
    originalIndexesPreserved:before.catalog.indexes.length,totalIndexes:after.catalog.indexes.length,projectRows:after.tables['entity.projects'].count,
    existingDataFingerprintsUnchanged:true,existingSequenceStatesUnchanged:true,existingPhysicalIndexesUnchanged:true,historicalMigrationRecordsUnchanged:true,
    evidence:path.relative(root,run)},null,2));
}else{stop('Unsupported activation stage.');}
