// アプリのフォルダのスクリプトで共通に使う部品。
// 結果はAIが読むJSONで出し、相手に伝える文（message）はやさしい言葉で書く。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { explainError } from './errors.mjs';

export const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const STATE_DIR = path.join(APP_DIR, '.gas-kit');
export const SRC_DIR = path.join(APP_DIR, 'src');
export const files = {
  clasp: path.join(APP_DIR, '.clasp.json'),
  release: path.join(APP_DIR, 'release.config.json'),
  manifest: path.join(SRC_DIR, 'appsscript.json'),
  config: path.join(SRC_DIR, 'server', 'config.js'),
  state: path.join(STATE_DIR, 'state.json'),
  progress: path.join(STATE_DIR, 'progress.json'),
  lastRelease: path.join(STATE_DIR, 'last-release.json'),
  releaseRequest: path.join(STATE_DIR, 'release-request.json'),
  releaseResult: path.join(STATE_DIR, 'release-result.json'),
  releaseLog: path.join(STATE_DIR, 'release-server.log'),
};

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

/** --name value / --flag の形の引数を読む */
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

/** 結果のJSONを出して終わる */
export function finish(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.ok ? 0 : 1);
}

export function fail(error, extra = {}) {
  finish({ ok: false, ...extra, message: error.message, error });
}

export function claspEntry(appDir = APP_DIR) {
  return path.join(appDir, 'node_modules', '@google', 'clasp', 'build', 'src', 'index.js');
}

/** 開発者が自分のclaspのログインを汚さずに試すときだけ使う（GAS_KIT_CLASP_USER） */
export function claspUserArgs() {
  const user = process.env.GAS_KIT_CLASP_USER;
  return user ? ['--user', user] : [];
}

function parseJsonLoose(text) {
  const t = String(text || '').trim();
  if (!t) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    const start = t.search(/[[{]/);
    if (start < 0) return undefined;
    try {
      return JSON.parse(t.slice(start));
    } catch {
      return undefined;
    }
  }
}

/** アプリのフォルダに入っている clasp を node で直接動かす（.ps1 や .cmd を通さない） */
export function runClasp(args, { cwd = APP_DIR, json = true, appDir = APP_DIR, timeout = 180000 } = {}) {
  const entry = claspEntry(appDir);
  if (!fs.existsSync(entry)) {
    return {
      ok: false,
      error: { id: 'tools-missing', step: null, message: 'パソコンとGoogleをつなぐ道具がまだ準備されていません。', detail: 'npm install が必要です' },
    };
  }
  const full = [entry, ...claspUserArgs(), ...(json ? ['--json'] : []), ...args];
  const res = spawnSync(process.execPath, full, {
    cwd,
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  const stdout = res.stdout || '';
  const stderr = res.stderr || '';
  const ok = res.status === 0 && !res.error;
  return {
    ok,
    status: res.status,
    stdout,
    stderr,
    data: json ? parseJsonLoose(stdout) : undefined,
    error: ok ? undefined : explainError(`${stderr}\n${stdout}\n${res.error ? res.error.message : ''}`),
  };
}

export function requireCreated() {
  const project = readJson(files.clasp);
  if (!project || !project.scriptId) {
    fail({ id: 'not-created', step: null, message: 'このフォルダはまだGoogleとつながっていません。先にアプリを作成してください（npm run create）。' });
  }
  return project;
}

export const urls = {
  editor: (scriptId) => `https://script.google.com/d/${scriptId}/edit`,
  sheet: (id) => `https://docs.google.com/spreadsheets/d/${id}/edit`,
  dev: (headId) => `https://script.google.com/macros/s/${headId}/dev`,
  exec: (deploymentId) => `https://script.google.com/macros/s/${deploymentId}/exec`,
};

export function readSpreadsheetId() {
  const text = fs.existsSync(files.config) ? fs.readFileSync(files.config, 'utf8') : '';
  const m = /SPREADSHEET_ID:\s*'([^']*)'/.exec(text);
  return m ? m[1] : '';
}

/** 確認用の画面（/dev）のIDを取得する。分かったら state.json に残す */
export function getHeadDeploymentId({ refresh = false } = {}) {
  const state = readJson(files.state, {});
  if (state.headDeploymentId && !refresh) return { ok: true, id: state.headDeploymentId };
  const res = runClasp(['list-deployments']);
  if (!res.ok) return { ok: false, error: res.error };
  const list = Array.isArray(res.data) ? res.data : [];
  const head = list.find((d) => d.versionNumber === undefined || d.versionNumber === null);
  if (!head) return { ok: false, error: { id: 'unknown', step: null, message: '確認用の画面の場所が見つかりませんでした。', detail: res.stdout } };
  writeJson(files.state, { ...state, headDeploymentId: head.deploymentId });
  return { ok: true, id: head.deploymentId };
}

export function markProgress(step, status = 'done') {
  const progress = readJson(files.progress, { steps: {} });
  progress.steps = progress.steps || {};
  progress.steps[step] = { status, at: new Date().toISOString() };
  progress.updatedAt = new Date().toISOString();
  writeJson(files.progress, progress);
}

/** src/ の各ファイルの指紋（前回の公開から何が変わったかを示すため） */
export function fingerprintSrc() {
  const out = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[path.relative(SRC_DIR, full).split(path.sep).join('/')] = crypto.createHash('sha1').update(fs.readFileSync(full)).digest('hex');
    }
  };
  walk(SRC_DIR);
  return out;
}

export const ACCESS_WORDS = {
  MYSELF: '自分だけ',
  DOMAIN: '同じ会社（Google Workspace）の人だけ',
  ANYONE: 'Googleアカウントでログインした人なら誰でも',
  ANYONE_ANONYMOUS: 'URLを知っている人なら誰でも（ログイン不要）',
};

export const EXECUTE_AS_WORDS = {
  USER_DEPLOYING: '作った人（あなた）の権限で動く。使う人にシートの権限は要らない',
  USER_ACCESSING: '使う人それぞれの権限で動く。使う人ごとに許可の画面が出る',
};

/** 公開の確認ページに出す内容 */
export function buildReleaseSummary() {
  const release = readJson(files.release, {});
  const manifest = readJson(files.manifest, {});
  const last = readJson(files.lastRelease, null);
  const webapp = manifest.webapp || {};
  const now = fingerprintSrc();
  const before = (last && last.files) || {};
  const changed = Object.keys(now).filter((f) => before[f] !== now[f]);
  const removed = Object.keys(before).filter((f) => !(f in now));
  return {
    appName: release.appName || '',
    firstRelease: !release.deploymentId,
    access: webapp.access || '',
    accessWords: ACCESS_WORDS[webapp.access] || '（未設定）',
    executeAs: webapp.executeAs || '',
    executeAsWords: EXECUTE_AS_WORDS[webapp.executeAs] || '（未設定）',
    accessChanged: Boolean(last && last.access !== webapp.access),
    executeAsChanged: Boolean(last && last.executeAs !== webapp.executeAs),
    lastReleasedAt: last ? last.releasedAt : null,
    lastVersion: last ? last.version : null,
    changedFiles: changed,
    removedFiles: removed,
  };
}

export function isProcessAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}
