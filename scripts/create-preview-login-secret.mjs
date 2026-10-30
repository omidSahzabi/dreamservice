// Run manually in a private directory. Never pass an existing password or print one.
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
const password = randomBytes(32).toString('base64url');
const salt = randomBytes(16);
const key = await promisify(scrypt)(password, salt, 32, {N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024});
const expiresAt = new Date(Math.floor((Date.now() + 86400000) / 1000) * 1000).toISOString();
const credentials = JSON.stringify({password, PREVIEW_PASSWORD_LOGIN_HASH: 'scrypt-v1$' + salt.toString('hex') + '$' + key.toString('hex'), PREVIEW_PASSWORD_LOGIN_EXPIRES_AT: expiresAt}, null, 2) + '\n';
fs.writeFileSync(destination, credentials, {flag: 'wx', mode: 0o600});
console.log('New credentials saved privately. Nothing was printed; protect the file permissions before sharing access.');
