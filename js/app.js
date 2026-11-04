'use strict';
/* Fish Farm BD - UI layer. Depends on js/logic.js and js/i18n.js (classic scripts). */
var KEY = 'fishFarmBd.v1';
var state = load();

function load() {
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var d = JSON.parse(raw);
      if (validateImport(d).length === 0) return { lang: d.lang || 'en', batches: d.batches, logs: d.logs, sales: d.sales };
    }
  } catch (e) { /* corrupted storage: start empty */ }
  return { lang: 'en', batches: [], logs: [], sales: [] };
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      app: 'fish-farm-bd', lang: state.lang,
      batches: state.batches, logs: state.logs, sales: state.sales
    }));
  } catch (e) { /* storage full/blocked: app still works in-memory */ }
}

function t(k) { return (I18N[state.lang] && I18N[state.lang][k]) || I18N.en[k] || k; }
function num(v) { return localizeNumber(String(v), state.lang); }
function money(p) { return num(fromPaisa(p)); }
function pct(x) { return num(x.toFixed(1)) + '%'; }
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function uid() { return 'id' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
function $(id) { return document.getElementById(id); }

function setText(id, key) { var el = $(id); if (el) el.textContent = t(key); }

function renderStatic() {
  setText('appTitle', 'appTitle');
  setText('tagline', 'tagline');
  $('langBtn').textContent = t('langBtn');
  setText('tabBtnDashboard', 'tabDashboard');
  setText('tabBtnBatches', 'tabBatches');
  setText('tabBtnData', 'tabData');
  setText('lblActivePonds', 'activePonds');
  setText('lblAlive', 'totalAlive');
  setText('lblSurvival', 'survival');
  setText('lblFeedKg', 'totalFeedKg');
  setText('lblFeedCost', 'totalFeedCost');
  setText('lblRevenue', 'totalRevenue');
  setText('lblProfit', 'profit');
  setText('lblPerBatch', 'perBatch');
  setText('lblAllDataNote', 'allDataNote');
  setText('lblAddBatch', 'addBatch');
  setText('lblPondName', 'pondName');
  setText('lblSpecies', 'species');
  setText('lblSize', 'sizeDecimal');
  setText('lblStocked', 'stocked');
  setText('lblFingerlingCost', 'fingerlingCost');
  setText('lblStockingDate', 'stockingDate');
  setText('btnSaveBatch', 'saveBatch');
  setText('lblExport', 'export');
  setText('btnExport', 'export');
  setText('lblImport', 'import');
  setText('btnImport', 'importBtn');
  $('importText').placeholder = t('importPlaceholder');
  setText('lblErase', 'eraseAll');
  setText('lblEraseHint', 'eraseHint');
  setText('btnErase', 'eraseBtn');
  setText('lblFooter', 'footer');
  document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
}

function renderDashboard() {
  var d = dashboard(state.batches, state.logs, state.sales);
  $('stActivePonds').textContent = num(d.activePonds);
  $('stAlive').textContent = num(d.totalAlive);
  $('stSurvival').textContent = pct(d.survivalPct);
  $('stFeedKg').textContent = num(d.totalFeedKg);
  $('stFeedCost').textContent = money(d.totalFeedCostPaisa);
  $('stRevenue').textContent = money(d.totalRevenuePaisa);
  $('stProfit').textContent = money(d.profitPaisa);
  var box = $('perBatch');
  var active = state.batches.filter(function (b) { return !b.closed; });
  if (!active.length) { box.innerHTML = '<p class="empty">' + esc(t('emptyBatches')) + '</p>'; return; }
  box.innerHTML = active.map(function (b) {
    var st = batchStats(b, state.logs, state.sales);
    return '<div class="rowline"><span><strong>' + esc(b.name) + '</strong> (' + esc(b.species) + ') - ' +
      t('alive') + ': ' + num(st.alive) + ', ' + t('survival') + ': ' + pct(st.survivalPct) + ', ' +
      t('density') + ': ' + num(st.density.toFixed(1)) + ', ' + t('feedCostPerFish') + ': ' + money(st.feedCostPerFishPaisa) +
      '</span></div>';
  }).join('');
}

function logFormHtml(b) {
  return '<h3>' + esc(t('dailyLogs')) + '</h3>' +
    '<form class="logForm" data-batch="' + b.id + '" novalidate>' +
    '<label>' + esc(t('logDate')) + '</label><input name="date" type="date" required>' +
    '<label>' + esc(t('feedKg')) + '</label><input name="feedKg" type="number" min="0" step="0.01" inputmode="decimal">' +
    '<label>' + esc(t('feedCost')) + '</label><input name="feedCost" type="number" min="0" step="0.01" inputmode="decimal">' +
    '<label>' + esc(t('deaths')) + '</label><input name="deaths" type="number" min="0" step="1" inputmode="numeric">' +
    '<label>' + esc(t('note')) + '</label><input name="note" type="text" maxlength="120">' +
    '<div class="err"></div>' +
    '<button class="primary" type="submit">' + esc(t('saveLog')) + '</button></form>';
}

function saleFormHtml(b) {
  return '<h3>' + esc(t('sales')) + '</h3>' +
    '<form class="saleForm" data-batch="' + b.id + '" novalidate>' +
    '<label>' + esc(t('logDate')) + '</label><input name="date" type="date" required>' +
    '<label>' + esc(t('kgSold')) + '</label><input name="kg" type="number" min="0" step="0.01" inputmode="decimal">' +
    '<label>' + esc(t('pricePerKg')) + '</label><input name="price" type="number" min="0" step="0.01" inputmode="decimal">' +
    '<div class="err"></div>' +
    '<button class="primary" type="submit">' + esc(t('saveSale')) + '</button></form>';
}

function renderBatches() {
  var box = $('batchList');
  if (!state.batches.length) { box.innerHTML = '<p class="empty">' + esc(t('emptyBatches')) + '</p>'; return; }
  box.innerHTML = state.batches.map(function (b) {
    var st = batchStats(b, state.logs, state.sales);
    var myLogs = state.logs.filter(function (l) { return l.batchId === b.id; }).slice().reverse();
    var mySales = state.sales.filter(function (s) { return s.batchId === b.id; }).slice().reverse();
    var logsHtml = myLogs.length ? myLogs.map(function (l) {
      return '<div class="rowline"><span>' + esc(l.date) + ' - ' + num(l.feedKg) + ' ' + esc(t('kg')) +
        ', ' + money(toPaisa(l.feedCostBdt)) + ', ' + esc(t('deaths')) + ': ' + num(l.deaths) +
        (l.note ? ' (' + esc(l.note) + ')' : '') + '</span></div>';
    }).join('') : '<p class="empty">' + esc(t('emptyLogs')) + '</p>';
    var salesHtml = mySales.length ? mySales.map(function (s) {
      return '<div class="rowline"><span>' + esc(s.date) + ' - ' + num(s.kg) + ' ' + esc(t('kg')) +
        ' x ' + money(toPaisa(s.pricePerKgBdt)) + ' = ' + money(saleRevenuePaisa(s)) + '</span></div>';
    }).join('') : '<p class="empty">' + esc(t('emptySales')) + '</p>';
    return '<div class="card" data-card="' + b.id + '"><h2>' + esc(b.name) +
      ' <span class="badge' + (b.closed ? ' closed' : '') + '">' + esc(b.closed ? t('closed') : t('active')) + '</span></h2>' +
      '<p>' + esc(b.species) + ' | ' + num(b.sizeDecimal) + ' decimal | ' + esc(t('stocked')) + ': ' + num(b.stocked) +
      ' | ' + esc(t('alive')) + ': ' + num(st.alive) + ' | ' + esc(t('survival')) + ': ' + pct(st.survivalPct) +
      ' | ' + esc(t('profit')) + ': ' + money(st.profitPaisa) + '</p>' +
      logFormHtml(b) + logsHtml + saleFormHtml(b) + salesHtml +
      '<button class="secondary" type="button" data-action="toggle" data-id="' + b.id + '">' +
      esc(b.closed ? t('reopenBatch') : t('closeBatch')) + '</button>' +
      '<button class="secondary danger" type="button" data-action="delete" data-id="' + b.id + '">' +
      esc(t('deleteBatch')) + '</button></div>';
  }).join('');

  box.querySelectorAll('.logForm').forEach(function (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var bid = form.getAttribute('data-batch');
      var batch = state.batches.find(function (x) { return x.id === bid; });
      var log = {
        id: uid(), batchId: bid,
        date: form.date.value, feedKg: form.feedKg.value,
        feedCostBdt: form.feedCost.value, deaths: form.deaths.value,
        note: form.note.value.trim()
      };
      var errs = validateLog(log, batch, state.logs);
      var errEl = form.querySelector('.err');
      if (errs.length) { errEl.textContent = logErrText(errs); return; }
      log.feedKg = Number(log.feedKg);
      log.deaths = Number(log.deaths);
      state.logs.push(log);
      save(); renderAll();
    });
  });
  box.querySelectorAll('.saleForm').forEach(function (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var bid = form.getAttribute('data-batch');
      var sale = {
        id: uid(), batchId: bid,
        date: form.date.value, kg: form.kg.value, pricePerKgBdt: form.price.value
      };
      var errs = validateSale(sale);
      var errEl = form.querySelector('.err');
      if (errs.length) { errEl.textContent = saleErrText(errs); return; }
      sale.kg = Number(sale.kg);
      state.sales.push(sale);
      save(); renderAll();
    });
  });
  box.querySelectorAll('[data-action]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var b = state.batches.find(function (x) { return x.id === btn.getAttribute('data-id'); });
      if (!b) return;
      if (btn.getAttribute('data-action') === 'toggle') { b.closed = !b.closed; }
      else {
        if (!window.confirm(t('confirmDeleteBatch'))) return;
        state.batches = state.batches.filter(function (x) { return x.id !== b.id; });
        state.logs = state.logs.filter(function (l) { return l.batchId !== b.id; });
        state.sales = state.sales.filter(function (s) { return s.batchId !== b.id; });
      }
      save(); renderAll();
    });
  });
}

function logErrText(errs) {
  if (errs.includes('dateFuture')) return t('errFuture');
  if (errs.includes('deathsExceedAlive')) return t('errDeaths');
  if (errs.includes('deaths')) return t('errNonNegative');
  if (errs.includes('feedKg')) return t('errNonNegative');
  return t('errInvalid');
}
function saleErrText(errs) {
  if (errs.includes('dateFuture')) return t('errFuture');
  if (errs.includes('kg') || errs.includes('pricePerKg')) return t('errPositive');
  return t('errInvalid');
}

function renderAll() { renderStatic(); renderDashboard(); renderBatches(); }

document.querySelectorAll('nav button').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('nav button').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab').forEach(function (s) { s.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById('tab-' + btn.getAttribute('data-tab')).classList.add('active');
  });
});

$('langBtn').addEventListener('click', function () {
  state.lang = state.lang === 'en' ? 'bn' : 'en';
  save(); renderAll();
});

$('batchForm').addEventListener('submit', function (ev) {
  ev.preventDefault();
  var b = {
    id: uid(), name: $('fName').value.trim(), species: $('fSpecies').value,
    sizeDecimal: $('fSize').value, stocked: $('fStocked').value,
    fingerlingCostBdt: $('fCost').value, stockingDate: $('fDate').value, closed: false
  };
  var errs = validateBatch(b);
  $('eName').textContent = errs.includes('name') ? t('errRequired') : '';
  $('eSpecies').textContent = errs.includes('species') ? t('errInvalid') : '';
  $('eSize').textContent = errs.includes('sizeDecimal') ? t('errPositive') : '';
  $('eStocked').textContent = errs.includes('stocked') ? t('errPositive') : '';
  $('eCost').textContent = errs.includes('fingerlingCost') ? t('errNonNegative') : '';
  $('eDate').textContent = errs.includes('stockingDateFuture') ? t('errFuture') : (errs.includes('stockingDate') ? t('errInvalid') : '');
  if (errs.length) return;
  b.sizeDecimal = Number(b.sizeDecimal);
  b.stocked = Number(b.stocked);
  state.batches.push(b);
  save();
  $('batchForm').reset();
  renderAll();
});

$('btnExport').addEventListener('click', function () {
  var msg = $('exportMsg');
  if (!state.batches.length && !state.logs.length && !state.sales.length) {
    msg.textContent = t('exportEmpty'); msg.className = 'msg bad'; return;
  }
  var blob = new Blob([JSON.stringify({ app: 'fish-farm-bd', lang: state.lang, batches: state.batches, logs: state.logs, sales: state.sales }, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'fish-farm-bd-export.json';
  a.click();
  URL.revokeObjectURL(a.href);
  msg.textContent = ''; msg.className = 'msg';
});

$('btnImport').addEventListener('click', function () {
  var msg = $('importMsg');
  var parsed;
  try { parsed = JSON.parse($('importText').value); } catch (e) { parsed = null; }
  if (!parsed || validateImport(parsed).length) {
    msg.textContent = t('importFail'); msg.className = 'msg bad'; return;
  }
  state = { lang: parsed.lang === 'bn' ? 'bn' : 'en', batches: parsed.batches, logs: parsed.logs, sales: parsed.sales };
  save(); renderAll();
  msg.textContent = t('importOk'); msg.className = 'msg ok';
});

$('btnErase').addEventListener('click', function () {
  var msg = $('eraseMsg');
  if ($('eraseText').value !== 'DELETE') {
    msg.textContent = t('eraseHint'); msg.className = 'msg bad'; return;
  }
  state = { lang: state.lang, batches: [], logs: [], sales: [] };
  save(); renderAll();
  $('eraseText').value = '';
  msg.textContent = t('eraseDone'); msg.className = 'msg ok';
});

renderAll();
