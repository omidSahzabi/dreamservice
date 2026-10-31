// Owner-run only: generate fresh credentials into a protected file outside Git.
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes, scrypt} from 'node:crypto';
import {promisify} from 'node:util';

const output = process.argv[2];
if (!output || process.argv.length !== 3) throw Error('Provide one new private output-file path outside the repository.');
const root = fs.realpathSync(path.resolve(import.meta.dirname, '..'));
const destination = path.join(fs.realpathSync(path.dirname(path.resolve(output))), path.basename(output));
const relative = path.relative(root, destination);
if (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) throw Error('Credentials must be saved outside the repository.');
const password = randomBytes(32).toString('base64url'), salt = randomBytes(16);
const key = await promisify(scrypt)(password, salt, 32, {N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024});
const startedAt = Math.floor(Date.now() / 1000) * 1000;
const credentials = {password, TEMP_ADMIN_LOGIN_HASH: 'scrypt-v1$' + salt.toString('hex') + '$' + key.toString('hex'),
  TEMP_ADMIN_LOGIN_STARTED_AT: new Date(startedAt).toISOString(), TEMP_ADMIN_LOGIN_EXPIRES_AT: new Date(startedAt + 48 * 3600000).toISOString()};
fs.writeFileSync(destination, JSON.stringify(credentials, null, 2) + '\n', {flag: 'wx', mode: 0o600});
console.log('Fresh credentials saved privately. No password or hash was printed.');
