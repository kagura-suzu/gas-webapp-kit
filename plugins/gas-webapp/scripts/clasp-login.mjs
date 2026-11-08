// 道具（clasp）への許可を、アプリ内ブラウザで進められるようにする。
// clasp login を裏で起動して許可の画面のURLを取り出し、すぐに終わる（AIのシェルが待ち続けないように）。
//   node clasp-login.mjs --app "<アプリのフォルダ>"           許可の画面のURLを出す
//   node clasp-login.mjs --app "<アプリのフォルダ>" --status  許可済みか、どのアカウントかを確かめる
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs, finish, readJson, writeJson, claspEntry, claspUserArgs, runClaspJson } from './kit-lib.mjs';

const args = parseArgs(process.argv.slice(2));
if (typeof args.app !== 'string') {
  finish({ ok: false, error: { id: 'no-app', message: 'アプリのフォルダを指定してください（--app）。' } });
}
const appDir = path.resolve(args.app);
const stateDir = path.join(appDir, '.gas-kit');
const loginFile = path.join(stateDir, 'login.json');
const logFile = path.join(stateDir, 'login.log');

if (!fs.existsSync(claspEntry(appDir))) {
  finish({ ok: false, error: { id: 'tools-missing', message: 'パソコンとGoogleをつなぐ道具がまだ準備されていません。', detail: 'アプリのフォルダで npm install が必要です' } });
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

// clasp は許可が切れていても「保存あり」と答える。Googleからアカウント名を受け取れたときだけ使える状態とみなす
// （会社のGoogleの設定で、決まった時間ごとに許可し直しが要る場合がある：invalid_rapt）
function authorizedUser() {
  const res = runClaspJson(appDir, ['show-authorized-user']);
  const data = res.data || {};
  const stored = Boolean(data.loggedIn);
  const email = data.email || null;
  return { loggedIn: stored && Boolean(email), stored, email, raw: res.ok ? undefined : `${res.stderr}\n${res.stdout}`.trim() };
}

if (args.status) {
  const user = authorizedUser();
  const login = readJson(loginFile, null);
  const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
  const waiting = Boolean(login && isAlive(login.pid));
  finish({
    ok: user.loggedIn,
    loggedIn: user.loggedIn,
    email: user.email,
    waitingForBrowser: waiting && !user.loggedIn,
    authUrl: waiting ? login.authUrl : null,
    failed: /Authorization failed|Error:/i.test(log) && !user.loggedIn,
    message: user.loggedIn
      ? `許可済みです（${user.email}）。`
      : waiting
        ? '許可の画面で本人が操作するのを待っています。'
        : user.stored
          ? '許可が切れています。もう一度許可をお願いしてください（--force）。'
          : 'まだ許可されていません。',
  });
}

const before = authorizedUser();
if (before.loggedIn && !args.force) {
  finish({ ok: true, loggedIn: true, email: before.email, message: `すでに許可済みです（${before.email}）。` });
}

// 前回の待ちが残っていれば止める
const previous = readJson(loginFile, null);
if (previous && isAlive(previous.pid)) {
  try { process.kill(previous.pid); } catch { /* すでに終わっている */ }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

const port = Number(args.port) || await freePort();
fs.mkdirSync(stateDir, { recursive: true });
const out = fs.openSync(logFile, 'w');
const child = spawn(process.execPath, [claspEntry(appDir), ...claspUserArgs(), 'login', '--redirect-port', String(port)], {
  cwd: appDir,
  detached: true,
  stdio: ['ignore', out, out],
  windowsHide: true,
  env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
});
child.unref();
fs.closeSync(out);

const deadline = Date.now() + 20000;
let authUrl = null;
while (Date.now() < deadline && !authUrl) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
  const m = /https:\/\/accounts\.google\.com\/[^\s'"`]+/.exec(log);
  if (m) authUrl = m[0];
  else if (!isAlive(child.pid)) break;
}

if (!authUrl) {
  const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
  finish({ ok: false, error: { id: 'unknown', message: '許可の画面を用意できませんでした。', detail: log.slice(-1500) } });
}

writeJson(loginFile, { pid: child.pid, port, authUrl, startedAt: new Date().toISOString() });
finish({
  ok: true,
  loggedIn: false,
  authUrl,
  message: '許可の画面を用意しました。アプリ内ブラウザで開いて、本人に許可してもらってください。',
  note: 'いつものブラウザにも同じ画面が開くことがあります。どちらで進めても結果は同じです。',
  next: '本人から「できました」が届いたら --status で確かめる',
});
