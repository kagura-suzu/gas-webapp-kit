// みんなが使う画面を新しくする準備。
// テストとGoogleへの送信をしてから、公開の確認ページ（このパソコンの中だけで開くページ）を用意して終わる。
// 実際に公開されるのは、本人が確認ページでアプリ名を入力して「公開する」を押したときだけ。
//   npm run release              確認ページを用意する
//   npm run release -- --status  結果を見る（waiting / released / cancelled / expired / failed）
//   npm run release -- --cancel  用意した確認ページを取り消す（本人に頼まれたときだけ）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import {
  APP_DIR, files, readJson, writeJson, parseArgs, finish, fail, runClasp, requireCreated,
  buildReleaseSummary, isProcessAlive,
} from './lib.mjs';

const args = parseArgs(process.argv.slice(2));

const STATUS_MESSAGES = {
  waiting: '確認ページで本人が操作するのを待っています。',
  released: 'みんなが使う画面を新しくしました。',
  cancelled: '公開をやめました。みんなが使う画面は変わっていません。',
  expired: '確認ページの期限が切れました。公開するには、もう一度準備します。',
  failed: '公開できませんでした。みんなが使う画面は変わっていません。',
  none: '公開の確認ページはまだ用意していません。',
};

function readStatus() {
  const result = readJson(files.releaseResult, null);
  if (result) return result;
  const request = readJson(files.releaseRequest, null);
  if (!request) return { status: 'none' };
  if (isProcessAlive(request.pid) && Date.now() < Date.parse(request.expiresAt)) {
    return { status: 'waiting', confirmUrl: request.confirmUrl, expiresAt: request.expiresAt };
  }
  return { status: 'expired' };
}

function report(s) {
  finish({ ok: ['waiting', 'released', 'cancelled'].includes(s.status), ...s, message: s.message || STATUS_MESSAGES[s.status] });
}

if (args.status) report(readStatus());

if (args.cancel) {
  const request = readJson(files.releaseRequest, null);
  if (request && isProcessAlive(request.pid)) {
    try { process.kill(request.pid); } catch { /* すでに終わっている */ }
    writeJson(files.releaseResult, { status: 'cancelled', reason: 'cancelled-by-request', at: new Date().toISOString() });
  }
  report(readStatus());
}

requireCreated();
const release = readJson(files.release, {});
if (!release.appName || release.appName.includes('{{')) {
  fail({ id: 'no-app-name', step: null, message: 'アプリ名が決まっていません（release.config.json）。' });
}

// すでに確認ページを用意していれば、それを使う
const current = readStatus();
if (current.status === 'waiting') {
  report({ ...current, message: 'すでに確認ページを用意しています。アプリ内ブラウザで開いて、本人に操作してもらってください。' });
}
for (const f of [files.releaseResult, files.releaseRequest]) fs.rmSync(f, { force: true });

// 1. テスト
const vitest = path.join(APP_DIR, 'node_modules', 'vitest', 'vitest.mjs');
if (fs.existsSync(vitest)) {
  const t = spawnSync(process.execPath, [vitest, 'run'], { cwd: APP_DIR, encoding: 'utf8', windowsHide: true, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } });
  if (t.status !== 0) {
    const out = `${t.stdout || ''}\n${t.stderr || ''}`.trim();
    fail({ id: 'tests-failed', step: null, message: 'テストが通らないため、公開を止めました。AIが直します。', detail: out.slice(-2000) });
  }
}

// 2. Googleに送る
const push = runClasp(['push', '--force']);
if (!push.ok) fail(push.error, { stage: 'push' });

// 3. 確認ページを用意する
const summary = buildReleaseSummary();
if (!summary.access || !summary.executeAs) {
  fail({ id: 'no-webapp-setting', step: '07-who-can-use', message: '誰が使えるかがまだ決まっていません。先に決めてもらいます。' });
}
const token = crypto.randomBytes(16).toString('hex');
const child = spawn(process.execPath, [path.join(APP_DIR, 'scripts', 'release-server.mjs')], {
  cwd: APP_DIR,
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
  env: { ...process.env, GAS_KIT_RELEASE_TOKEN: token },
});
child.unref();

const deadline = Date.now() + 15000;
let request = null;
while (Date.now() < deadline) {
  request = readJson(files.releaseRequest, null);
  if (request && request.pid === child.pid) break;
  request = null;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
}
if (!request) {
  const log = fs.existsSync(files.releaseLog) ? fs.readFileSync(files.releaseLog, 'utf8').slice(-1500) : '';
  fail({ id: 'unknown', step: null, message: '公開の確認ページを用意できませんでした。', detail: log });
}

finish({
  ok: true,
  status: 'waiting',
  confirmUrl: request.confirmUrl,
  expiresAt: request.expiresAt,
  summary,
  message: '公開の確認ページを用意しました。本人がアプリ名を入力して「公開する」を押すと、みんなが使う画面が新しくなります。',
  next: 'confirmUrl をアプリ内ブラウザで開き、steps/08-release-confirm.md で案内する。入力とボタンは本人が操作する',
});
