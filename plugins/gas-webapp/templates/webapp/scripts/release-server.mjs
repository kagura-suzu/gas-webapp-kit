// 公開の確認ページ（npm run release が裏で起動する。直接は実行しない）。
// 本人がアプリ名を入力して「公開する」を押したときだけ、版を作ってみんなが使う画面を新しくする。
import http from 'node:http';
import fs from 'node:fs';
import {
  files, readJson, writeJson, runClasp, buildReleaseSummary, fingerprintSrc, urls, markProgress,
} from './lib.mjs';

const token = process.env.GAS_KIT_RELEASE_TOKEN;
const TTL_MS = 15 * 60 * 1000;
const createdAt = new Date();
const expiresAt = new Date(createdAt.getTime() + TTL_MS);
const summary = buildReleaseSummary();
const preparedFingerprint = JSON.stringify(fingerprintSrc());
let state = 'waiting';
let attempts = 0;

const log = (msg) => {
  try { fs.appendFileSync(files.releaseLog, `[${new Date().toISOString()}] ${msg}\n`); } catch { /* 記録できなくても続ける */ }
};

if (!token) {
  log('トークンがありません。npm run release から起動してください。');
  process.exit(1);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const timeText = (d) => new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);

function layout(title, body) {
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { --text:#1f2328; --muted:#59636e; --border:#d1d9e0; --accent:#1a6fd1; --danger:#c62828; --ok:#1b7f3b; --bg:#f5f6f8; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:system-ui,-apple-system,"Segoe UI","Hiragino Sans","Noto Sans JP","Yu Gothic UI",sans-serif; font-size:16px; line-height:1.7; }
  main { max-width:720px; margin:0 auto; padding:24px 16px 48px; }
  h1 { font-size:24px; margin:0 0 8px; }
  .lead { margin:0 0 20px; }
  .box { background:#fff; border:1px solid var(--border); border-radius:8px; padding:16px; margin-bottom:16px; }
  dl { margin:0; display:grid; grid-template-columns:minmax(0,1fr); gap:4px 16px; }
  @media (min-width:600px) { dl { grid-template-columns:180px minmax(0,1fr); } }
  dt { font-size:14px; font-weight:600; color:var(--muted); }
  dd { margin:0 0 8px; }
  .badge { display:inline-block; font-size:13px; font-weight:600; color:var(--danger); border:1px solid var(--danger); border-radius:4px; padding:0 6px; margin-left:6px; }
  .warn { border-color:var(--danger); }
  label { display:block; font-weight:600; margin-bottom:6px; }
  input[type=text] { width:100%; box-sizing:border-box; font:inherit; font-size:18px; padding:10px 12px; border:1px solid var(--border); border-radius:6px; }
  .actions { display:flex; flex-wrap:wrap; gap:12px; margin-top:16px; }
  button { min-height:48px; padding:8px 24px; font:inherit; font-size:17px; border-radius:6px; cursor:pointer; }
  .primary { background:var(--accent); color:#fff; border:1px solid var(--accent); font-weight:700; }
  .secondary { background:#fff; color:var(--text); border:1px solid var(--border); }
  button:disabled { opacity:.6; cursor:wait; }
  :focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
  .error { color:var(--danger); font-weight:600; }
  .ok { color:var(--ok); }
  .muted { color:var(--muted); font-size:14px; }
  a { color:var(--accent); overflow-wrap:anywhere; }
</style></head>
<body><main>${body}</main></body></html>`;
}

function confirmPage(errorText = '') {
  const s = summary;
  const changed = s.changedFiles.length + s.removedFiles.length;
  const fileList = [...s.changedFiles.map((f) => `<li>${esc(f)}</li>`), ...s.removedFiles.map((f) => `<li>${esc(f)}（削除）</li>`)].join('');
  return layout('公開の確認', `
<h1>みんなが使う画面を新しくします</h1>
<p class="lead">「公開する」を押すと、このアプリを使っている皆さんの画面が、すぐに新しくなります。</p>
<section class="box${s.accessChanged || s.executeAsChanged ? ' warn' : ''}" aria-label="公開する内容">
  <dl>
    <dt>アプリ名</dt><dd>${esc(s.appName)}</dd>
    <dt>誰が開けるか</dt><dd>${esc(s.accessWords)}${s.accessChanged ? '<span class="badge">前回から変わります</span>' : ''}</dd>
    <dt>誰の権限で動くか</dt><dd>${esc(s.executeAsWords)}${s.executeAsChanged ? '<span class="badge">前回から変わります</span>' : ''}</dd>
    <dt>前回の公開</dt><dd>${s.lastReleasedAt ? esc(timeText(new Date(s.lastReleasedAt))) : '初めての公開です'}</dd>
    <dt>変わったところ</dt><dd>${s.firstRelease ? 'すべて（初めての公開）' : `${changed}件のファイル`}
      ${changed > 0 && !s.firstRelease ? `<details><summary class="muted">ファイルの一覧</summary><ul>${fileList}</ul></details>` : ''}</dd>
  </dl>
</section>
<form method="post" class="box" id="confirm-form">
  <label for="appName">確認のため、アプリ名「${esc(s.appName)}」を入力してください</label>
  <input id="appName" name="appName" type="text" autocomplete="off" required aria-describedby="form-error">
  <p id="form-error" class="error" role="alert">${esc(errorText)}</p>
  <div class="actions">
    <button type="submit" name="action" value="publish" class="primary">公開する</button>
    <button type="submit" name="action" value="cancel" class="secondary" formnovalidate>やめる</button>
  </div>
  <p class="muted" id="working" hidden>公開しています。30秒ほどお待ちください…</p>
</form>
<p class="muted">このページは ${esc(timeText(expiresAt))} まで使えます。このパソコンの中だけで開いているページです。</p>
<script>
  document.getElementById('confirm-form').addEventListener('submit', function () {
    setTimeout(function () {
      document.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
      document.getElementById('working').hidden = false;
    }, 0);
  });
</script>`);
}

function messagePage(title, html) {
  return layout(title, `<h1>${esc(title)}</h1>${html}<p class="muted">このページは閉じて大丈夫です。AIに「できました」と送ってください。</p>`);
}

function writeResult(result) {
  writeJson(files.releaseResult, { ...result, at: new Date().toISOString() });
  log(`結果: ${result.status}`);
}

function doRelease() {
  if (JSON.stringify(fingerprintSrc()) !== preparedFingerprint) {
    return { status: 'failed', error: { id: 'changed-after-prepare', step: null, message: '確認ページを用意したあとにアプリが変わりました。もう一度、公開の準備からやり直します。' } };
  }
  const description = `公開 ${timeText(new Date())}`;
  const v = runClasp(['create-version', description]);
  if (!v.ok) return { status: 'failed', stage: 'create-version', error: v.error };
  const version = v.data && v.data.versionNumber;
  if (!version) return { status: 'failed', stage: 'create-version', error: { id: 'unknown', step: null, message: '版を作った結果を読み取れませんでした。', detail: v.stdout } };

  const release = readJson(files.release, {});
  let deploymentId = release.deploymentId;
  const d = deploymentId
    ? runClasp(['update-deployment', deploymentId, '--versionNumber', String(version), '--description', description])
    : runClasp(['create-deployment', '--versionNumber', String(version), '--description', description]);
  if (!d.ok) return { status: 'failed', stage: 'deploy', version, error: d.error };
  deploymentId = deploymentId || (d.data && d.data.deploymentId);
  if (!deploymentId) return { status: 'failed', stage: 'deploy', version, error: { id: 'unknown', step: null, message: '公開の結果を読み取れませんでした。', detail: d.stdout } };

  writeJson(files.release, { ...release, deploymentId });
  writeJson(files.lastRelease, {
    version,
    deploymentId,
    access: summary.access,
    executeAs: summary.executeAs,
    releasedAt: new Date().toISOString(),
    files: JSON.parse(preparedFingerprint),
  });
  markProgress('release');
  return { status: 'released', version, deploymentId, execUrl: urls.exec(deploymentId) };
}

function readForm(req) {
  return new Promise((resolve) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (c) => { body += c; if (body.length > 10000) req.destroy(); });
    req.on('end', () => resolve(new URLSearchParams(body)));
  });
}

function shutdownSoon() {
  setTimeout(() => process.exit(0), 2000);
}

const confirmPath = `/confirm/${token}`;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const html = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
  };
  if (url.pathname !== confirmPath) return html(404, messagePage('ページが見つかりません', '<p>AIが用意したURLを開いてください。</p>'));
  if (req.method === 'GET') {
    if (state === 'waiting') return html(200, confirmPage());
    return html(200, messagePage('この確認ページは使い終わりました', '<p>もう一度公開するときは、AIに頼んでください。</p>'));
  }
  if (req.method !== 'POST') return html(405, messagePage('この操作はできません', ''));
  if (state !== 'waiting') return html(409, messagePage('この確認ページは使い終わりました', '<p>もう一度公開するときは、AIに頼んでください。</p>'));

  const form = await readForm(req);
  if (form.get('action') === 'cancel') {
    state = 'done';
    writeResult({ status: 'cancelled', reason: 'cancelled-on-page' });
    html(200, messagePage('公開をやめました', '<p>みんなが使う画面は変わっていません。</p>'));
    return shutdownSoon();
  }
  const typed = String(form.get('appName') || '').trim();
  if (typed !== summary.appName) {
    attempts++;
    if (attempts >= 5) {
      state = 'done';
      writeResult({ status: 'cancelled', reason: 'too-many-attempts' });
      html(200, messagePage('公開をやめました', '<p>アプリ名が5回違ったため、止めました。みんなが使う画面は変わっていません。</p>'));
      return shutdownSoon();
    }
    return html(200, confirmPage(`アプリ名が違います。「${summary.appName}」と入力してください。`));
  }

  state = 'working';
  log('本人の確認を受けて公開を始めます');
  const result = doRelease();
  state = 'done';
  writeResult(result);
  if (result.status === 'released') {
    html(200, messagePage('公開しました', `<p class="ok">みんなが使う画面を新しくしました（版 ${esc(result.version)}）。</p><p>みんなが使う画面：<br><a href="${esc(result.execUrl)}" target="_blank" rel="noopener">${esc(result.execUrl)}</a></p>`));
  } else {
    html(200, messagePage('公開できませんでした', `<p class="error">${esc(result.error && result.error.message)}</p><p>みんなが使う画面は変わっていません。</p>`));
  }
  return shutdownSoon();
});

server.listen(0, '127.0.0.1', () => {
  const { port } = server.address();
  const confirmUrl = `http://127.0.0.1:${port}${confirmPath}`;
  writeJson(files.releaseRequest, {
    status: 'waiting',
    pid: process.pid,
    confirmUrl,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
  log(`確認ページを用意しました: ${confirmUrl}`);
});

setTimeout(() => {
  if (state === 'waiting') {
    writeResult({ status: 'expired' });
    process.exit(0);
  }
}, TTL_MS).unref();
