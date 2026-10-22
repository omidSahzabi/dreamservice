// Verification preloader only: never imported by application code.
const fs = process.getBuiltinModule('fs');
const path = process.getBuiltinModule('path');
const net = process.getBuiltinModule('net');
const crypto = process.getBuiltinModule('crypto');
const Module = process.getBuiltinModule('module');

process.env.DATABASE_URL = 'postgresql://offline:offline@127.0.0.1:1/offline';
process.env.SECURITY_SMS_ENABLED = 'false';
process.env.SECURITY_ORIGIN = 'http://localhost';
process.env.SECURITY_OTP_KEY = crypto.randomBytes(32).toString('hex');
process.env.NEXT_TELEMETRY_DISABLED = '1';
process.env.NODE_OPTIONS = '--require=' + JSON.stringify(__filename);

// Do not read project environment files, including in Next's worker processes.
const environmentFile = file => typeof file === 'string' && /^\.env(?:\.|$)/.test(path.basename(file));
const readSync = fs.readFileSync;
fs.readFileSync = function(file, ...args) {
  if (environmentFile(file)) throw Object.assign(new Error('Environment loading disabled during verification'), {code:'ENOENT'});
  return readSync.call(this, file, ...args);
};
const originalLoad = Module._load;
Module._load = function(name, ...args) {
  const result = originalLoad.call(this, name, ...args);
  if (name === '@next/env') return {...result, loadEnvConfig: () => ({combinedEnv:process.env, parsedEnv:{}, loadedEnvFiles:[]})};
  return result;
};
net.Socket.prototype.connect = function() {
  throw new Error('Database and external service connections disabled during verification');
};
