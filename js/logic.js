'use strict';
/* fish-farm-bd pure logic. All money is integer paisa (1 BDT = 100 paisa).
   No DOM, no localStorage, no network here: node-testable. */

function toPaisa(value) {
  // Accepts number or numeric string (BDT). Returns integer paisa or null if invalid.
  if (value === '' || value === null || value === undefined) return null;
  var n = Number(value);
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function fromPaisa(paisa) {
  // Integer paisa -> "1,234.56" string, 2 decimals, no float error.
  var neg = paisa < 0;
  var a = Math.abs(paisa);
  var whole = Math.floor(a / 100);
  var frac = a % 100;
  var ws = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + ws + '.' + (frac < 10 ? '0' : '') + frac;
}

function isValidDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function todayLocal() {
  var d = new Date();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

function isFutureDate(s) {
  return isValidDateStr(s) && s > todayLocal();
}

function validateBatch(b) {
  var errs = [];
  if (!b || typeof b.name !== 'string' || b.name.trim() === '') errs.push('name');
  var species = ['Rui', 'Katla', 'Mrigel', 'Tilapia', 'Pangas', 'Koi', 'Shing', 'Magur'];
  if (!species.includes(b.species)) errs.push('species');
  if (!(Number(b.sizeDecimal) > 0) || !isFinite(Number(b.sizeDecimal))) errs.push('sizeDecimal');
  if (!Number.isInteger(Number(b.stocked)) || Number(b.stocked) <= 0) errs.push('stocked');
  if (toPaisa(b.fingerlingCostBdt) === null) errs.push('fingerlingCost');
  if (!isValidDateStr(b.stockingDate)) errs.push('stockingDate');
  else if (isFutureDate(b.stockingDate)) errs.push('stockingDateFuture');
  return errs;
}

function batchAlive(batch, logs) {
  var deaths = 0;
  logs.forEach(function (l) { if (l.batchId === batch.id) deaths += l.deaths; });
  return Math.max(0, batch.stocked - deaths);
}

function validateLog(log, batch, logs) {
  var errs = [];
  if (!isValidDateStr(log.date)) errs.push('date');
  else if (isFutureDate(log.date)) errs.push('dateFuture');
  if (!(Number(log.feedKg) >= 0) || !isFinite(Number(log.feedKg))) errs.push('feedKg');
  if (toPaisa(log.feedCostBdt) === null) errs.push('feedCost');
  if (!Number.isInteger(Number(log.deaths)) || Number(log.deaths) < 0) errs.push('deaths');
  else {
    var alive = batchAlive(batch, logs);
    if (Number(log.deaths) > alive) errs.push('deathsExceedAlive');
  }
  return errs;
}

function validateSale(sale) {
  var errs = [];
  if (!isValidDateStr(sale.date)) errs.push('date');
  else if (isFutureDate(sale.date)) errs.push('dateFuture');
  if (!(Number(sale.kg) > 0) || !isFinite(Number(sale.kg))) errs.push('kg');
  if (toPaisa(sale.pricePerKgBdt) === null || toPaisa(sale.pricePerKgBdt) === 0) errs.push('pricePerKg');
  return errs;
}

function saleRevenuePaisa(sale) {
  // kg (up to 2 decimals) x price paisa/kg -> integer paisa, rounded half-up.
  var kg100 = Math.round(Number(sale.kg) * 100);
  var price = toPaisa(sale.pricePerKgBdt);
  return Math.round((kg100 * price) / 100);
}

function batchStats(batch, logs, sales) {
  var myLogs = logs.filter(function (l) { return l.batchId === batch.id; });
  var mySales = sales.filter(function (s) { return s.batchId === batch.id; });
  var deaths = 0, feedKg = 0, feedCost = 0;
  myLogs.forEach(function (l) {
    deaths += l.deaths;
    feedKg += Number(l.feedKg);
    feedCost += toPaisa(l.feedCostBdt) || 0;
  });
  var revenue = 0;
  mySales.forEach(function (s) { revenue += saleRevenuePaisa(s); });
  var alive = Math.max(0, batch.stocked - deaths);
  var survival = batch.stocked > 0 ? (alive / batch.stocked) * 100 : 0;
  var density = batch.sizeDecimal > 0 ? alive / batch.sizeDecimal : 0;
  var fingerlingCost = toPaisa(batch.fingerlingCostBdt) || 0;
  return {
    alive: alive,
    deaths: deaths,
    survivalPct: survival,
    density: density,
    feedKg: feedKg,
    feedCostPaisa: feedCost,
    revenuePaisa: revenue,
    fingerlingCostPaisa: fingerlingCost,
    profitPaisa: revenue - feedCost - fingerlingCost,
    feedCostPerFishPaisa: alive > 0 ? Math.round(feedCost / alive) : 0
  };
}

function dashboard(batches, logs, sales) {
  var active = batches.filter(function (b) { return !b.closed; });
  var totalAlive = 0, totalStocked = 0, totalFeedKg = 0, totalFeedCost = 0,
      totalRevenue = 0, totalFingerling = 0;
  active.forEach(function (b) {
    var st = batchStats(b, logs, sales);
    totalAlive += st.alive;
    totalStocked += b.stocked;
    totalFeedKg += st.feedKg;
    totalFeedCost += st.feedCostPaisa;
    totalRevenue += st.revenuePaisa;
    totalFingerling += st.fingerlingCostPaisa;
  });
  return {
    activePonds: active.length,
    totalAlive: totalAlive,
    survivalPct: totalStocked > 0 ? (totalAlive / totalStocked) * 100 : 0,
    totalFeedKg: totalFeedKg,
    totalFeedCostPaisa: totalFeedCost,
    totalRevenuePaisa: totalRevenue,
    profitPaisa: totalRevenue - totalFeedCost - totalFingerling
  };
}

function validateImport(data) {
  var errs = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['root'];
  if (data.app !== 'fish-farm-bd') errs.push('app');
  if (!Array.isArray(data.batches) || !Array.isArray(data.logs) || !Array.isArray(data.sales)) {
    errs.push('arrays');
    return errs;
  }
  var ids = {};
  data.batches.forEach(function (b, i) {
    if (!b || typeof b.id !== 'string' || !b.id) { errs.push('batch[' + i + '].id'); return; }
    if (ids[b.id]) errs.push('batch[' + i + '].dupId');
    ids[b.id] = true;
    if (validateBatch(b).length) errs.push('batch[' + i + ']');
    if (typeof b.closed !== 'boolean') errs.push('batch[' + i + '].closed');
  });
  data.logs.forEach(function (l, i) {
    if (!l || !ids[l.batchId]) { errs.push('log[' + i + '].batchId'); return; }
    var batch = data.batches.find(function (b) { return b.id === l.batchId; });
    var others = data.logs.filter(function (x, j) { return x.batchId === l.batchId && j !== i; });
    if (validateLog(l, batch, others).length) errs.push('log[' + i + ']');
  });
  data.sales.forEach(function (s, i) {
    if (!s || !ids[s.batchId]) { errs.push('sale[' + i + '].batchId'); return; }
    if (validateSale(s).length) errs.push('sale[' + i + ']');
  });
  return errs;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    toPaisa: toPaisa, fromPaisa: fromPaisa, isValidDateStr: isValidDateStr,
    todayLocal: todayLocal, isFutureDate: isFutureDate,
    validateBatch: validateBatch, batchAlive: batchAlive,
    validateLog: validateLog, validateSale: validateSale,
    saleRevenuePaisa: saleRevenuePaisa, batchStats: batchStats,
    dashboard: dashboard, validateImport: validateImport
  };
}
