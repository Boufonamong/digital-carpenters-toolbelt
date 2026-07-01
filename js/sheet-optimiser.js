// Sheet Material Optimiser
// FFD (First Fit Decreasing) + Guillotine Split algorithm
// Anton Morris – Nevawood Joinery

// colour palette for pieces on the diagram
var COLOURS = [
    '#7ec8e3', '#f7b2b7', '#b5ead7', '#ffd6a5',
    '#c3b1e1', '#caffbf', '#fdffb6', '#a0c4ff',
    '#ffadad', '#d4a5a5', '#9bf6ff', '#bdb2ff'
];

// pieces the user has added
var pieces = [];
var colourIndex = 0;

// the result from the last calculation
var sheets = [];
var currentSheet = 0;
var lastSheetW = 0, lastSheetH = 0;

// preset sheet sizes in mm
var SHEET_PRESETS = {
    plywood: { w: 2440, h: 1220 },
    mdf:     { w: 2800, h: 2070 },
    veneer:  { w: 2440, h: 1220 }
};

function onMaterialChange() {
    var type = document.getElementById('materialType').value;
    var customRow = document.getElementById('customSizeRow');

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
    var name = document.getElementById('pieceName').value.trim() || 'Piece ' + (pieces.length + 1);
    var w    = parseFloat(document.getElementById('pieceW').value);
    var h    = parseFloat(document.getElementById('pieceH').value);
    var qty  = parseInt(document.getElementById('pieceQty').value) || 1;

    if (!w || !h || w <= 0 || h <= 0) {
        alert('Please enter valid dimensions for the piece.');
        return;
    }

    var colour = COLOURS[colourIndex % COLOURS.length];
    colourIndex++;

    pieces.push({ name: name, w: w, h: h, qty: qty, colour: colour });
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
    pieces.splice(index, 1);
    renderPieceList();
}

function renderPieceList() {
    var list = document.getElementById('pieceList');

    if (pieces.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No pieces added yet</p></div>';
        return;
    }

    var html = '';
    pieces.forEach(function(p, i) {
        html += '<div class="piece-item">';
        html += '<div class="piece-item-info">';
        html += '<div class="piece-color-dot" style="background:' + p.colour + '"></div>';
        html += '<span class="piece-item-name">' + p.name + '</span>';
        html += '<span class="piece-item-dims">' + p.w + '&times;' + p.h + ' &times;' + p.qty + '</span>';
        html += '</div>';
        html += '<button class="btn-danger" onclick="removePiece(' + i + ')">&#10005;</button>';
        html += '</div>';
    });

    list.innerHTML = html;
}

function clearAll() {
    pieces = [];
    colourIndex = 0;
    sheets = [];
    renderPieceList();
    document.getElementById('results').style.display = 'none';
    document.getElementById('emptyResults').style.display = 'block';
}

// ---- The algorithm ----

function runOptimiser() {
    if (pieces.length === 0) {
        alert('Add at least one piece first.');
        return;
    }

    var material = document.getElementById('materialType').value;
    var sheetW   = parseFloat(document.getElementById('sheetW').value) || SHEET_PRESETS['plywood'].w;
    var sheetH   = parseFloat(document.getElementById('sheetH').value) || SHEET_PRESETS['plywood'].h;
    var kerf     = parseFloat(document.getElementById('kerf').value) || 3;
    var noRotate = (material === 'veneer'); // grain direction – can't rotate veneer

    // expand pieces out by quantity
    var allPieces = [];
    pieces.forEach(function(p) {
        for (var i = 0; i < p.qty; i++) {
            allPieces.push({ name: p.name, w: p.w, h: p.h, colour: p.colour });
        }
    });

    // FFD – sort biggest area first
    allPieces.sort(function(a, b) {
        return (b.w * b.h) - (a.w * a.h);
    });

    lastSheetW = sheetW;
    lastSheetH = sheetH;
    sheets = [];

    allPieces.forEach(function(piece) {
        var placed = false;

        for (var s = 0; s < sheets.length; s++) {
            var result = tryPlace(piece, sheets[s].freeRects, kerf, sheetW, sheetH, noRotate);
            if (result) {
                sheets[s].placed.push(result.placedPiece);
                sheets[s].freeRects = result.freeRects;
                placed = true;
                break;
            }
        }

        if (!placed) {
            // need a new sheet
            var newSheet = {
                placed: [],
                freeRects: [{ x: 0, y: 0, w: sheetW, h: sheetH }]
            };
            var result2 = tryPlace(piece, newSheet.freeRects, kerf, sheetW, sheetH, noRotate);
            if (result2) {
                newSheet.placed.push(result2.placedPiece);
                newSheet.freeRects = result2.freeRects;
            }
            sheets.push(newSheet);
        }
    });

    showResults(sheetW, sheetH, allPieces);
}

// try to fit a piece into the first available free rect on a sheet
function tryPlace(piece, freeRects, kerf, sheetW, sheetH, noRotate) {
    for (var i = 0; i < freeRects.length; i++) {
        var r = freeRects[i];

        // normal orientation
        if (piece.w <= r.w && piece.h <= r.h) {
            return guillotineSplit(piece.w, piece.h, piece, r, i, freeRects, kerf);
        }

        // try rotating (not for veneer – grain matters)
        if (!noRotate && piece.h <= r.w && piece.w <= r.h) {
            return guillotineSplit(piece.h, piece.w, piece, r, i, freeRects, kerf);
        }
    }
    return null;
}

// guillotine split – place piece and split remaining space into two free rects
function guillotineSplit(fitW, fitH, piece, rect, rectIndex, freeRects, kerf) {
    var newRects = freeRects.filter(function(_, idx) { return idx !== rectIndex; });

    // space to the right of the piece
    var rightW = rect.w - fitW - kerf;
    if (rightW > 0) {
        newRects.push({ x: rect.x + fitW + kerf, y: rect.y, w: rightW, h: fitH });
    }

    // space below the piece (full width of the original rect)
    var belowH = rect.h - fitH - kerf;
    if (belowH > 0) {
        newRects.push({ x: rect.x, y: rect.y + fitH + kerf, w: rect.w, h: belowH });
    }

    return {
        placedPiece: { name: piece.name, w: fitW, h: fitH, x: rect.x, y: rect.y, colour: piece.colour },
        freeRects: newRects
    };
}

// ---- Display results ----

function showResults(sheetW, sheetH, allPieces) {
    var totalPieceArea = 0;
    allPieces.forEach(function(p) { totalPieceArea += p.w * p.h; });

    var totalSheetArea = sheets.length * sheetW * sheetH;
    var efficiency = ((totalPieceArea / totalSheetArea) * 100).toFixed(1);
    var waste = (100 - efficiency).toFixed(1);

    document.getElementById('statSheets').textContent = sheets.length;
    document.getElementById('statEfficiency').textContent = efficiency + '%';
    document.getElementById('statWaste').textContent = waste + '%';
    document.getElementById('statPieces').textContent = allPieces.length;

    // colour the efficiency box based on how good it is
    var effBox = document.getElementById('effBox');
    effBox.className = 'stat-box';
    if (efficiency >= 75) effBox.classList.add('good');
    else if (efficiency >= 60) effBox.classList.add('warn');

    buildSheetTabs(sheetW, sheetH);

    document.getElementById('emptyResults').style.display = 'none';
    document.getElementById('results').style.display = 'block';

    currentSheet = 0;
    drawSheet(0, sheetW, sheetH);
}

function buildSheetTabs(sheetW, sheetH) {
    var tabs = document.getElementById('sheetTabs');
    tabs.innerHTML = '';

    sheets.forEach(function(_, i) {
        var btn = document.createElement('button');
        btn.className = 'sheet-tab' + (i === 0 ? ' active' : '');
        btn.textContent = 'Sheet ' + (i + 1);
        btn.onclick = (function(idx) {
            return function() {
                currentSheet = idx;
                document.querySelectorAll('.sheet-tab').forEach(function(t) { t.classList.remove('active'); });
                btn.classList.add('active');
                drawSheet(idx, sheetW, sheetH);
            };
        })(i);
        tabs.appendChild(btn);
    });
}

function drawSheet(sheetIndex, sheetW, sheetH) {
    var canvas = document.getElementById('cutCanvas');
    var ctx = canvas.getContext('2d');

    // scale to fit the canvas
    var canvasW = 700;
    var scale = canvasW / sheetW;
    var canvasH = Math.round(sheetH * scale);

    canvas.width = canvasW;
    canvas.height = canvasH;

    // sheet background
    ctx.fillStyle = '#f9f9f9';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // border
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvasW, canvasH);

    var sheet = sheets[sheetIndex];

    sheet.placed.forEach(function(piece) {
        var px = piece.x * scale;
        var py = piece.y * scale;
        var pw = piece.w * scale;
        var ph = piece.h * scale;

        // fill
        ctx.fillStyle = piece.colour;
        ctx.fillRect(px, py, pw, ph);

        // outline
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, pw, ph);

        // label – only draw text if there's room
        if (pw > 30 && ph > 14) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.font = '11px sans-serif';
            ctx.fillText(piece.name, px + 4, py + 13);
            if (ph > 26) {
                ctx.fillStyle = 'rgba(0,0,0,0.45)';
                ctx.font = '10px sans-serif';
                ctx.fillText(piece.w + '\u00d7' + piece.h, px + 4, py + 25);
            }
        }
    });

    // label for the sheet info
    document.getElementById('canvasLabel').textContent = 'Sheet ' + (sheetIndex + 1) + ' of ' + sheets.length;

    var placed = sheet.placed.length;
    var usedArea = 0;
    sheet.placed.forEach(function(p) { usedArea += p.w * p.h; });
    var sheetEff = ((usedArea / (sheetW * sheetH)) * 100).toFixed(1);

    document.getElementById('sheetInfo').textContent =
        placed + ' piece' + (placed !== 1 ? 's' : '') + ' on this sheet – ' + sheetEff + '% used';
}

// ---- Export ----

function exportCutListCSV() {
    if (!sheets.length) return;

    var rows = ['Sheet,Piece,Width (mm),Height (mm),X (mm),Y (mm)'];
    sheets.forEach(function(sheet, si) {
        sheet.placed.forEach(function(p) {
            rows.push((si + 1) + ',' + p.name + ',' + p.w + ',' + p.h + ',' + Math.round(p.x) + ',' + Math.round(p.y));
        });
    });

    var totalPieceArea = 0;
    sheets.forEach(function(s) { s.placed.forEach(function(p) { totalPieceArea += p.w * p.h; }); });
    var eff = ((totalPieceArea / (sheets.length * lastSheetW * lastSheetH)) * 100).toFixed(1);

    rows.push('');
    rows.push('Summary');
    rows.push('Total Sheets,Efficiency,Waste');
    rows.push(sheets.length + ',' + eff + '%,' + (100 - eff).toFixed(1) + '%');

    downloadFile('cut-list.csv', rows.join('\n'), 'text/csv');
}

function saveSheetImage() {
    var canvas = document.getElementById('cutCanvas');
    downloadFile('cut-sheet-' + (currentSheet + 1) + '.png', canvas.toDataURL('image/png'), null, true);
}

function downloadFile(filename, data, mime, isUrl) {
    var a = document.createElement('a');
    if (isUrl) {
        a.href = data;
    } else {
        a.href = URL.createObjectURL(new Blob([data], { type: mime }));
    }
    a.download = filename;
    a.click();
}
