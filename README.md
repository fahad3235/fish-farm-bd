fish-farm-bd
# Fish Farm BD — Offline Pond Tracker

A fully offline, bilingual (English / বাংলা) fish-farm tracker for small
pond farmers in Bangladesh. No account, no internet, no server: all data
lives in the browser's localStorage. The app ships empty — no demo ponds,
no fabricated prices.

## Problem

Small pond farmers track stocking, daily feeding, deaths, and sales in
paper notebooks, which are easy to lose and hard to total up. Fish Farm BD
replaces the notebook with a simple phone-friendly ledger that answers the
questions that matter: how many fish are alive, what is the survival rate,
how much feed has been spent, and what is the estimated profit so far.

## Features

1. **Pond batches (CRUD)** — pond name, species (Rui, Katla, Mrigel,
   Tilapia, Pangas, Koi, Shing, Magur), pond size in decimals, fingerlings
   stocked, fingerling cost in BDT, stocking date. Batches can be closed
   and reopened, or deleted (with all their logs and sales).
2. **Daily logs per batch** — date, feed in kg, feed cost in BDT, deaths,
   optional note. Inline validation rejects future dates, deaths above the
   number of fish alive, and negative values.
3. **Harvest / sales per batch** — date, kg sold, price per kg in BDT.
   Revenue is kg x price. Future dates and non-positive kg/price are
   rejected inline.
4. **Dashboard** — active ponds, total fish alive (stocked minus deaths),
   overall survival %, total feed kg, total feed cost, total revenue, and
   estimated profit (revenue minus feed cost minus fingerling cost). Each
   active batch also shows alive count, survival %, stocking density
   (fish per decimal), and feed cost per fish alive.
5. **Data tab** — JSON export (download), strict import validation
   (malformed data is rejected and existing data stays intact), and
   typed-DELETE erase-all.
6. **Bilingual UI** — English / বাংলা toggle persisted in localStorage.
   When বাংলা is active, numbers render in Bengali digits (০-৯).
   Layout is verified at 390 px width with no horizontal overflow.

## Money handling

All money is stored and computed as **integer paisa** (1 BDT = 100 paisa)
inside `js/logic.js`, so totals never suffer binary floating-point error.
Display always shows exactly 2 decimals.

## Stack

Pure static site: HTML + CSS + vanilla JavaScript. Zero network requests,
no CDN, no frameworks, no build step. Open `index.html` in any modern
browser.

## Install / run locally

```sh
# No install step. Serve the folder (or just open index.html):
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Testing

```sh
node tests/logic.test.js   # pure-logic unit tests
node tests/smoke.js        # headless-Chrome (CDP) UI smoke test
```

See `tests/TEST_RESULTS.md` for the exact recorded results, including the
hand-computed scenarios used to verify dashboard math.

## Source layout

- `index.html` — app shell (all UI text is filled from `js/i18n.js`)
- `css/style.css` — responsive styles, 390 px mobile verified
- `js/logic.js` — pure, node-importable logic (money, validation, stats)
- `js/i18n.js` — English / Bengali strings (Bengali stored as `\u` escapes
  so shipped JS stays pure ASCII)
- `js/app.js` — UI layer: rendering, forms, localStorage, import/export
- `tests/` — unit tests, smoke test, results

## Limitations

- Data lives in one browser's localStorage: clearing browser data erases
  it. Use the Data tab's JSON export for backup.
- Profit is an estimate: it counts fingerling cost, feed cost, and sales
  revenue only. It does not include labour, pond rent, medicine, or other
  costs, and unsold live fish are not valued.
- No multi-device sync, no accounts, no cloud backup by design.

## Status

Complete MVP, built and tested 2026-11-04. Unit tests 13/13 pass;
headless-Chrome smoke test 16/16 checks pass (see `tests/TEST_RESULTS.md`).
