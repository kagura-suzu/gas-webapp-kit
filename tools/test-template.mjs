// 雛形の通し確認：一時フォルダに新しいアプリを作り、道具を入れてテストを実行する。
// Googleには接続しない。終わったら一時フォルダを消す（--keep で残す）。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const keep = process.argv.includes('--keep');
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gas-kit-template-'));
const appDir = path.join(base, 'テストのアプリ');

const run = (args, cwd) => {
  const r = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', windowsHide: true, env: { ...process.env, NO_COLOR: '1' } });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  return r.status === 0;
};

let ok = run([path.join(root, 'plugins', 'gas-webapp', 'scripts', 'new-app.mjs'), '--name', 'テストのアプリ', '--dir', appDir], root);
if (ok) ok = run([path.join(appDir, 'node_modules', 'vitest', 'vitest.mjs'), 'run'], appDir);
if (ok) ok = run([path.join(root, 'plugins', 'gas-webapp', 'scripts', 'doctor.mjs'), '--app', appDir], root);

if (keep) console.log(`アプリのフォルダを残しました: ${appDir}`);
else fs.rmSync(base, { recursive: true, force: true });
console.log(ok ? '雛形の通し確認：成功' : '雛形の通し確認：失敗');
process.exit(ok ? 0 : 1);
