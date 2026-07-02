// Sheet Material Optimiser --- UI wrapper.
// Algorithm implementation lives in js/algorithms/sheet-packing.js.

import {
    packSheets,
    calculateEfficiency,
} from './algorithms/sheet-packing.js';

// Colour palette used to distinguish pieces on the cut diagram.
const COLOURS = [
    '#7ec8e3', '#f7b2b7', '#b5ead7', '#ffd6a5',
    '#c3b1e1', '#caffbf', '#fdffb6', '#a0c4ff',
    '#ffadad', '#d4a5a5', '#9bf6ff', '#bdb2ff',
];

const SHEET_PRESETS = {
    plywood: { w: 2440, h: 1220 },
    mdf:     { w: 2800, h: 2070 },
    veneer:  { w: 2440, h: 1220 },
};

// localStorage key used to receive a cut list from the 3D visualiser.
const HANDOFF_KEY = 'dc-sheet-handoff';

// Mutable UI state kept in a single object so it's easy to reason about.
const state = {
    pieces: [],
    colourIndex: 0,
    sheets: [],
    currentSheet: 0,
    lastSheetW: 0,
    lastSheetH: 0,
};

// ---- Event handlers (exposed to window for inline HTML onclick) ----

function onMaterialChange() {
    const type = document.getElementById('materialType').value;
    const customRow = document.getElementById('customSizeRow');

    if (type === 'custom') {
        customRow.style.display = 'grid';
    } else {
        customRow.style.display = 'none';
        if (SHEET_PRESETS[type]) {
            document.getElementById('sheetW').value = SHEET_PRESETS[type].w;
            document.getElementById('sheetH').value = SHEET_PRESETS[type].h;
        }
    }
}

function addPiece() {
    const name = document.getElementById('pieceName').value.trim() || `Piece ${state.pieces.length + 1}`;
    const w = parseFloat(document.getElementById('pieceW').value);
    const h = parseFloat(document.getElementById('pieceH').value);
    const qty = parseInt(document.getElementById('pieceQty').value, 10) || 1;

    if (!w || !h || w <= 0 || h <= 0) {
        alert('Please enter valid dimensions for the piece.');
        return;
    }

    const colour = COLOURS[state.colourIndex % COLOURS.length];
    state.colourIndex++;

    state.pieces.push({ name, w, h, qty, colour });
    renderPieceList();
    clearInputs();
}

function clearInputs() {
    document.getElementById('pieceName').value = '';
    document.getElementById('pieceW').value = '';
    document.getElementById('pieceH').value = '';
    document.getElementById('pieceQty').value = '1';
}

function removePiece(index) {
    state.pieces.splice(index, 1);
    renderPieceList();
}

function renderPieceList() {
    const list = document.getElementById('pieceList');

    if (state.pieces.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No pieces added yet</p></div>';
        return;
    }

    const html = state.pieces.map((p, i) => `
        <div class="piece-item">
            <div class="piece-item-info">
                <div class="piece-color-dot" style="background:${p.colour}"></div>
                <span class="piece-item-name">${p.name}</span>
                <span class="piece-item-dims">${p.w}&times;${p.h} &times;${p.qty}</span>
            </div>
            <button class="btn-danger" onclick="removePiece(${i})">&#10005;</button>
        </div>
    `).join('');

    list.innerHTML = html;
}

function clearAll() {
    state.pieces = [];
    state.colourIndex = 0;
    state.sheets = [];
    renderPieceList();
    document.getElementById('results').style.display = 'none';
    document.getElementById('emptyResults').style.display = 'block';
}

// ---- Run the algorithm and display results ----

function runOptimiser() {
    if (state.pieces.length === 0) {
        alert('Add at least one piece first.');
        return;
    }

    const material = document.getElementById('materialType').value;
    const sheetW = parseFloat(document.getElementById('sheetW').value) || SHEET_PRESETS.plywood.w;
    const sheetH = parseFloat(document.getElementById('sheetH').value) || SHEET_PRESETS.plywood.h;
    const kerf = parseFloat(document.getElementById('kerf').value) || 3;
    const noRotate = material === 'veneer';

    const { sheets, allPieces } = packSheets({
        pieces: state.pieces,
        sheetW,
        sheetH,
        kerf,
        noRotate,
    });

    state.sheets = sheets;
    state.lastSheetW = sheetW;
    state.lastSheetH = sheetH;

    showResults(sheetW, sheetH, allPieces);
}

function showResults(sheetW, sheetH, allPieces) {
    const efficiency = calculateEfficiency(
        state.sheets.flatMap(s => s.placed),
        state.sheets.length,
        sheetW,
        sheetH,
    );
    const effPct = (efficiency * 100).toFixed(1);
    const wastePct = (100 - efficiency * 100).toFixed(1);

    document.getElementById('statSheets').textContent = state.sheets.length;
    document.getElementById('statEfficiency').textContent = `${effPct}%`;
    document.getElementById('statWaste').textContent = `${wastePct}%`;
    document.getElementById('statPieces').textContent = allPieces.length;

    const effBox = document.getElementById('effBox');
    effBox.className = 'stat-box';
    if (efficiency >= 0.75) effBox.classList.add('good');
    else if (efficiency >= 0.60) effBox.classList.add('warn');

    buildSheetTabs(sheetW, sheetH);

    document.getElementById('emptyResults').style.display = 'none';
    document.getElementById('results').style.display = 'block';

    state.currentSheet = 0;
    drawSheet(0, sheetW, sheetH);
}

function buildSheetTabs(sheetW, sheetH) {
    const tabs = document.getElementById('sheetTabs');
    tabs.innerHTML = '';

    state.sheets.forEach((_, i) => {
        const btn = document.createElement('button');
        btn.className = `sheet-tab${i === 0 ? ' active' : ''}`;
        btn.textContent = `Sheet ${i + 1}`;
        btn.addEventListener('click', () => {
            state.currentSheet = i;
            document.querySelectorAll('.sheet-tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            drawSheet(i, sheetW, sheetH);
        });
        tabs.appendChild(btn);
    });
}

function drawSheet(sheetIndex, sheetW, sheetH) {
    const canvas = document.getElementById('cutCanvas');
    const ctx = canvas.getContext('2d');

    const canvasW = 700;
    const scale = canvasW / sheetW;
    const canvasH = Math.round(sheetH * scale);

    canvas.width = canvasW;
    canvas.height = canvasH;

    ctx.fillStyle = '#f9f9f9';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvasW, canvasH);

    const sheet = state.sheets[sheetIndex];

    for (const piece of sheet.placed) {
        const px = piece.x * scale;
        const py = piece.y * scale;
        const pw = piece.w * scale;
        const ph = piece.h * scale;

        ctx.fillStyle = piece.colour;
        ctx.fillRect(px, py, pw, ph);

        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.strokeRect(px, py, pw, ph);

        if (pw > 30 && ph > 14) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.font = '11px sans-serif';
            ctx.fillText(piece.name, px + 4, py + 13);
            if (ph > 26) {
                ctx.fillStyle = 'rgba(0,0,0,0.45)';
                ctx.font = '10px sans-serif';
                ctx.fillText(`${piece.w}×${piece.h}`, px + 4, py + 25);
            }
        }
    }

    document.getElementById('canvasLabel').textContent =
        `Sheet ${sheetIndex + 1} of ${state.sheets.length}`;

    const placed = sheet.placed.length;
    const usedArea = sheet.placed.reduce((sum, p) => sum + p.w * p.h, 0);
    const sheetEff = ((usedArea / (sheetW * sheetH)) * 100).toFixed(1);

    document.getElementById('sheetInfo').textContent =
        `${placed} piece${placed !== 1 ? 's' : ''} on this sheet – ${sheetEff}% used`;
}

// ---- Export ----

function exportCutListCSV() {
    if (!state.sheets.length) return;

    const rows = ['Sheet,Piece,Width (mm),Height (mm),X (mm),Y (mm)'];
    state.sheets.forEach((sheet, si) => {
        for (const p of sheet.placed) {
            rows.push(`${si + 1},${p.name},${p.w},${p.h},${Math.round(p.x)},${Math.round(p.y)}`);
        }
    });

    const totalPieceArea = state.sheets
        .flatMap(s => s.placed)
        .reduce((sum, p) => sum + p.w * p.h, 0);
    const eff = ((totalPieceArea / (state.sheets.length * state.lastSheetW * state.lastSheetH)) * 100).toFixed(1);

    rows.push('');
    rows.push('Summary');
    rows.push('Total Sheets,Efficiency,Waste');
    rows.push(`${state.sheets.length},${eff}%,${(100 - eff).toFixed(1)}%`);

    downloadFile('cut-list.csv', rows.join('\n'), 'text/csv');
}

function saveSheetImage() {
    const canvas = document.getElementById('cutCanvas');
    downloadFile(`cut-sheet-${state.currentSheet + 1}.png`, canvas.toDataURL('image/png'), null, true);
}

function downloadFile(filename, data, mime, isUrl = false) {
    const a = document.createElement('a');
    if (isUrl) {
        a.href = data;
    } else {
        a.href = URL.createObjectURL(new Blob([data], { type: mime }));
    }
    a.download = filename;
    a.click();
}

// ---- Hand-off receiver: pick up a cut list from the 3D visualiser ----

function consumeHandoff() {
    const raw = localStorage.getItem(HANDOFF_KEY);
    if (!raw) return;

    let payload;
    try {
        payload = JSON.parse(raw);
    } catch {
        localStorage.removeItem(HANDOFF_KEY);
        return;
    }
    if (!payload || !Array.isArray(payload.pieces)) {
        localStorage.removeItem(HANDOFF_KEY);
        return;
    }

    // Assign fresh colours from the palette (drop whatever the 3D
    // visualiser chose --- our colour convention here is one-per-piece
    // to help the eye track the cut diagram).
    for (const p of payload.pieces) {
        p.colour = COLOURS[state.colourIndex % COLOURS.length];
        state.colourIndex++;
    }

    state.pieces = payload.pieces;
    renderPieceList();

    // Show a banner naming the source so the user knows where the pieces
    // came from.  Dismiss button clears it and the localStorage entry.
    const banner = document.getElementById('handoffBanner');
    if (banner) {
        banner.innerHTML = `
            <div>
                <strong>${payload.pieces.length} piece${payload.pieces.length === 1 ? '' : 's'}</strong>
                imported from <em>${payload.source || '3D Visualiser'}</em>. Press <em>Run Optimiser</em> to lay them out.
            </div>
            <button onclick="dismissHandoff()" title="Dismiss">&#10005;</button>
        `;
        banner.style.display = 'flex';
    }

    localStorage.removeItem(HANDOFF_KEY);
}

function dismissHandoff() {
    const banner = document.getElementById('handoffBanner');
    if (banner) banner.style.display = 'none';
}

// ---- Expose the handlers referenced by inline HTML onclick attributes ----

Object.assign(window, {
    onMaterialChange,
    addPiece,
    removePiece,
    clearAll,
    runOptimiser,
    exportCutListCSV,
    saveSheetImage,
    dismissHandoff,
});

// Kick off the hand-off consumer once the DOM is parsed (type="module"
// scripts are deferred, so DOM elements are already available).
consumeHandoff();
