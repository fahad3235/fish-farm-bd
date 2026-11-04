'use strict';
/* Node unit tests for js/logic.js - run with: node tests/logic.test.js */
const assert = require('assert');
const L = require('../js/logic.js');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS: ' + name); }
  catch (e) { fail++; console.log('FAIL: ' + name + ' -> ' + e.message); }
}

const batch = {
  id: 'b1', name: 'Pukur 1', species: 'Rui', sizeDecimal: 10,
  stocked: 1000, fingerlingCostBdt: 5000, stockingDate: '2026-01-10', closed: false
};
const logs = [
  { id: 'l1', batchId: 'b1', date: '2026-01-11', feedKg: 10, feedCostBdt: 500, deaths: 50, note: '' },
  { id: 'l2', batchId: 'b1', date: '2026-01-12', feedKg: 20, feedCostBdt: 900, deaths: 30, note: '' }
];
const sales = [
  { id: 's1', batchId: 'b1', date: '2026-02-01', kg: 100, pricePerKgBdt: 200 },
  { id: 's2', batchId: 'b1', date: '2026-02-02', kg: 50, pricePerKgBdt: 180 }
];
// Hand-computed: alive 1000-80=920; revenue 100*200+50*180=29000 BDT;
// feed cost 1400 BDT; profit 29000-1400-5000=22600 BDT = 2260000 paisa.

check('toPaisa/fromPaisa round trip', () => {
  assert.strictEqual(L.toPaisa('12.34'), 1234);
  assert.strictEqual(L.toPaisa(0), 0);
  assert.strictEqual(L.fromPaisa(123456), '1,234.56');
  assert.strictEqual(L.fromPaisa(-500), '-5.00');
  assert.strictEqual(L.toPaisa('abc'), null);
  assert.strictEqual(L.toPaisa(-5), null);
});

check('profit math (hand-computed scenario)', () => {
  const st = L.batchStats(batch, logs, sales);
  assert.strictEqual(st.revenuePaisa, 2900000);
  assert.strictEqual(st.feedCostPaisa, 140000);
  assert.strictEqual(st.fingerlingCostPaisa, 500000);
  assert.strictEqual(st.profitPaisa, 2260000);
});

check('survival: 0 deaths = 100%, all dead = 0%', () => {
  const s0 = L.batchStats(batch, [], []);
  assert.strictEqual(s0.survivalPct, 100);
  const sAll = L.batchStats(batch, [{ id: 'x', batchId: 'b1', date: '2026-01-11', feedKg: 0, feedCostBdt: 0, deaths: 1000, note: '' }], []);
  assert.strictEqual(sAll.alive, 0);
  assert.strictEqual(sAll.survivalPct, 0);
});

check('stocking density (fish per decimal, 1 decimal display)', () => {
  const st = L.batchStats(batch, logs, sales);
  assert.strictEqual(st.density, 92);
  assert.strictEqual(st.density.toFixed(1), '92.0');
});

check('feed cost per fish alive', () => {
  const st = L.batchStats(batch, logs, sales);
  // 140000 paisa / 920 fish = 152.17 -> 152 paisa
  assert.strictEqual(st.feedCostPerFishPaisa, 152);
});

check('deaths exceeding fish alive rejected', () => {
  const errs = L.validateLog(
    { date: '2026-01-13', feedKg: 5, feedCostBdt: 100, deaths: 921 },
    batch, logs);
  assert.ok(errs.includes('deathsExceedAlive'));
  const ok = L.validateLog(
    { date: '2026-01-13', feedKg: 5, feedCostBdt: 100, deaths: 920 },
    batch, logs);
  assert.deepStrictEqual(ok, []);
});

check('future date rejected (batch, log, sale)', () => {
  assert.ok(L.validateBatch(Object.assign({}, batch, { stockingDate: '2999-01-01' })).includes('stockingDateFuture'));
  assert.ok(L.validateLog({ date: '2999-01-01', feedKg: 1, feedCostBdt: 10, deaths: 0 }, batch, []).includes('dateFuture'));
  assert.ok(L.validateSale({ date: '2999-01-01', kg: 10, pricePerKgBdt: 100 }).includes('dateFuture'));
});

check('sales revenue math', () => {
  assert.strictEqual(L.saleRevenuePaisa({ kg: 100, pricePerKgBdt: 200 }), 2000000);
  assert.strictEqual(L.saleRevenuePaisa({ kg: 2.5, pricePerKgBdt: 133.33 }), 33333); // 2.5*133.33=333.325 -> 33333 paisa
});

check('negative/zero validation', () => {
  assert.ok(L.validateLog({ date: '2026-01-11', feedKg: -1, feedCostBdt: 10, deaths: 0 }, batch, []).includes('feedKg'));
  assert.ok(L.validateSale({ date: '2026-01-11', kg: 0, pricePerKgBdt: 100 }).includes('kg'));
  assert.ok(L.validateSale({ date: '2026-01-11', kg: 10, pricePerKgBdt: 0 }).includes('pricePerKg'));
  assert.ok(L.validateBatch(Object.assign({}, batch, { stocked: 0 })).includes('stocked'));
  assert.ok(L.validateBatch(Object.assign({}, batch, { species: 'Salmon' })).includes('species'));
});

check('dashboard totals (hand-computed)', () => {
  const d = L.dashboard([batch], logs, sales);
  assert.strictEqual(d.activePonds, 1);
  assert.strictEqual(d.totalAlive, 920);
  assert.strictEqual(d.survivalPct, 92);
  assert.strictEqual(d.totalFeedKg, 30);
  assert.strictEqual(d.totalFeedCostPaisa, 140000);
  assert.strictEqual(d.totalRevenuePaisa, 2900000);
  assert.strictEqual(d.profitPaisa, 2260000);
});

check('dashboard excludes closed batches', () => {
  const closed = Object.assign({}, batch, { id: 'b2', closed: true });
  const d = L.dashboard([batch, closed], logs, sales);
  assert.strictEqual(d.activePonds, 1);
  assert.strictEqual(d.totalAlive, 920);
});

check('export/import round-trip validates', () => {
  const data = { app: 'fish-farm-bd', lang: 'en', batches: [batch], logs, sales };
  const round = JSON.parse(JSON.stringify(data));
  assert.deepStrictEqual(L.validateImport(round), []);
});

check('malformed import rejected', () => {
  assert.ok(L.validateImport(null).length > 0);
  assert.ok(L.validateImport({}).length > 0);
  assert.ok(L.validateImport({ app: 'other', batches: [], logs: [], sales: [] }).length > 0);
  assert.ok(L.validateImport({ app: 'fish-farm-bd', batches: [batch], logs: [{ id: 'z', batchId: 'nope', date: '2026-01-11', feedKg: 1, feedCostBdt: 1, deaths: 0 }], sales: [] }).length > 0);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
