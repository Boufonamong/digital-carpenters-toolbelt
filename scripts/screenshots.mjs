// Automated screenshot capture for the dissertation.
//
// Serves the project root on http://127.0.0.1:8123 via http-server,
// launches headless Chromium, navigates through each tool, populates
// realistic sample data, and dumps PNG screenshots into
// dissertation/graphics/screenshots/.
//
// Usage:
//   node scripts/screenshots.mjs
//
// Playwright is used in library mode (not the Playwright Test runner)
// so this script has no side-effects beyond the PNG outputs.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'dissertation', 'graphics', 'screenshots');
const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}`;

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

// ---- static file server -----------------------------------------------

console.log('[server] starting http-server on port', PORT);
const server = spawn(
    'npx',
    ['http-server', ROOT, '-p', String(PORT), '-c-1', '--silent'],
    { stdio: ['ignore', 'ignore', 'inherit'], shell: true },
);

// Poll until http-server accepts a connection.
async function waitForServer(url, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(url);
            if (res.ok) return;
        } catch {
            // not ready yet
        }
        await new Promise(r => setTimeout(r, 300));
    }
    throw new Error(`Server not ready after ${timeoutMs}ms: ${url}`);
}

await waitForServer(`${BASE}/index.html`);
console.log('[server] ready');

// ---- browser ----------------------------------------------------------

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
const page = await context.newPage();

async function shot(name) {
    const file = resolve(OUT, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log('[shot]', name);
}

async function waitForReady() {
    // Wait for network idle then a small render buffer.
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
}

// ---- 0. Dashboard -----------------------------------------------------

console.log('\n== dashboard ==');
await page.goto(`${BASE}/index.html`);
await waitForReady();
await shot('00-dashboard');

// ---- 1. Sheet Optimiser: empty then populated -------------------------

console.log('\n== sheet optimiser ==');
await page.goto(`${BASE}/sheet-optimiser.html`);
await waitForReady();
await shot('10-sheet-optimiser-empty');

// Realistic Nevawood-style fitted wardrobe cut list, added via UI.
async function addPiece(name, w, h, qty) {
    await page.fill('#pieceName', name);
    await page.fill('#pieceW', String(w));
    await page.fill('#pieceH', String(h));
    await page.fill('#pieceQty', String(qty));
    await page.click('button:has-text("Add Piece")');
}

await addPiece('Side panel', 2100, 600, 2);
await addPiece('Top panel', 2000, 600, 1);
await addPiece('Bottom panel', 2000, 600, 1);
await addPiece('Shelf', 1980, 550, 4);
await addPiece('Door', 990, 2100, 2);
await addPiece('Divider', 2100, 450, 1);

await page.click('button:has-text("Calculate Cutting Layout")');
await page.waitForTimeout(400);
await shot('11-sheet-optimiser-populated');

// ---- 2. Space Planner: bench mode + venue mode ------------------------

console.log('\n== space planner ==');
await page.goto(`${BASE}/seating-optimiser.html`);
await waitForReady();
await shot('20-space-planner-empty');

// Bench-catalogue mode --- add two 2m picnic benches.
async function clickVisible(text) {
    await page.locator('button:visible', { hasText: text }).click();
}

await page.selectOption('#productType', 'picnic');
await page.selectOption('#productSize', '2000');
await clickVisible('Add to Layout');
await clickVisible('Add to Layout');
await page.fill('#roomW', '10');
await page.fill('#roomD', '8');
await clickVisible('Generate Layout');
await page.waitForTimeout(500);
await shot('21-space-planner-bench-mode');

// Venue mode --- church layout.
await page.selectOption('#layoutMode', 'venue');
await page.selectOption('#venueStyle', 'church');
await page.fill('#roomW', '15');
await page.fill('#roomD', '25');
await clickVisible('Generate Layout');
await page.waitForTimeout(500);
await shot('22-space-planner-venue-church');

// Theatre layout for variety.
await page.selectOption('#venueStyle', 'theatre');
await clickVisible('Generate Layout');
await page.waitForTimeout(500);
await shot('23-space-planner-venue-theatre');

// ---- 3. Workshop Optimiser (descoped, but still functional) ----------

console.log('\n== workshop optimiser ==');
await page.goto(`${BASE}/workshop-optimiser.html`);
await waitForReady();
await shot('30-workshop-empty');

// Add a few machines via presets.
async function addMachine(preset) {
    await page.selectOption('#machinePreset', preset);
    await page.click('button:has-text("Add Machine")');
}
await addMachine('tablesaw');
await addMachine('mitre');
await addMachine('bench');
await addMachine('assembly');
await addMachine('finishing');
await page.fill('#shopW', '10');
await page.fill('#shopD', '8');
await page.selectOption('#workflow', 'cellular');
await page.click('button:has-text("Generate Layout")');
await page.waitForTimeout(500);
await shot('31-workshop-cellular');

// ---- 4. 3D Visualiser + parts panel -----------------------------------

console.log('\n== 3D visualiser ==');
await page.goto(`${BASE}/3d-visualiser.html`);
// WebGL takes longer to spin up.
await page.waitForTimeout(2000);
await shot('40-3d-picnic-oak');

// Try the round bench.
await page.selectOption('#productType', 'roundbench');
await page.selectOption('#productRadius', '2000');
await page.selectOption('#woodColour', 'walnut');
await page.click('button:has-text("Generate 3D Model")');
await page.waitForTimeout(1500);
await shot('41-3d-round-walnut');

// Trigger the hand-off to sheet optimiser --- captures the receiver banner.
await page.selectOption('#productType', 'picnic');
await page.selectOption('#productSize', '3000');
await page.selectOption('#woodColour', 'oak');
await page.click('button:has-text("Generate 3D Model")');
await page.waitForTimeout(1500);
await page.click('button:has-text("Send sheet parts to Sheet Optimiser")');
await page.waitForURL('**/sheet-optimiser.html*');
await waitForReady();
await page.waitForTimeout(400);
await shot('42-sheet-handoff-banner');

// ---- teardown --------------------------------------------------------

console.log('\n[done] all screenshots captured to', OUT);
await browser.close();
server.kill();
process.exit(0);
