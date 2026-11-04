# Test results — fish-farm-bd (2026-11-04)

## Node unit tests — 13/13 PASS

Run: `node tests/logic.test.js`

| # | Case | Hand-verified expectation |
|---|------|---------------------------|
| 1 | toPaisa/fromPaisa round trip | toPaisa('12.34')=1234; fromPaisa(123456)='1,234.56'; fromPaisa(-500)='-5.00'; invalid/negative -> null |
| 2 | Profit math | Batch 1000 stocked, 10 decimals, 5000 BDT fingerlings; logs 10 kg/500 BDT/50 deaths + 20 kg/900 BDT/30 deaths; sales 100 kg @ 200 + 50 kg @ 180 -> revenue 29000 BDT, feed 1400 BDT, profit 22600 BDT = 2260000 paisa |
| 3 | Survival extremes | 0 deaths -> 100%; all 1000 dead -> alive 0, 0% |
| 4 | Stocking density | 920 alive / 10 decimals = 92.0 fish/decimal |
| 5 | Feed cost per fish | 140000 paisa / 920 = 152.17 -> 152 paisa |
| 6 | Deaths-exceed-alive rejection | 921 deaths with 920 alive rejected; 920 accepted |
| 7 | Future-date rejection | 2999-01-01 rejected for batch, log, and sale |
| 8 | Sales revenue math | 100 kg @ 200 = 2000000 paisa; 2.5 kg @ 133.33 = 33333 paisa |
| 9 | Negative/zero validation | Negative feed, zero kg, zero price, zero stocked, unknown species all rejected |
| 10 | Dashboard totals | active 1, alive 920, survival 92%, feed 30 kg, feed cost 140000 paisa, revenue 2900000 paisa, profit 2260000 paisa |
| 11 | Dashboard excludes closed batches | Closed batch not counted |
| 12 | Export/import round-trip | JSON round-trip validates clean |
| 13 | Malformed import rejected | null, {}, wrong app id, log with unknown batchId all rejected |

## Headless-Chrome smoke test — 16/16 PASS

Run: `node tests/smoke.js` (CDP via Node WebSocket, Playwright
`chromium_headless_shell-1187`, 390 px viewport, `file://` page).

Hand-computed scenario: batch Rui, 10 decimals, 1000 stocked, 5000 BDT
fingerlings, stocked 2026-01-10. Log 2026-01-11: 10 kg feed, 500 BDT,
50 deaths. Sale 2026-02-01: 100 kg @ 200 BDT.

Verified in the live page: title renders; batch form creates a card;
log flow moves dashboard alive to 950; sale flow moves revenue to
20,000.00; dashboard alive 950, survival 95.0%, feed 10 kg, feed cost
500.00, revenue 20,000.00, profit 14,500.00 (= 20000 - 500 - 5000);
future-date log rejected inline with alive unchanged at 950; BN toggle
renders Bengali digits (alive shows ৯৫০); 390 px viewport has no
horizontal overflow (scrollWidth <= 390); 0 console errors; 0 page
exceptions.

## Repairs made

1. Smoke harness: `/opt/meta-chromium/chrome` refuses to start in this VM
   ("Hatch WebGL domain policy is required for browser startup", exit 13).
   Switched the smoke test to the Playwright `headless_shell` binary
   (`~/.cache/ms-playwright/chromium_headless_shell-1187/.../headless_shell`).
2. Smoke harness bug: the `waitFor` helper returned `true` instead of the
   fetched value, so the `/json` target list was lost. Fixed to return the
   predicate's value. No app code changed in either repair.

## ASCII / no-network verification (2026-11-04)

- `grep -rP '[^\x00-\x7F]'` over `index.html`, `css/`, `js/`:
  **0 matches** (Bengali ships only as `\uXXXX` escapes in JS).
- No `fetch(`, no `http://`/`https://` resource references, no CDN links
  in shipped HTML/CSS/JS (verified by grep; the only URL-like text is the
  `file://` smoke-test page path inside `tests/`, not shipped code).
