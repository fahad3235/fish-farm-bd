'use strict';
/* Headless-Chrome smoke test via CDP (Node 24 global WebSocket).
   Run with: node tests/smoke.js
   Scenario (hand-computed): batch Rui, 10 decimals, 1000 stocked, 5000 BDT
   fingerling cost, stocked 2026-01-10. Log 2026-01-11: 10 kg feed, 500 BDT,
   50 deaths. Sale 2026-02-01: 100 kg @ 200 BDT = 20000 revenue.
   Expected dashboard: alive 950, survival 95.0%, feed 10 kg, feed cost 500.00,
   revenue 20,000.00, profit 20000-500-5000 = 14,500.00. */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = process.env.SMOKE_CHROME || '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const PORT = 9223;
const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS: ' + name); }
  else { fail++; console.log('FAIL: ' + name + (extra ? ' -> ' + extra : '')); }
}

async function waitFor(pred, timeoutMs, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await pred(); if (v) return v; } catch (e) { /* retry */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('timeout waiting for ' + label);
}

async function main() {
  const chrome = spawn(CHROME, [
    '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--window-size=390,844',
    '--user-data-dir=/tmp/ffbd-smoke-profile', 'about:blank'
  ], { stdio: 'ignore' });
  try {
    const targets = await waitFor(async () => {
      const res = await fetch('http://127.0.0.1:' + PORT + '/json');
      const list = await res.json();
      return list.length ? list : null;
    }, 20000, 'devtools targets');
    const wsUrl = targets.find(t => t.type === 'page').webSocketDebuggerUrl;
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let seq = 0;
    const pending = new Map();
    const consoleErrors = [];
    const pageErrors = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        consoleErrors.push(JSON.stringify(msg.params.args));
      } else if (msg.method === 'Runtime.exceptionThrown') {
        pageErrors.push(msg.params.exceptionDetails.exception.description || 'exception');
      }
    };
    const send = (method, params) => new Promise((res, rej) => {
      const id = ++seq;
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
    const ev = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      if (r.exceptionDetails) throw new Error('eval exception: ' + JSON.stringify(r.exceptionDetails));
      return r.result.value;
    };
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: PAGE });
    await waitFor(async () => (await ev('document.readyState')) === 'complete', 15000, 'page load');

    check('page renders with title', (await ev('document.title')).includes('Fish Farm BD'), await ev('document.title'));
    check('header shows app title', (await ev("document.getElementById('appTitle').textContent")) === 'Fish Farm BD');

    // Add batch via the real form
    await ev("document.getElementById('fName').value = 'Pukur 1'");
    await ev("document.getElementById('fSpecies').value = 'Rui'");
    await ev("document.getElementById('fSize').value = '10'");
    await ev("document.getElementById('fStocked').value = '1000'");
    await ev("document.getElementById('fCost').value = '5000'");
    await ev("document.getElementById('fDate').value = '2026-01-10'");
    await ev("document.getElementById('batchForm').requestSubmit()");
    await waitFor(async () => (await ev("document.getElementById('batchList').textContent")).includes('Pukur 1'), 5000, 'batch card');
    check('add batch flow creates card', true);

    // Add daily log via the batch card form
    await ev("document.querySelector('.logForm input[name=date]').value = '2026-01-11'");
    await ev("document.querySelector('.logForm input[name=feedKg]').value = '10'");
    await ev("document.querySelector('.logForm input[name=feedCost]').value = '500'");
    await ev("document.querySelector('.logForm input[name=deaths]').value = '50'");
    await ev("document.querySelector('.logForm').requestSubmit()");
    await waitFor(async () => (await ev("document.getElementById('stAlive').textContent")) === '950', 5000, 'alive=950');
    check('log flow updates dashboard alive', true);

    // Add sale via the batch card form
    await ev("document.querySelector('.saleForm input[name=date]').value = '2026-02-01'");
    await ev("document.querySelector('.saleForm input[name=kg]').value = '100'");
    await ev("document.querySelector('.saleForm input[name=price]').value = '200'");
    await ev("document.querySelector('.saleForm').requestSubmit()");
    await waitFor(async () => (await ev("document.getElementById('stRevenue').textContent")) === '20,000.00', 5000, 'revenue');
    check('sale flow updates dashboard revenue', true);

    const alive = await ev("document.getElementById('stAlive').textContent");
    const survival = await ev("document.getElementById('stSurvival').textContent");
    const feedKg = await ev("document.getElementById('stFeedKg').textContent");
    const feedCost = await ev("document.getElementById('stFeedCost').textContent");
    const revenue = await ev("document.getElementById('stRevenue').textContent");
    const profit = await ev("document.getElementById('stProfit').textContent");
    check('dashboard alive = 950', alive === '950', alive);
    check('dashboard survival = 95.0%', survival === '95.0%', survival);
    check('dashboard feed = 10 kg', feedKg === '10', feedKg);
    check('dashboard feed cost = 500.00', feedCost === '500.00', feedCost);
    check('dashboard revenue = 20,000.00', revenue === '20,000.00', revenue);
    check('dashboard profit = 14,500.00', profit === '14,500.00', profit);

    // Future-date rejection: log with a future date must show inline error, not change alive
    await ev("document.querySelector('.logForm input[name=date]').value = '2999-01-01'");
    await ev("document.querySelector('.logForm input[name=feedKg]').value = '1'");
    await ev("document.querySelector('.logForm input[name=feedCost]').value = '10'");
    await ev("document.querySelector('.logForm input[name=deaths]').value = '0'");
    await ev("document.querySelector('.logForm').requestSubmit()");
    await new Promise(r => setTimeout(r, 500));
    const logErr = await ev("document.querySelector('.logForm .err').textContent");
    const aliveAfter = await ev("document.getElementById('stAlive').textContent");
    check('future-date log rejected inline', logErr.length > 0 && aliveAfter === '950', 'err=' + logErr + ' alive=' + aliveAfter);

    // BN toggle renders Bengali digits
    await ev("document.getElementById('langBtn').click()");
    await waitFor(async () => (await ev('document.documentElement.lang')) === 'bn', 5000, 'bn lang');
    const bnAlive = await ev("document.getElementById('stAlive').textContent");
    const hasBnDigit = /[\u09e6-\u09ef]/.test(bnAlive);
    check('BN toggle renders Bengali digits (alive 950 -> ' + bnAlive + ')', hasBnDigit, bnAlive);

    // 390px no horizontal overflow
    const scrollW = await ev('document.documentElement.scrollWidth');
    check('390px viewport: no horizontal overflow', scrollW <= 390, 'scrollWidth=' + scrollW);

    await new Promise(r => setTimeout(r, 300));
    check('0 console errors', consoleErrors.length === 0, consoleErrors.join('; '));
    check('0 page exceptions', pageErrors.length === 0, pageErrors.join('; '));

    ws.close();
  } finally {
    chrome.kill();
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.log('SMOKE ERROR: ' + e.message); process.exit(1); });
