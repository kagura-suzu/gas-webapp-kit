// パソコンの中で画面を確かめるためのサーバー（プレビュー）。
// 本物の doGet と画面のコードを動かし、google.script.run はこのサーバーの中のGAS再現環境で処理する。
// 使い方：npm run preview → http://localhost:8787/ を開く（?selftest=1 で自己テスト）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGasRuntime, createPreviewStore, toTransferable } from './gas-runtime.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '..');
const srcDir = path.join(appDir, 'src');
const port = Number(process.env.PORT || process.argv[2] || 8787);
const baseUrl = `http://localhost:${port}/`;
const sampleFile = path.join(here, 'sample-data.json');
const shimFile = path.join(here, 'client-shim.js');

const loadSample = () => (fs.existsSync(sampleFile) ? JSON.parse(fs.readFileSync(sampleFile, 'utf8')) : {});
let store = createPreviewStore(loadSample());

/** 毎回コードを読み直す（ファイルを直したら、ページを開き直すだけで反映される） */
function freshRuntime() {
  const runtime = createGasRuntime({ srcDir, store, baseUrl });
  // シートのIDがまだ無いとき（Googleに作る前）も、プレビューでは動くようにする
  runtime.eval("if (typeof CONFIG !== 'undefined' && !CONFIG.SPREADSHEET_ID) CONFIG.SPREADSHEET_ID = 'preview';");
  return runtime;
}

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' });
  res.end(body);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function errorPage(title, err) {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;line-height:1.6">
<h1 style="color:#c62828;font-size:20px">${escapeHtml(title)}</h1>
<pre id="preview-error" style="white-space:pre-wrap;background:#f5f6f8;padding:12px;border-radius:6px">${escapeHtml(err && err.stack ? err.stack : String(err))}</pre>
</body></html>`;
}

function injectIntoHead(html, extra) {
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}\n${extra}`);
  return `${extra}\n${html}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, baseUrl);
  try {
    if (req.method === 'GET' && url.pathname === '/__gas/shim.js') {
      return send(res, 200, 'text/javascript', fs.readFileSync(shimFile, 'utf8'));
    }
    if (req.method === 'POST' && url.pathname === '/__gas/run') {
      const { fn, args } = JSON.parse(await readBody(req));
      const started = Date.now();
      try {
        const value = freshRuntime().run(fn, Array.isArray(args) ? args : []);
        const result = toTransferable(value, fn);
        result.warnings.forEach((w) => console.warn(`[注意] ${w}`));
        console.log(`[run] ${fn} ${Date.now() - started}ms 成功`);
        return send(res, 200, 'application/json', JSON.stringify({ ok: true, ...result }));
      } catch (err) {
        console.log(`[run] ${fn} ${Date.now() - started}ms 失敗: ${err && err.message}`);
        return send(res, 200, 'application/json', JSON.stringify({ ok: false, error: { name: (err && err.name) || 'Error', message: (err && err.message) || String(err) } }));
      }
    }
    if (req.method === 'POST' && url.pathname === '/__gas/reset') {
      store = createPreviewStore(loadSample());
      return send(res, 200, 'application/json', JSON.stringify({ ok: true }));
    }
    if (url.pathname === '/favicon.ico') {
      res.writeHead(204);
      return res.end();
    }
    if (req.method !== 'GET') return send(res, 405, 'text/plain', 'Method Not Allowed');

    const params = {};
    for (const [k, v] of url.searchParams) (params[k] = params[k] || []).push(v);
    let output;
    try {
      output = freshRuntime().doGet(params);
    } catch (err) {
      console.error(`[doGet] 失敗: ${err && err.message}`);
      return send(res, 500, 'text/html', errorPage('doGet でエラーが起きました', err));
    }
    if (output && typeof output.getMimeType === 'function') {
      return send(res, 200, output.getMimeType(), output.getContent());
    }
    if (!output || typeof output.getContent !== 'function') {
      return send(res, 500, 'text/html', errorPage('doGet が画面を返していません', new Error('doGet は HtmlOutput か TextOutput を返す必要があります')));
    }
    const head = [
      output.getTitle && output.getTitle() ? `<title>${escapeHtml(output.getTitle())}</title>` : '',
      ...(output.metaTags || []).map((m) => `<meta name="${escapeHtml(m.name)}" content="${escapeHtml(m.content)}">`),
      '<script src="/__gas/shim.js"></script>',
    ].filter(Boolean).join('\n');
    return send(res, 200, 'text/html', injectIntoHead(output.getContent(), head));
  } catch (err) {
    console.error(err);
    return send(res, 500, 'text/html', errorPage('プレビューでエラーが起きました', err));
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`ポート ${port} はすでに使われています。プレビューがすでに起動していれば、そのまま ${baseUrl} を開いてください。別の番号で起動するには PORT=8788 のように指定します。`);
    process.exit(1);
  }
  throw err;
});

server.listen(port, () => {
  console.log(`プレビューを起動しました: ${baseUrl}`);
  console.log(`自己テスト: ${baseUrl}?selftest=1`);
});
