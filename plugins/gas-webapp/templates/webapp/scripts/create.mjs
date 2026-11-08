// Googleにアプリ（GAS）を作り、スプレッドシートに紐づける。
//   新しいシートを作る：npm run create -- --title "アプリ名"
//   今あるシートを使う：npm run create -- --title "アプリ名" --sheet "<シートのURL>"
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  APP_DIR, files, readJson, writeJson, parseArgs, finish, fail, runClasp, urls,
  getHeadDeploymentId, markProgress,
} from './lib.mjs';

const args = parseArgs(process.argv.slice(2));

if (fs.existsSync(files.clasp)) {
  fail({ id: 'already-created', step: null, message: 'このアプリはすでにGoogleに作られています。Googleに送るときは npm run push を使います。' });
}

const release = readJson(files.release, {});
const title = String(args.title && args.title !== true ? args.title : release.appName || path.basename(APP_DIR)).trim();
if (!title || title.includes('{{')) {
  fail({ id: 'no-title', step: null, message: 'アプリの名前が決まっていません。--title "アプリ名" を付けてください。' });
}

let sheetId = null;
if (args.sheet) {
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(String(args.sheet)) || /^([a-zA-Z0-9_-]{25,})$/.exec(String(args.sheet).trim());
  if (!m) {
    fail({ id: 'invalid-sheet', step: '05-choose-sheet', message: 'スプレッドシートのURLを読み取れませんでした。https://docs.google.com/spreadsheets/d/... の形のURLを貼ってください。' });
  }
  sheetId = m[1];
}

// clasp はフォルダの中に初期ファイルを取り込むため、一時フォルダで作ってから設定だけを移す
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gas-kit-create-'));
let scriptId;
let spreadsheetId;
try {
  const createArgs = sheetId
    ? ['create-script', '--title', title, '--parentId', sheetId]
    : ['create-script', '--title', title, '--type', 'sheets'];
  const res = runClasp(createArgs, { cwd: tmp });
  if (!res.ok) fail(res.error, { stage: 'create-script' });
  scriptId = res.data && res.data.scriptId;
  spreadsheetId = (res.data && res.data.parentId) || sheetId;
  if (!scriptId || !spreadsheetId) {
    fail({ id: 'unknown', step: null, message: 'アプリを作った結果を読み取れませんでした。', detail: res.stdout });
  }
  const tmpProject = readJson(path.join(tmp, '.clasp.json'), {});
  delete tmpProject.rootDir;
  writeJson(files.clasp, { ...tmpProject, scriptId, rootDir: 'src', parentId: spreadsheetId });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// 設定にアプリ名とシートのIDを書く
const jsString = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
let config = fs.readFileSync(files.config, 'utf8');
config = config
  .replace(/APP_NAME:\s*'(?:[^'\\]|\\.)*'/, () => `APP_NAME: ${jsString(title)}`)
  .replace(/SPREADSHEET_ID:\s*'[^']*'/, () => `SPREADSHEET_ID: ${jsString(spreadsheetId)}`)
  // 新しく作ったシートは時間帯がロサンゼルスになっているので、最初の読み書きで日本に合わせる。
  // 本人が選んだ既存のシートは変えない（自己テストでずれを知らせる）
  .replace(/MATCH_SHEET_TIME_ZONE:\s*(?:true|false)/, () => `MATCH_SHEET_TIME_ZONE: ${!sheetId}`);
fs.writeFileSync(files.config, config, 'utf8');
writeJson(files.release, { ...release, appName: title });
writeJson(files.state, { ...readJson(files.state, {}), scriptId, spreadsheetId, createdAt: new Date().toISOString() });
markProgress('create');

// 雛形のコードをGoogleに送る（Googleが最初に作った Code.gs は置き換わる）
const push = runClasp(['push', '--force']);
const base = {
  sheetUrl: urls.sheet(spreadsheetId),
  editorUrl: urls.editor(scriptId),
  createdNewSheet: !sheetId,
};
if (!push.ok) {
  finish({ ok: false, ...base, stage: 'push', message: `アプリは作れましたが、Googleに送れませんでした。${push.error.message}`, error: push.error });
}
markProgress('push');

const head = getHeadDeploymentId({ refresh: true });
const devUrl = head.ok ? urls.dev(head.id) : null;
finish({
  ok: true,
  ...base,
  devUrl,
  selftestUrl: devUrl ? `${devUrl}?selftest=1` : null,
  message: sheetId
    ? 'アプリを作り、指定のスプレッドシートに紐づけました。'
    : 'アプリとスプレッドシートを作りました。',
  next: '確認用の画面（selftestUrl）をアプリ内ブラウザで開き、初めて動かすときの許可を案内する（steps/06-first-run-permission.md）',
});
