// ロジックのテスト。preview/gas-runtime.mjs で src/ のGASのコードを読み込んで呼ぶ。
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGasRuntime, createPreviewStore, toTransferable } from '../preview/gas-runtime.mjs';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const HEADERS = ['日時', '内容', '担当'];

function setup(sheets = { 記録: [HEADERS] }, options = {}) {
  const gas = createGasRuntime({ srcDir, store: createPreviewStore(sheets, options) });
  gas.eval("CONFIG.SPREADSHEET_ID = 'test-sheet'");
  return gas;
}

describe('入力チェック（validateRecord_）', () => {
  it('内容が空なら止める', () => {
    const result = setup().get('validateRecord_')({ content: '   ', person: '' });
    expect(result.ok).toBe(false);
    expect(result.errors.content).toBe('内容を入力してください');
  });

  it('前後の空白を取り除いて受け付ける', () => {
    const result = setup().get('validateRecord_')({ content: ' 見積書を送付 ', person: ' 佐藤 ' });
    expect(result).toEqual({ ok: true, value: { content: '見積書を送付', person: '佐藤' } });
  });

  it('長すぎる内容と担当を止める', () => {
    const result = setup().get('validateRecord_')({ content: 'あ'.repeat(501), person: 'い'.repeat(51) });
    expect(result.ok).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(['content', 'person']);
  });
});

describe('一覧と追加', () => {
  it('記録が無いときは空の一覧を返す', () => {
    expect(setup().run('getRecords').rows).toEqual([]);
  });

  it('シートが無いときは見出し付きで作る', () => {
    const gas = setup({});
    expect(gas.run('getRecords').rows).toEqual([]);
    const sheet = gas.store.open('test-sheet').getSheetByName('記録');
    expect(sheet.getRange(1, 1, 1, 3).getValues()[0]).toEqual(HEADERS);
  });

  it('追加した記録が新しい順に、画面に渡せる形で返る', () => {
    const gas = setup();
    expect(gas.run('addRecord', [{ content: '1件目', person: '佐藤' }])).toEqual({ ok: true });
    expect(gas.run('addRecord', [{ content: '2件目', person: '' }])).toEqual({ ok: true });
    const records = gas.run('getRecords');
    expect(records.rows.map((r) => r.content)).toEqual(['2件目', '1件目']);
    expect(records.rows[0].date).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
    // 日付（Date）が入っていると、本物のGASでは画面に null が届く
    expect(toTransferable(records, 'getRecords').warnings).toEqual([]);
  });

  it('入力に問題があるときは追加しない', () => {
    const gas = setup();
    expect(gas.run('addRecord', [{ content: '' }]).ok).toBe(false);
    expect(gas.run('getRecords').rows).toEqual([]);
  });

  it('名前が _ で終わる関数は画面から呼べない', () => {
    expect(() => setup().run('getSheet_')).toThrow('Script function not found');
  });
});

describe('入口と自己テスト', () => {
  it('画面にアプリ名と自己テストの切り替えが入る', () => {
    const html = setup().doGet({ selftest: ['1'] }).getContent();
    expect(html).toContain('<h1>');
    expect(html).toContain('const SELFTEST = true;');
    expect(html).toContain('id="record-form"');
  });

  it('サーバーの自己テストがすべて成功する', () => {
    const result = setup().run('runServerSelftest');
    expect(result.failed).toBe(0);
    expect(result.ok).toBe(true);
  });

  it('シートの時間帯がアプリと違うと、自己テストで知らせる（既存のシートは変えない）', () => {
    const gas = setup(undefined, { timeZone: 'America/Los_Angeles' });
    const result = gas.run('runServerSelftest');
    const check = result.checks.find((c) => c.name === 'シートの時間帯がアプリと同じ');
    expect(check.ok).toBe(false);
    expect(check.detail).toContain('America/Los_Angeles');
    expect(gas.store.open('test-sheet').getSpreadsheetTimeZone()).toBe('America/Los_Angeles');
  });

  it('新しく作ったシートは、最初の読み書きで時間帯をアプリに合わせる', () => {
    const gas = setup(undefined, { timeZone: 'America/Los_Angeles' });
    gas.eval('CONFIG.MATCH_SHEET_TIME_ZONE = true');
    gas.run('getRecords');
    expect(gas.store.open('test-sheet').getSpreadsheetTimeZone()).toBe('Asia/Tokyo');
    expect(gas.run('runServerSelftest').ok).toBe(true);
  });

  it('?api=selftest でJSONを返す', () => {
    const output = setup().doGet({ api: ['selftest'] });
    expect(output.getMimeType()).toBe('application/json');
    expect(JSON.parse(output.getContent()).ok).toBe(true);
  });
});
