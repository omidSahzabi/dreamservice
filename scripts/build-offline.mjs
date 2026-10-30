import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const result = spawnSync(process.execPath, [path.join(root,'node_modules/next/dist/bin/next'), 'build', ...process.argv.slice(2)], {
  cwd:root, stdio:'inherit', env:{...process.env,NODE_OPTIONS:'--require=' + JSON.stringify(path.join(root,'scripts/no-services.cjs'))}
});
if (result.error) {console.error(result.error.code ?? 'BUILD_FAILED'); process.exitCode = 1;}
else process.exitCode = result.status ?? 1;
