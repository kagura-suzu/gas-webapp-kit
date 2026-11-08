// 雛形から新しいアプリのフォルダを作り、道具を準備する（npm install）。
//   node new-app.mjs --name "アプリ名" [--dir "<フォルダ>"] [--no-install]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TEMPLATE_DIR, parseArgs, finish, readJson, writeJson, runNpm, kitVersion } from './kit-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const name = typeof args.name === 'string' ? args.name.trim() : '';
if (!name) {
  finish({ ok: false, error: { id: 'no-name', message: 'アプリの名前を決めてください（--name "アプリ名"）。' } });
}

const safeFolderName = name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
const appDir = path.resolve(typeof args.dir === 'string' ? args.dir : path.join(os.homedir(), 'Documents', 'GASアプリ', safeFolderName));
const progressFile = path.join(appDir, '.gas-kit', 'progress.json');

// すでにこのキットで作ったフォルダなら、続きから再開する
if (fs.existsSync(progressFile)) {
  finish({ ok: true, resumed: true, appDir, progress: readJson(progressFile, {}), message: '前回作ったアプリのフォルダが見つかりました。続きから再開します。' });
}
if (fs.existsSync(appDir) && fs.readdirSync(appDir).length > 0) {
  finish({ ok: false, appDir, error: { id: 'dir-not-empty', message: 'そのフォルダには、すでに別のファイルがあります。別の名前か場所にします。' } });
}

// 雛形をコピーする
fs.mkdirSync(appDir, { recursive: true });
fs.cpSync(TEMPLATE_DIR, appDir, {
  recursive: true,
  filter: (src) => !path.relative(TEMPLATE_DIR, src).split(path.sep).some((p) => p === 'node_modules' || p === '.gas-kit'),
});
if (fs.existsSync(path.join(appDir, '_gitignore'))) fs.renameSync(path.join(appDir, '_gitignore'), path.join(appDir, '.gitignore'));

// アプリ名を書き込む
const jsString = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const configFile = path.join(appDir, 'src', 'server', 'config.js');
fs.writeFileSync(configFile, fs.readFileSync(configFile, 'utf8').replace("'{{APP_NAME}}'", () => jsString(name)), 'utf8');
const agentsFile = path.join(appDir, 'AGENTS.md');
fs.writeFileSync(agentsFile, fs.readFileSync(agentsFile, 'utf8').replaceAll('{{APP_NAME}}', () => name), 'utf8');
writeJson(path.join(appDir, 'release.config.json'), { ...readJson(path.join(appDir, 'release.config.json'), {}), appName: name });

const now = new Date().toISOString();
writeJson(progressFile, {
  appName: name,
  kitVersion: kitVersion(),
  createdAt: now,
  updatedAt: now,
  steps: { folder: { status: 'done', at: now } },
});

if (args['no-install']) {
  finish({ ok: true, appDir, installed: false, message: 'アプリのフォルダを用意しました。' });
}

// 道具を準備する（clasp と Vitest をこのフォルダに入れる）
const install = runNpm(['install', '--no-fund', '--no-audit', '--loglevel=error'], { cwd: appDir });
if (!install.ok) {
  finish({
    ok: false,
    appDir,
    error: {
      id: 'install-failed',
      message: '道具の準備がうまくいきませんでした。インターネットの接続を確かめて、もう一度試します。',
      detail: `${install.stderr}\n${install.stdout}`.trim().slice(-1500),
    },
  });
}
const progress = readJson(progressFile, {});
progress.steps.tools = { status: 'done', at: new Date().toISOString() };
writeJson(progressFile, progress);

finish({
  ok: true,
  appDir,
  installed: true,
  message: 'アプリのフォルダと道具を用意しました。',
  next: 'clasp-login.mjs --status で許可済みか確かめ、まだなら steps/02 → 03 を案内する',
});
