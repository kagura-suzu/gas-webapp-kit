// 環境チェック。上から順に確かめ、自分で直せるものは直し、本人の操作が要るものは next で案内先を返す。
//   node doctor.mjs                                 パソコンの準備だけ確かめる
//   node doctor.mjs --app "<アプリのフォルダ>" [--fix] [--online]
//     --fix     道具が足りなければ npm install する
//     --online  Googleにつないで、許可とスイッチ（Apps Script API）まで確かめる
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  parseArgs, finish, readJson, findNpmCli, runNpm, pinnedClaspVersion, claspEntry,
  hasStoredClaspCredentials, runClaspJson, kitVersion,
} from './kit-lib.mjs';
import { explainError } from '../templates/webapp/scripts/errors.mjs';

const args = parseArgs(process.argv.slice(2));
const appDir = typeof args.app === 'string' ? path.resolve(args.app) : null;
const checks = [];
const add = (id, ok, message, extra = {}) => checks.push({ id, ok, message, ...extra });

// 1. 土台ソフト（Node.js）
const major = Number(process.versions.node.split('.')[0]);
add('node', major >= 20, major >= 20 ? `土台ソフトは準備できています（Node.js ${process.versions.node}）。` : `土台ソフトが古いです（Node.js ${process.versions.node}）。新しくする必要があります。`, {
  version: process.versions.node,
  step: major >= 20 ? null : '01-install-node',
});

// 2. npm
const npmCli = findNpmCli();
const npmVersion = runNpm(['-v'], { cwd: process.cwd(), timeout: 60000 });
add('npm', npmVersion.ok, npmVersion.ok ? '道具を入れる仕組み（npm）は使えます。' : '道具を入れる仕組み（npm）が見つかりません。', {
  version: npmVersion.ok ? npmVersion.stdout.trim() : null,
  via: npmCli ? 'npm-cli.js' : 'shell',
  step: npmVersion.ok ? null : '01-install-node',
});

// 3. PowerShell の実行ポリシー（情報だけ。変えない）
if (process.platform === 'win32') {
  const ps = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-ExecutionPolicy'], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  const policy = (ps.stdout || '').trim();
  const blocks = /^(Restricted|AllSigned|Undefined)$/i.test(policy);
  add('execution-policy', true, blocks
    ? 'PowerShellでは npm.ps1 が止められる設定です。AIは npm.cmd か node で実行します（設定は変えません）。'
    : 'PowerShellの設定に問題はありません。', { policy, useCmd: blocks });
}

// 4. 道具（clasp）への許可（パソコンに記録があるか。Googleには問い合わせない）
const stored = hasStoredClaspCredentials();
if (!appDir) {
  add('login-stored', stored, stored ? '道具（clasp）への許可の記録があります。' : 'まだ道具（clasp）に許可を出していません。アプリのフォルダを作ったあとに案内します。', {
    step: null,
  });
}

if (appDir) {
  // 5. アプリのフォルダ
  const pkg = readJson(path.join(appDir, 'package.json'), null);
  add('app-folder', Boolean(pkg), pkg ? 'アプリのフォルダがあります。' : 'アプリのフォルダが見つかりません。', { appDir });

  if (pkg) {
    // 6. 道具（clasp と Vitest）
    const pinned = pinnedClaspVersion();
    const installedVersion = () => (readJson(path.join(appDir, 'node_modules', '@google', 'clasp', 'package.json'), {}) || {}).version;
    let installed = installedVersion();
    let fixed = false;
    if ((!installed || installed !== pinned) && args.fix) {
      const r = runNpm(['install', '--no-fund', '--no-audit', '--loglevel=error'], { cwd: appDir });
      fixed = r.ok;
      installed = installedVersion();
    }
    const toolsOk = installed === pinned && fs.existsSync(path.join(appDir, 'node_modules', 'vitest'));
    add('tools', toolsOk, toolsOk
      ? `パソコンとGoogleをつなぐ道具は準備できています（clasp ${installed}）。${fixed ? '今回準備しました。' : ''}`
      : 'パソコンとGoogleをつなぐ道具の準備が必要です。', { installed: installed || null, pinned, fixed, fix: toolsOk ? null : 'npm install' });

    // 7. Googleとつながっているか（.clasp.json）
    const project = readJson(path.join(appDir, '.clasp.json'), null);
    const created = Boolean(project && project.scriptId);
    add('created', true, created ? 'Googleにアプリが作られています。' : 'まだGoogleにアプリを作っていません（npm run create）。', { created });

    // 8. 許可とスイッチ（Googleに問い合わせる）
    if (args.online && toolsOk) {
      const who = runClaspJson(appDir, ['show-authorized-user']);
      const loggedIn = Boolean(who.data && who.data.loggedIn);
      add('login', loggedIn, loggedIn
        ? `道具（clasp）への許可が済んでいます（${(who.data && who.data.email) || 'アカウント名は確認できませんでした'}）。`
        : 'まだ道具（clasp）に許可を出していません。', { email: (who.data && who.data.email) || null, step: loggedIn ? null : '03-clasp-allow' });

      if (loggedIn && created) {
        const dep = runClaspJson(appDir, ['list-deployments']);
        if (dep.ok) {
          add('api', true, 'パソコンから操作するためのスイッチは入っています。');
        } else {
          const e = explainError(`${dep.stderr}\n${dep.stdout}`);
          add('api', false, e.message, { error: e, step: e.step });
        }
      } else if (loggedIn) {
        add('api', true, 'パソコンから操作するためのスイッチは、アプリを作るときに確かめます。', { unknown: true });
      }
    } else if (!args.online) {
      add('login-stored', stored, stored ? '道具（clasp）への許可の記録があります（Googleには未確認）。' : 'まだ道具（clasp）に許可を出していません。', {
        step: stored ? null : '03-clasp-allow',
      });
    }
  }
}

const failed = checks.filter((c) => !c.ok);
const next = failed.find((c) => c.step) || failed[0] || null;
finish({
  ok: failed.length === 0,
  kitVersion: kitVersion(),
  checks,
  next: next ? { id: next.id, step: next.step || null, message: next.message, fix: next.fix || null } : null,
  message: failed.length === 0 ? '準備はできています。' : `準備がまだのものが${failed.length}つあります。`,
});
