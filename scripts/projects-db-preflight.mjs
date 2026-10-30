// Read-only preflight. Credentials stay in the child environment, never argv/output.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const directory = path.join(root, '.backups', 'projects-' + new Date().toISOString().replace(/\D/g, ''));
fs.mkdirSync(directory, {recursive: true});
const tool = path.join('C:/Program Files/PostgreSQL/18/bin', 'psql.exe');
let config;
try {
  const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
  const match = env.match(/^DATABASE_URL\s*=\s*(.+)$/m);
  if (!match) throw new Error();
  const raw = match[1].trim().replace(/^(["'])(.*)\1$/, '$2');
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || decodeURIComponent(url.pathname.slice(1)) !== 'dreamservice') throw new Error();
  config = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: 'dreamservice',
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGCONNECT_TIMEOUT: '5',
    PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=3000' };
} catch { console.error('STOP: local development target could not be safely identified. No database mutation attempted.'); process.exit(1); }
function query(sql) {
  const result = spawnSync(tool, ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql], {env: config, encoding: 'utf8', windowsHide: true});
  if (result.error || result.status !== 0) {
    fs.writeFileSync(path.join(directory, 'preflight-error.log'), result.error?.code ?? result.stderr ?? 'PSQL_FAILED');
    console.error('STOP: read-only database inspection failed. No database mutation attempted.'); process.exit(1);
  }
  return result.stdout.trim();
}
const migrations = JSON.parse(query(`SELECT coalesce(json_agg(m ORDER BY migration_name), '[]'::json) FROM (SELECT migration_name, checksum, finished_at IS NOT NULL AND rolled_back_at IS NULL AS applied FROM entity._prisma_migrations) m`));
const mismatches = migrations.filter(row => {
  const file = path.join(root, 'prisma/migrations', row.migration_name, 'migration.sql');
  return !row.applied || !fs.existsSync(file) || createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== row.checksum;
});
const result = {readOnly: true, migrations: migrations.map(row => ({name: row.migration_name, applied: row.applied})),
  mismatches: mismatches.map(row => row.migration_name), databaseMutated: false};
fs.writeFileSync(path.join(directory, 'preflight.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
console.log('Private preflight record: ' + path.relative(root, directory));
const comparisonIndex = process.argv.indexOf('--compare');
if (process.argv.includes('--backup') || comparisonIndex !== -1) {
  // Backup and catalog inspection are read-only even when migration history is
  // blocked. This script never creates a database, restores, or applies SQL.
  const tables = JSON.parse(query(`SELECT coalesce(json_agg(t ORDER BY schema, name), '[]'::json) FROM (SELECT table_schema AS schema, table_name AS name FROM information_schema.tables WHERE table_schema IN ('entity','public','upro') AND table_type = 'BASE TABLE') t`));
  const quoted = value => '"' + value.replaceAll('"','""') + '"';
  const snapshot = {};
  for (const table of tables) {
    const relation = quoted(table.schema) + '.' + quoted(table.name);
    snapshot[table.schema + '.' + table.name] = JSON.parse(query(`SELECT json_build_object('count', count(*), 'fingerprint', md5(coalesce(string_agg(hash, '' ORDER BY hash), ''))) FROM (SELECT md5(to_jsonb(t)::text) AS hash FROM ${relation} t) rows`));
  }
  const indexes = JSON.parse(query(`SELECT coalesce(json_agg(i ORDER BY schemaname, tablename, indexname), '[]'::json) FROM (SELECT * FROM pg_indexes WHERE schemaname IN ('entity','public','upro')) i`));
  const current = {tables:snapshot,indexes};
  fs.writeFileSync(path.join(directory, comparisonIndex === -1 ? 'before.json' : 'after.json'), JSON.stringify(current, null, 2));
  if (comparisonIndex !== -1) {
    const baselinePath = path.resolve(root, process.argv[comparisonIndex + 1] ?? '');
    if (!baselinePath.startsWith(path.join(root,'.backups') + path.sep) || path.basename(baselinePath) !== 'before.json') {
      console.error('STOP: comparison requires a private preflight snapshot.'); process.exit(1);
    }
    const baseline = JSON.parse(fs.readFileSync(baselinePath,'utf8'));
    const unchanged = JSON.stringify(current) === JSON.stringify(baseline);
    console.log('Original table counts, row fingerprints and index definitions unchanged: '+unchanged);
    if (!unchanged) {console.error('STOP: original database changed since the baseline.');process.exit(1);}
  }
  if (process.argv.includes('--backup')) {
  const archive = path.join(directory, 'before-projects.dump');
  const dump = spawnSync(path.join(path.dirname(tool),'pg_dump.exe'), ['--format=custom','--no-owner','--no-privileges','--file',archive], {env:config,encoding:'utf8',windowsHide:true});
  if (dump.error || dump.status !== 0 || !fs.existsSync(archive) || fs.statSync(archive).size === 0) {
    fs.writeFileSync(path.join(directory,'backup-error.log'),dump.error?.code ?? dump.stderr ?? 'BACKUP_FAILED');
    console.error('STOP: backup failed. No database mutation attempted.'); process.exit(1);
  }
  const list = spawnSync(path.join(path.dirname(tool),'pg_restore.exe'), ['--list',archive], {encoding:'utf8',windowsHide:true});
  if (list.error || list.status !== 0 || !list.stdout.includes('TABLE DATA')) {console.error('STOP: archive verification failed.');process.exit(1);}
  fs.writeFileSync(path.join(directory,'archive-list.txt'),list.stdout);
  fs.writeFileSync(path.join(directory,'sha256.txt'),createHash('sha256').update(fs.readFileSync(archive)).digest('hex')+'\n');
  console.log('Read-only backup and archive listing verified; private row fingerprints and indexes recorded for '+tables.length+' tables. No test restore or database mutation attempted.');
  }
}
if (mismatches.length) {
  console.error('STOP: applied migration checksums differ from the worktree. Preserve existing edits; resolve the history discrepancy before restore/application. No database mutation attempted.');
  process.exitCode = 2;
}
