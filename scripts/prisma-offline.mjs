// Generate/validate against an isolated schema without loading project environment files.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamservice-prisma-'));
const generator = path.join(root, 'node_modules/@prisma/client/generator-build/index.js').replaceAll('\\', '/');
const output = path.join(root, 'node_modules/.prisma/client').replaceAll('\\', '/');
const source = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
  .replace('provider        = "prisma-client-js"', 'provider        = "node ' + generator + '"\n  output = "' + output + '"');
const schema = path.join(directory, 'schema.prisma');
fs.writeFileSync(schema, source);
const command = process.argv[2] ?? 'validate';
if (!['validate', 'generate'].includes(command)) throw new Error('Unsupported offline operation');
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), command, '--schema', schema], {
  cwd: directory, stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: 'postgresql://offline:offline@127.0.0.1:1/offline',
    PRISMA_GENERATE_SKIP_AUTOINSTALL: 'true', CHECKPOINT_DISABLE: '1',
    PRISMA_SCHEMA_ENGINE_BINARY: path.join(root, 'node_modules/@prisma/engines/schema-engine-windows.exe'),
    PRISMA_QUERY_ENGINE_LIBRARY: path.join(root, 'node_modules/@prisma/engines/query_engine-windows.dll.node') },
});
// Intentionally do not remove generated client files; the isolated temp schema contains no secrets.
if (result.error) { console.error(result.error.code ?? 'OFFLINE_TOOL_FAILED'); process.exitCode = 1; }
else process.exitCode = result.status ?? 1;
