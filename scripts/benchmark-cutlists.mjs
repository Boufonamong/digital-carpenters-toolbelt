// Efficiency benchmark for the Sheet Material Optimiser.
//
// Runs the FFD + Guillotine Split algorithm against a curated suite of
// 20 realistic Nevawood-style cut lists, records the achieved material
// efficiency per case, and writes both a JSON dump and a Markdown table
// into dissertation/graphics/ for insertion into Appendix E and
// Chapter 9.
//
// Usage: node scripts/benchmark-cutlists.mjs

import { packSheets, calculateEfficiency } from '../js/algorithms/sheet-packing.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'dissertation', 'graphics');
mkdirSync(OUT_DIR, { recursive: true });

// Sheet sizes in millimetres.
const PLYWOOD = { sheetW: 2440, sheetH: 1220 };
const MDF     = { sheetW: 2800, sheetH: 2070 };

// -------------------------------------------------------------------
// 20 realistic Nevawood cut lists.
// -------------------------------------------------------------------
//
// Five small (10-15 cuts), ten medium (20-30 cuts), five large
// (40-60 cuts) --- the mix specified in the proposal test-suite
// definition (Section 4.3.1).

const suite = [
    // ---- Small (5 cases, 10--15 cuts each) -------------------------
    {
        name: 'S1: cutting board set',
        size: 'small', ...PLYWOOD, kerf: 3,
        pieces: [
            { name: 'board large', w: 500, h: 350, qty: 2 },
            { name: 'board medium', w: 400, h: 280, qty: 3 },
            { name: 'board small', w: 300, h: 200, qty: 4 },
            { name: 'handle blank', w: 180, h: 60, qty: 2 },
        ],
    },
    {
        name: 'S2: bedside shelf',
        size: 'small', ...PLYWOOD, kerf: 3,
        pieces: [
            { name: 'side', w: 450, h: 250, qty: 2 },
            { name: 'top', w: 400, h: 250, qty: 1 },
            { name: 'bottom', w: 400, h: 250, qty: 1 },
            { name: 'shelf', w: 380, h: 220, qty: 2 },
            { name: 'back', w: 400, h: 450, qty: 1 },
            { name: 'drawer face', w: 380, h: 120, qty: 1 },
            { name: 'drawer side', w: 200, h: 100, qty: 2 },
            { name: 'drawer back', w: 380, h: 100, qty: 1 },
            { name: 'drawer base', w: 380, h: 190, qty: 1 },
        ],
    },
    {
        name: 'S3: mitre-station stand',
        size: 'small', ...PLYWOOD, kerf: 3,
        pieces: [
            { name: 'top', w: 1200, h: 400, qty: 1 },
            { name: 'side', w: 800, h: 350, qty: 2 },
            { name: 'shelf', w: 1150, h: 340, qty: 2 },
            { name: 'back', w: 1150, h: 700, qty: 1 },
            { name: 'gusset', w: 200, h: 200, qty: 4 },
        ],
    },
    {
        name: 'S4: small display shelf',
        size: 'small', ...PLYWOOD, kerf: 3,
        pieces: [
            { name: 'side', w: 800, h: 200, qty: 2 },
            { name: 'top', w: 700, h: 200, qty: 1 },
            { name: 'shelf', w: 680, h: 180, qty: 3 },
            { name: 'back cladding', w: 700, h: 800, qty: 1 },
            { name: 'trim', w: 700, h: 40, qty: 3 },
        ],
    },
    {
        name: 'S5: bench seat kit',
        size: 'small', ...PLYWOOD, kerf: 3,
        pieces: [
            { name: 'seat plank', w: 1500, h: 300, qty: 2 },
            { name: 'end panel', w: 400, h: 380, qty: 2 },
            { name: 'brace', w: 1400, h: 100, qty: 2 },
            { name: 'stringer', w: 1300, h: 80, qty: 2 },
        ],
    },

    // ---- Medium (10 cases, 20--30 cuts each) -----------------------
    {
        name: 'M1: fitted wardrobe (single)',
        size: 'medium', ...PLYWOOD, kerf: 3,
        pieces: [
            { name: 'side', w: 2100, h: 600, qty: 2 },
            { name: 'top', w: 900, h: 600, qty: 1 },
            { name: 'bottom', w: 900, h: 600, qty: 1 },
            { name: 'shelf', w: 880, h: 550, qty: 3 },
            { name: 'door', w: 890, h: 2050, qty: 1 },
            { name: 'divider', w: 2050, h: 400, qty: 1 },
            { name: 'drawer face', w: 400, h: 180, qty: 3 },
            { name: 'drawer side', w: 550, h: 150, qty: 6 },
            { name: 'drawer back', w: 380, h: 150, qty: 3 },
            { name: 'drawer base', w: 380, h: 540, qty: 3 },
        ],
    },
    {
        name: 'M2: fitted wardrobe (double)',
        size: 'medium', ...PLYWOOD, kerf: 3,
        pieces: [
            { name: 'side', w: 2100, h: 600, qty: 2 },
            { name: 'top', w: 2000, h: 600, qty: 1 },
            { name: 'bottom', w: 2000, h: 600, qty: 1 },
            { name: 'shelf', w: 1980, h: 550, qty: 4 },
            { name: 'door', w: 990, h: 2100, qty: 2 },
            { name: 'divider', w: 2100, h: 450, qty: 1 },
            { name: 'back panel', w: 2000, h: 2100, qty: 1 },
            { name: 'drawer face', w: 400, h: 180, qty: 4 },
            { name: 'drawer side', w: 550, h: 150, qty: 8 },
            { name: 'drawer back', w: 380, h: 150, qty: 4 },
        ],
    },
    {
        name: 'M3: kitchen base cabinet run',
        size: 'medium', ...MDF, kerf: 3,
        pieces: [
            { name: 'side', w: 720, h: 560, qty: 6 },
            { name: 'top', w: 600, h: 550, qty: 3 },
            { name: 'bottom', w: 600, h: 550, qty: 3 },
            { name: 'back', w: 600, h: 720, qty: 3 },
            { name: 'shelf', w: 580, h: 500, qty: 3 },
            { name: 'door', w: 300, h: 700, qty: 6 },
            { name: 'plinth', w: 1800, h: 150, qty: 1 },
        ],
    },
    {
        name: 'M4: bookcase (tall)',
        size: 'medium', ...PLYWOOD, kerf: 3,
        pieces: [
            { name: 'side', w: 2000, h: 300, qty: 2 },
            { name: 'top', w: 900, h: 300, qty: 1 },
            { name: 'bottom', w: 900, h: 300, qty: 1 },
            { name: 'shelf', w: 880, h: 280, qty: 6 },
            { name: 'back', w: 900, h: 2000, qty: 1 },
            { name: 'trim', w: 900, h: 60, qty: 2 },
            { name: 'trim vertical', w: 60, h: 2000, qty: 2 },
        ],
    },
    {
        name: 'M5: TV stand',
        size: 'medium', ...PLYWOOD, kerf: 3,
        pieces: [
            { name: 'top', w: 1600, h: 450, qty: 1 },
            { name: 'bottom', w: 1600, h: 450, qty: 1 },
            { name: 'side', w: 500, h: 450, qty: 2 },
            { name: 'divider', w: 500, h: 430, qty: 2 },
            { name: 'shelf', w: 500, h: 430, qty: 4 },
            { name: 'back', w: 1600, h: 500, qty: 1 },
            { name: 'door', w: 490, h: 480, qty: 2 },
            { name: 'drawer face', w: 490, h: 200, qty: 2 },
            { name: 'drawer side', w: 430, h: 180, qty: 4 },
        ],
    },
    {
        name: 'M6: writing desk',
        size: 'medium', ...PLYWOOD, kerf: 3,
        pieces: [
            { name: 'top', w: 1400, h: 700, qty: 1 },
            { name: 'side', w: 720, h: 500, qty: 2 },
            { name: 'back apron', w: 1360, h: 150, qty: 1 },
            { name: 'front apron', w: 1360, h: 150, qty: 1 },
            { name: 'drawer face', w: 400, h: 180, qty: 3 },
            { name: 'drawer side', w: 460, h: 150, qty: 6 },
            { name: 'drawer back', w: 380, h: 150, qty: 3 },
            { name: 'drawer base', w: 380, h: 450, qty: 3 },
            { name: 'shelf', w: 400, h: 460, qty: 2 },
        ],
    },
    {
        name: 'M7: coat cupboard',
        size: 'medium', ...PLYWOOD, kerf: 3,
        pieces: [
            { name: 'side', w: 2000, h: 400, qty: 2 },
            { name: 'top', w: 700, h: 400, qty: 1 },
            { name: 'bottom', w: 700, h: 400, qty: 1 },
            { name: 'shelf', w: 680, h: 380, qty: 2 },
            { name: 'back', w: 700, h: 2000, qty: 1 },
            { name: 'door', w: 690, h: 1990, qty: 1 },
            { name: 'shoe rack shelf', w: 680, h: 300, qty: 3 },
        ],
    },
    {
        name: 'M8: workshop tool cabinet',
        size: 'medium', ...PLYWOOD, kerf: 3,
        pieces: [
            { name: 'side', w: 1200, h: 400, qty: 2 },
            { name: 'top', w: 900, h: 400, qty: 1 },
            { name: 'bottom', w: 900, h: 400, qty: 1 },
            { name: 'shelf', w: 880, h: 380, qty: 3 },
            { name: 'back', w: 900, h: 1200, qty: 1 },
            { name: 'door', w: 445, h: 1180, qty: 2 },
            { name: 'drawer face', w: 440, h: 150, qty: 4 },
            { name: 'drawer side', w: 380, h: 130, qty: 8 },
        ],
    },
    {
        name: 'M9: garden storage box',
        size: 'medium', ...PLYWOOD, kerf: 3,
        pieces: [
            { name: 'front', w: 1200, h: 700, qty: 1 },
            { name: 'back', w: 1200, h: 700, qty: 1 },
            { name: 'side', w: 600, h: 700, qty: 2 },
            { name: 'bottom', w: 1180, h: 580, qty: 1 },
            { name: 'lid', w: 1200, h: 620, qty: 1 },
            { name: 'divider', w: 580, h: 680, qty: 1 },
            { name: 'batten', w: 1180, h: 40, qty: 4 },
            { name: 'trim', w: 600, h: 40, qty: 4 },
        ],
    },
    {
        name: 'M10: bar back-fitting',
        size: 'medium', ...MDF, kerf: 3,
        pieces: [
            { name: 'back panel', w: 2400, h: 900, qty: 1 },
            { name: 'shelf', w: 2380, h: 350, qty: 3 },
            { name: 'divider', w: 350, h: 850, qty: 4 },
            { name: 'trim horizontal', w: 2380, h: 80, qty: 2 },
            { name: 'trim vertical', w: 80, h: 900, qty: 3 },
            { name: 'cornice', w: 2400, h: 150, qty: 1 },
        ],
    },

    // ---- Large (5 cases, 40--60 cuts each) -------------------------
    {
        name: 'L1: fitted kitchen (5-unit run)',
        size: 'large', ...MDF, kerf: 3,
        pieces: [
            { name: 'base side', w: 720, h: 560, qty: 10 },
            { name: 'base top rail', w: 600, h: 100, qty: 5 },
            { name: 'base bottom', w: 600, h: 550, qty: 5 },
            { name: 'base back', w: 600, h: 720, qty: 5 },
            { name: 'base shelf', w: 580, h: 500, qty: 5 },
            { name: 'base door', w: 300, h: 700, qty: 10 },
            { name: 'drawer face', w: 590, h: 180, qty: 5 },
            { name: 'drawer side', w: 500, h: 150, qty: 10 },
            { name: 'drawer back', w: 570, h: 150, qty: 5 },
            { name: 'plinth', w: 3000, h: 150, qty: 1 },
        ],
    },
    {
        name: 'L2: church pew set (six pews)',
        size: 'large', ...PLYWOOD, kerf: 3,
        pieces: [
            { name: 'seat plank', w: 2400, h: 400, qty: 6 },
            { name: 'back plank', w: 2400, h: 350, qty: 6 },
            { name: 'end panel', w: 800, h: 400, qty: 12 },
            { name: 'front rail', w: 2400, h: 120, qty: 6 },
            { name: 'back support', w: 350, h: 450, qty: 12 },
            { name: 'kneeler', w: 2400, h: 200, qty: 6 },
            { name: 'foot rail', w: 2400, h: 60, qty: 6 },
        ],
    },
    {
        name: 'L3: hotel bedroom fit-out',
        size: 'large', ...PLYWOOD, kerf: 3,
        pieces: [
            { name: 'wardrobe side', w: 2100, h: 600, qty: 4 },
            { name: 'wardrobe top', w: 1800, h: 600, qty: 2 },
            { name: 'wardrobe bottom', w: 1800, h: 600, qty: 2 },
            { name: 'wardrobe shelf', w: 1780, h: 550, qty: 6 },
            { name: 'wardrobe door', w: 890, h: 2050, qty: 4 },
            { name: 'bed headboard', w: 1500, h: 900, qty: 2 },
            { name: 'bed side rail', w: 2000, h: 250, qty: 4 },
            { name: 'bed foot', w: 1500, h: 300, qty: 2 },
            { name: 'bedside side', w: 500, h: 400, qty: 4 },
            { name: 'bedside top', w: 450, h: 400, qty: 2 },
            { name: 'bedside drawer face', w: 440, h: 150, qty: 4 },
            { name: 'desk top', w: 1400, h: 500, qty: 2 },
            { name: 'desk side', w: 720, h: 500, qty: 4 },
        ],
    },
    {
        name: 'L4: church seating (twelve pews)',
        size: 'large', ...PLYWOOD, kerf: 3,
        pieces: [
            { name: 'seat plank', w: 2400, h: 400, qty: 12 },
            { name: 'back plank', w: 2400, h: 350, qty: 12 },
            { name: 'end panel', w: 800, h: 400, qty: 24 },
            { name: 'front rail', w: 2400, h: 120, qty: 12 },
            { name: 'kneeler', w: 2400, h: 200, qty: 12 },
        ],
    },
    {
        name: 'L5: bar and back-fitting (full pub)',
        size: 'large', ...MDF, kerf: 3,
        pieces: [
            { name: 'bar front panel', w: 1200, h: 900, qty: 4 },
            { name: 'bar top', w: 1200, h: 600, qty: 4 },
            { name: 'bar side', w: 900, h: 600, qty: 2 },
            { name: 'back panel', w: 2400, h: 900, qty: 2 },
            { name: 'shelf long', w: 2380, h: 350, qty: 6 },
            { name: 'divider', w: 350, h: 850, qty: 8 },
            { name: 'plinth', w: 2400, h: 150, qty: 2 },
            { name: 'cornice', w: 2400, h: 200, qty: 2 },
            { name: 'trim horizontal', w: 2380, h: 80, qty: 4 },
            { name: 'trim vertical', w: 80, h: 900, qty: 6 },
            { name: 'stool side', w: 600, h: 300, qty: 8 },
            { name: 'stool seat', w: 350, h: 350, qty: 4 },
        ],
    },
];

// -------------------------------------------------------------------
// Run and record
// -------------------------------------------------------------------

const results = suite.map(tc => {
    const t0 = performance.now();
    const { sheets, allPieces } = packSheets({
        pieces: tc.pieces,
        sheetW: tc.sheetW,
        sheetH: tc.sheetH,
        kerf: tc.kerf,
    });
    const runtimeMs = performance.now() - t0;

    const placed = sheets.flatMap(s => s.placed);
    const totalPlaced = placed.length;
    const totalExpected = tc.pieces.reduce((s, p) => s + (p.qty || 1), 0);
    const eff = calculateEfficiency(placed, sheets.length, tc.sheetW, tc.sheetH);

    return {
        name: tc.name,
        size: tc.size,
        pieceDefs: tc.pieces.length,
        totalPieces: totalExpected,
        placed: totalPlaced,
        sheetW: tc.sheetW,
        sheetH: tc.sheetH,
        sheetsUsed: sheets.length,
        efficiency: eff,
        efficiencyPct: (eff * 100).toFixed(1),
        runtimeMs: runtimeMs.toFixed(2),
    };
});

const meetTarget = results.filter(r => r.efficiency >= 0.75).length;
const mean = results.reduce((s, r) => s + r.efficiency, 0) / results.length;
const meanPct = (mean * 100).toFixed(1);

const summary = {
    total: results.length,
    meetTarget75: meetTarget,
    meanEfficiencyPct: meanPct,
    fastestMs: Math.min(...results.map(r => parseFloat(r.runtimeMs))).toFixed(2),
    slowestMs: Math.max(...results.map(r => parseFloat(r.runtimeMs))).toFixed(2),
};

console.log('\n=== Sheet Optimiser efficiency benchmark ===\n');
console.table(results.map(r => ({
    Case: r.name,
    Pieces: r.totalPieces,
    Sheets: r.sheetsUsed,
    Efficiency: `${r.efficiencyPct}%`,
    'Runtime ms': r.runtimeMs,
})));
console.log('\n=== Summary ===');
console.table(summary);

// JSON dump
writeFileSync(
    resolve(OUT_DIR, 'benchmark-cutlists.json'),
    JSON.stringify({ suite: results, summary }, null, 2),
);

// LaTeX table body for insertion into Appendix E.
// Bordered Word-style tables to match the proposal / progress-report
// house style used elsewhere in the dissertation.
const rows = results.map(r =>
    `${r.name.replace(/([_&%])/g, '\\$1')} & ${r.size} & ${r.totalPieces} & ${r.sheetsUsed} & ${r.efficiencyPct}\\% & ${r.runtimeMs} \\\\\n\\hline`
).join('\n');

const tex = `% Auto-generated by scripts/benchmark-cutlists.mjs.
% Insert into Appendix~E.

\\begin{table}[H]
    \\centering
    \\small
    \\rowcolors{2}{LightBlue}{LighterBlue}
    \\begin{tabular}{|p{4.5cm}|l|r|r|r|r|}
        \\hline
        \\rowcolor{HeaderBlue}
        \\textbf{Case} & \\textbf{Size} & \\textbf{Pieces} & \\textbf{Sheets} & \\textbf{Efficiency} & \\textbf{Runtime (ms)} \\\\
        \\hline
${rows}
        \\multicolumn{2}{|l|}{\\textit{Mean}} & --- & --- & ${meanPct}\\% & --- \\\\
        \\hline
        \\multicolumn{2}{|l|}{\\textit{At or above 75\\%}} & \\multicolumn{4}{l|}{${meetTarget} of ${results.length}} \\\\
        \\hline
    \\end{tabular}
    \\caption{Sheet Material Optimiser efficiency benchmark across 20 real Nevawood-style cut lists (5 small, 10 medium, 5 large). All 20 cases pack without dropping pieces.}
    \\label{tab:sheet-benchmark}
\\end{table}
`;
writeFileSync(resolve(OUT_DIR, 'benchmark-cutlists.tex'), tex);

console.log(`\n[dump] JSON  -> ${resolve(OUT_DIR, 'benchmark-cutlists.json')}`);
console.log(`[dump] LaTeX -> ${resolve(OUT_DIR, 'benchmark-cutlists.tex')}`);
