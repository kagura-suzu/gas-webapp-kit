// Pluginのスクリプト（doctor、new-app、clasp-login）で共通に使う部品。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const KIT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TEMPLATE_DIR = path.join(KIT_DIR, 'templates', 'webapp');

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

export function finish(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.ok ? 0 : 1);
}

export function kitVersion() {
  return (readJson(path.join(KIT_DIR, '.claude-plugin', 'plugin.json'), {}) || {}).version || '0.0.0';
}

/** 雛形で固定している clasp の版 */
export function pinnedClaspVersion() {
  const pkg = readJson(path.join(TEMPLATE_DIR, 'package.json'), {});
  return (pkg.devDependencies || {})['@google/clasp'];
}

/** npm の本体（npm-cli.js）を探す。npm.cmd / npm.ps1 を通さずに node で動かすため */
export function findNpmCli() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  return candidates.find((c) => c && /npm-cli\.js$/.test(c) && fs.existsSync(c)) || null;
}

/** npm を動かす。見つからなければ shell 経由で npm を呼ぶ */
export function runNpm(args, { cwd, timeout = 600000 } = {}) {
  const cli = findNpmCli();
  const opts = { cwd, encoding: 'utf8', timeout, windowsHide: true, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } };
  const res = cli
    ? spawnSync(process.execPath, [cli, ...args], opts)
    : spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { ...opts, shell: true });
  return { ok: res.status === 0 && !res.error, status: res.status, stdout: res.stdout || '', stderr: res.stderr || '', error: res.error };
}

export function claspEntry(appDir) {
  return path.join(appDir, 'node_modules', '@google', 'clasp', 'build', 'src', 'index.js');
}

export function claspUserArgs() {
  const user = process.env.GAS_KIT_CLASP_USER;
  return user ? ['--user', user] : [];
}

export function claspUser() {
  return process.env.GAS_KIT_CLASP_USER || 'default';
}

/** clasp の許可情報（~/.clasprc.json）に、このユーザーの記録があるか。中身は読まない */
export function hasStoredClaspCredentials() {
  const file = process.env.clasp_config_auth || path.join(os.homedir(), '.clasprc.json');
  const data = readJson(file, null);
  return Boolean(data && data.tokens && data.tokens[claspUser()]);
}

export function runClaspJson(appDir, args, { timeout = 120000 } = {}) {
  const entry = claspEntry(appDir);
  if (!fs.existsSync(entry)) return { ok: false, missing: true, stdout: '', stderr: '' };
  const res = spawnSync(process.execPath, [entry, ...claspUserArgs(), '--json', ...args], {
    cwd: appDir, encoding: 'utf8', timeout, windowsHide: true, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  let data;
  try {
    const t = (res.stdout || '').trim();
    data = JSON.parse(t.slice(Math.max(0, t.search(/[[{]/))));
  } catch {
    data = undefined;
  }
  return { ok: res.status === 0 && !res.error, stdout: res.stdout || '', stderr: res.stderr || '', data, error: res.error };
}
