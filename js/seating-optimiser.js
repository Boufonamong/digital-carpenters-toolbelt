// Space Layout Planner
// Anton Morris – Nevawood Joinery

var PRODUCTS = {
    picnic: {
        label: 'Pub / Picnic Bench',
        depth: 1700,
        sizes: [1000,1200,2000,2400,3000,3600,4800,5000,5600,6000],
        colour: '#c8a965'
    },
    crossbench: {
        label: 'Criss-Cross Bench',
        depth: 300,
        sizes: [1000,1200,2000,2400,3000,3600,4800,5000,5600,6000],
        colour: '#8b6340'
    },
    roundbench: {
        label: 'Round Bench',
        radii: [1000,2000,3000,4000],
        colour: '#3a9fbf'
    }
};

var placementList = [];
var lastLayout = null;
var lastRoomW = 0, lastRoomD = 0;
var lastLayoutMode = 'bench';

// --- UI helpers ---

function onModeChange() {
    var mode = document.getElementById('layoutMode').value;
    lastLayoutMode = mode;
    document.getElementById('benchPanel').style.display = mode === 'bench' ? 'block' : 'none';
    document.getElementById('venuePanel').style.display = mode === 'venue' ? 'block' : 'none';
}

function onProductTypeChange() {
    var type = document.getElementById('productType').value;
    if (type === 'roundbench') {
        document.getElementById('sizeGroup').style.display = 'none';
        document.getElementById('radiusGroup').style.display = 'block';
    } else {
        document.getElementById('sizeGroup').style.display = 'block';
        document.getElementById('radiusGroup').style.display = 'none';
        populateSizes(type);
    }
}

function populateSizes(type) {
    var select = document.getElementById('productSize');
    select.innerHTML = '';
    PRODUCTS[type].sizes.forEach(function(s) {
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = (s / 1000).toFixed(1) + 'm';
        select.appendChild(opt);
    });
}

function addProduct() {
    var type = document.getElementById('productType').value;
    var prod = PRODUCTS[type];
    var entry = { type: type, label: prod.label, colour: prod.colour };

    if (type === 'roundbench') {
        entry.radius = parseInt(document.getElementById('productRadius').value);
        entry.length = entry.radius * 2;
        entry.depth = entry.radius * 2;
        entry.displaySize = (entry.radius / 1000).toFixed(0) + 'm radius';
    } else {
        entry.length = parseInt(document.getElementById('productSize').value);
        entry.depth = prod.depth;
        entry.displaySize = (entry.length / 1000).toFixed(1) + 'm';
    }

    placementList.push(entry);
    renderProductList();
}

function removeProduct(i) {
    placementList.splice(i, 1);
    renderProductList();
}

function clearProducts() {
    placementList = [];
    renderProductList();
    document.getElementById('results').style.display = 'none';
    document.getElementById('emptyResults').style.display = 'block';
}

function renderProductList() {
    var list = document.getElementById('productList');
    if (placementList.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No products added yet</p></div>';
        return;
    }
    var html = '';
    placementList.forEach(function(p, i) {
        html += '<div class="tool-item">';
        html += '<div style="display:flex;align-items:center;flex:1;gap:8px">';
        html += '<div style="width:10px;height:10px;border-radius:50%;background:' + p.colour + ';flex-shrink:0"></div>';
        html += '<span style="font-weight:500;font-size:0.82rem">' + p.label + '</span>';
        html += '<span style="color:#64748b;font-size:0.75rem">' + p.displaySize + '</span>';
        html += '</div>';
        html += '<button class="btn-danger" onclick="removeProduct(' + i + ')">&#10005;</button>';
        html += '</div>';
    });
    list.innerHTML = html;
}

function calcCovers(entry) {
    if (entry.type === 'roundbench') {
        return Math.floor(2 * Math.PI * entry.radius / 500);
    } else if (entry.type === 'crossbench') {
        return Math.floor(entry.length / 450);
    } else {
        return Math.floor(entry.length / 450) * 2;
    }
}

// --- Layout entry point ---

function runLayout() {
    var roomW = parseFloat(document.getElementById('roomW').value) * 1000;
    var roomD = parseFloat(document.getElementById('roomD').value) * 1000;
    var aisleGap = parseFloat(document.getElementById('aisleGap').value) || 900;
    var mode = document.getElementById('layoutMode').value;
    lastLayoutMode = mode;
    lastRoomW = roomW;
    lastRoomD = roomD;

    var placed;
    if (mode === 'venue') {
        placed = runVenueLayout(roomW, roomD, aisleGap);
        if (!placed.length) {
            alert('Room is too small for this venue style. Try larger dimensions.');
            return;
        }
    } else {
        if (placementList.length === 0) {
            alert('Add at least one product first.');
            return;
        }
        placed = runBenchLayout(roomW, roomD, aisleGap);
    }

    lastLayout = placed;
    showResults(placed, roomW, roomD);
}

// --- Bench layout (original cycling algorithm) ---

function runBenchLayout(roomW, roomD, aisleGap) {
    var wallClear = 400;
    var placed = [];
    var curY = wallClear;
    var n = placementList.length;
    var idx = 0;
    var skipped = 0;

    while (curY < roomD - wallClear) {
        var prod = placementList[idx % n];
        idx++;

        var rowH = (prod.type === 'roundbench') ? prod.radius * 2 : prod.depth;

        if (curY + rowH > roomD - wallClear) {
            skipped++;
            if (skipped >= n) break;
            continue;
        }

        skipped = 0;

        if (prod.type === 'roundbench') {
            var diam = prod.radius * 2;
            var curX = wallClear;
            while (curX + diam <= roomW - wallClear) {
                placed.push({
                    type: 'roundbench', isRound: true,
                    cx: curX + prod.radius,
                    cy: curY + prod.radius,
                    radius: prod.radius,
                    colour: prod.colour,
                    label: prod.label,
                    displaySize: prod.displaySize,
                    covers: calcCovers(prod)
                });
                curX += diam + aisleGap;
            }
        } else {
            var curX = wallClear;
            while (curX + prod.length <= roomW - wallClear) {
                placed.push({
                    type: prod.type, isRound: false,
                    x: curX, y: curY,
                    length: prod.length, depth: prod.depth,
                    colour: prod.colour,
                    label: prod.label,
                    displaySize: prod.displaySize,
                    covers: calcCovers(prod)
                });
                curX += prod.length + 50;
            }
        }

        curY += rowH + aisleGap;
    }

    return placed;
}

// --- Venue layouts ---

function runVenueLayout(roomW, roomD, aisleGap) {
    var style = document.getElementById('venueStyle').value;
    if (style === 'theatre')   return layoutTheatre(roomW, roomD, aisleGap);
    if (style === 'classroom') return layoutClassroom(roomW, roomD, aisleGap);
    if (style === 'boardroom') return layoutBoardroom(roomW, roomD);
    if (style === 'church')    return layoutChurch(roomW, roomD, aisleGap);
    if (style === 'pub')       return layoutPub(roomW, roomD, aisleGap);
    return [];
}

// Theatre: rows of seats either side of a centre aisle, stage clearance at front
function layoutTheatre(roomW, roomD, aisleGap) {
    var placed = [];
    var wallClear   = 400;
    var stageClear  = 800;   // front clearance for stage / screen
    var seatW       = 450;   // per-seat width
    var rowD        = 400;   // row depth
    var rowSpacing  = 900;   // pitch between row fronts (UK reg: ~850–900mm)
    var centerAisle = Math.max(900, aisleGap);

    var usableW = roomW - 2 * wallClear;
    var halfSection = (usableW - centerAisle) / 2;
    if (halfSection < seatW) return placed;

    var seatsPerSection = Math.floor(halfSection / seatW);
    var sectionW = seatsPerSection * seatW;
    var xLeft  = wallClear;
    var xRight = wallClear + sectionW + centerAisle;
    var curY   = wallClear + stageClear;

    while (curY + rowD <= roomD - wallClear) {
        placed.push({
            type: 'row', isRound: false,
            x: xLeft, y: curY, length: sectionW, depth: rowD,
            seatsInRow: seatsPerSection,
            colour: '#5b8db8',
            label: 'Theatre Row', displaySize: seatsPerSection + ' seats',
            covers: seatsPerSection
        });
        placed.push({
            type: 'row', isRound: false,
            x: xRight, y: curY, length: sectionW, depth: rowD,
            seatsInRow: seatsPerSection,
            colour: '#5b8db8',
            label: 'Theatre Row', displaySize: seatsPerSection + ' seats',
            covers: seatsPerSection
        });
        curY += rowSpacing;
    }
    return placed;
}

// Classroom: desks in rows facing the front, split into two banks with centre aisle
function layoutClassroom(roomW, roomD, aisleGap) {
    var placed = [];
    var wallClear  = 400;
    var frontClear = 1200;  // teacher / board space
    var deskW      = 600;   // width per desk (one student)
    var deskD      = 400;   // desk + chair depth
    var rowSpacing = 1100;  // pitch between rows
    var aisleW     = Math.max(900, aisleGap);

    var usableW = roomW - 2 * wallClear;
    var halfSection = (usableW - aisleW) / 2;
    var desksPerSection = Math.floor(halfSection / deskW);

    if (desksPerSection < 1) {
        // single bank, no aisle
        desksPerSection = Math.floor(usableW / deskW);
        var sectionW = desksPerSection * deskW;
        var xStart = wallClear + (usableW - sectionW) / 2;
        var curY = wallClear + frontClear;
        while (curY + deskD <= roomD - wallClear) {
            placed.push({
                type: 'desk', isRound: false,
                x: xStart, y: curY, length: sectionW, depth: deskD,
                seatsInRow: desksPerSection,
                colour: '#5b9f5b',
                label: 'Desk Row', displaySize: desksPerSection + ' desks',
                covers: desksPerSection
            });
            curY += rowSpacing;
        }
    } else {
        var sectionW = desksPerSection * deskW;
        var xLeft  = wallClear;
        var xRight = wallClear + sectionW + aisleW;
        var curY   = wallClear + frontClear;
        while (curY + deskD <= roomD - wallClear) {
            placed.push({
                type: 'desk', isRound: false,
                x: xLeft, y: curY, length: sectionW, depth: deskD,
                seatsInRow: desksPerSection,
                colour: '#5b9f5b',
                label: 'Desk Row', displaySize: desksPerSection + ' desks',
                covers: desksPerSection
            });
            placed.push({
                type: 'desk', isRound: false,
                x: xRight, y: curY, length: sectionW, depth: deskD,
                seatsInRow: desksPerSection,
                colour: '#5b9f5b',
                label: 'Desk Row', displaySize: desksPerSection + ' desks',
                covers: desksPerSection
            });
            curY += rowSpacing;
        }
    }
    return placed;
}

// Boardroom: central table with perimeter chairs on all four sides
function layoutBoardroom(roomW, roomD) {
    var placed = [];
    var wallClear = 500;
    var chairD    = 400;   // depth of chair zone
    var gap       = 150;   // gap between chairs and table edge

    var tableW = roomW - 2 * (wallClear + chairD + gap);
    var tableD = roomD - 2 * (wallClear + chairD + gap);
    if (tableW < 600 || tableD < 600) return placed;

    var tableX = wallClear + chairD + gap;
    var tableY = wallClear + chairD + gap;

    placed.push({
        type: 'boardtable', isRound: false,
        x: tableX, y: tableY, length: tableW, depth: tableD,
        colour: '#c8a96e',
        label: 'Boardroom Table',
        displaySize: (tableW / 1000).toFixed(1) + 'm \u00d7 ' + (tableD / 1000).toFixed(1) + 'm',
        covers: 0
    });

    var chairW    = 500;
    var topChairs  = Math.floor(tableW / chairW);
    var sideChairs = Math.floor(tableD / chairW);

    if (topChairs > 0) {
        placed.push({
            type: 'row', isRound: false,
            x: tableX, y: wallClear, length: tableW, depth: chairD,
            seatsInRow: topChairs, colour: '#8b6340',
            label: 'Chairs (top)', displaySize: topChairs + ' seats',
            covers: topChairs
        });
        placed.push({
            type: 'row', isRound: false,
            x: tableX, y: tableY + tableD + gap, length: tableW, depth: chairD,
            seatsInRow: topChairs, colour: '#8b6340',
            label: 'Chairs (bottom)', displaySize: topChairs + ' seats',
            covers: topChairs
        });
    }
    if (sideChairs > 0) {
        placed.push({
            type: 'row', isRound: false,
            x: wallClear, y: tableY, length: chairD, depth: tableD,
            colour: '#8b6340',
            label: 'Chairs (left)', displaySize: sideChairs + ' seats',
            covers: sideChairs
        });
        placed.push({
            type: 'row', isRound: false,
            x: tableX + tableW + gap, y: tableY, length: chairD, depth: tableD,
            colour: '#8b6340',
            label: 'Chairs (right)', displaySize: sideChairs + ' seats',
            covers: sideChairs
        });
    }
    return placed;
}

// Church: pews in two sections either side of a centre aisle, side aisles, chancel clearance
function layoutChurch(roomW, roomD, aisleGap) {
    var placed = [];
    var wallClear    = 400;
    var chancelClear = 1500;  // front clearance for altar / chancel
    var sideAisle    = 800;
    var centerAisle  = Math.max(1200, aisleGap);  // UK: min 1200mm
    var pewD         = 450;
    var seatW        = 500;   // per-person width on pew
    var pewSpacing   = 900;   // pew pitch

    var usableW = roomW - 2 * (wallClear + sideAisle);
    var halfSection = (usableW - centerAisle) / 2;
    if (halfSection < seatW) return placed;

    var seatsPerSection = Math.floor(halfSection / seatW);
    var sectionW = seatsPerSection * seatW;
    var xLeft  = wallClear + sideAisle;
    var xRight = wallClear + sideAisle + sectionW + centerAisle;
    var curY   = wallClear + chancelClear;

    while (curY + pewD <= roomD - wallClear) {
        placed.push({
            type: 'pew', isRound: false,
            x: xLeft, y: curY, length: sectionW, depth: pewD,
            seatsInRow: seatsPerSection,
            colour: '#b08060',
            label: 'Pew', displaySize: seatsPerSection + ' seats',
            covers: seatsPerSection
        });
        placed.push({
            type: 'pew', isRound: false,
            x: xRight, y: curY, length: sectionW, depth: pewD,
            seatsInRow: seatsPerSection,
            colour: '#b08060',
            label: 'Pew', displaySize: seatsPerSection + ' seats',
            covers: seatsPerSection
        });
        curY += pewSpacing;
    }
    return placed;
}

// Pub / Bar: grid of square table units (table + chairs, 4 covers each)
function layoutPub(roomW, roomD, aisleGap) {
    var placed = [];
    var wallClear = 400;
    var tableSize = 700;     // table square (mm)
    var chairRim  = 350;     // chair depth on each side
    var unitSize  = tableSize + 2 * chairRim;  // 1400mm per unit
    var gap       = Math.max(600, aisleGap);

    var curX = wallClear;
    while (curX + unitSize <= roomW - wallClear) {
        var curY = wallClear;
        while (curY + unitSize <= roomD - wallClear) {
            placed.push({
                type: 'pubtable', isRound: false,
                x: curX, y: curY, length: unitSize, depth: unitSize,
                colour: '#c8a965',
                label: 'Pub Table', displaySize: '4 covers',
                covers: 4
            });
            curY += unitSize + gap;
        }
        curX += unitSize + gap;
    }
    return placed;
}

// --- Results ---

function showResults(placed, roomW, roomD) {
    var totalCovers = 0;
    var usedArea = 0;

    placed.forEach(function(p) {
        totalCovers += p.covers;
        usedArea += p.isRound ? Math.PI * p.radius * p.radius : p.length * p.depth;
    });

    var util = ((usedArea / (roomW * roomD)) * 100).toFixed(0);

    document.getElementById('statUnits').textContent = placed.length;
    document.getElementById('statCovers').textContent = totalCovers;
    document.getElementById('statUtil').textContent = util + '%';

    var unitsLabel = document.getElementById('statUnitsLabel');
    if (unitsLabel) {
        unitsLabel.textContent = lastLayoutMode === 'venue' ? 'Rows / Units' : 'Units Placed';
    }

    var modePrefix;
    if (lastLayoutMode === 'venue') {
        var style = document.getElementById('venueStyle').value;
        modePrefix = style.charAt(0).toUpperCase() + style.slice(1) + ' Layout';
    } else {
        modePrefix = 'Space Layout';
    }

    document.getElementById('layoutLabel').textContent = modePrefix + ' \u2013 ' + (roomW / 1000).toFixed(1) + 'm \u00d7 ' + (roomD / 1000).toFixed(1) + 'm';
    document.getElementById('layoutInfo').textContent = placed.length + ' units placed, approximately ' + totalCovers + ' covers';

    drawLayout(placed, roomW, roomD);

    document.getElementById('emptyResults').style.display = 'none';
    document.getElementById('results').style.display = 'block';
}

function drawLayout(placed, roomW, roomD) {
    var canvas = document.getElementById('seatingCanvas');
    var ctx = canvas.getContext('2d');

    var canvasW = 700;
    var canvasH = 500;
    var scale = Math.min(canvasW / roomW, canvasH / roomD) * 0.92;
    var offX = (canvasW - roomW * scale) / 2;
    var offY = (canvasH - roomD * scale) / 2;

    ctx.clearRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = '#f5f2ec';
    ctx.fillRect(offX, offY, roomW * scale, roomD * scale);
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 2;
    ctx.strokeRect(offX, offY, roomW * scale, roomD * scale);

    placed.forEach(function(p) {
        ctx.fillStyle = p.colour;

        if (p.isRound) {
            var cx = offX + p.cx * scale;
            var cy = offY + p.cy * scale;
            var r  = p.radius * scale;

            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // hollow centre to suggest the table area
            ctx.fillStyle = '#f5f2ec';
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
            ctx.fill();

        } else {
            var px = offX + p.x * scale;
            var py = offY + p.y * scale;
            var pw = p.length * scale;
            var pd = p.depth * scale;

            if (p.type === 'pubtable') {
                // chair area (lighter fill) + darker table centre
                ctx.fillRect(px, py, pw, pd);
                var mg = Math.min(pw, pd) * 0.28;
                ctx.fillStyle = 'rgba(0,0,0,0.22)';
                ctx.fillRect(px + mg, py + mg, pw - 2 * mg, pd - 2 * mg);
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 1;
                ctx.strokeRect(px, py, pw, pd);

            } else if (p.type === 'boardtable') {
                ctx.fillRect(px, py, pw, pd);
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(px, py, pw, pd);
                if (pw > 30 && pd > 10) {
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.font = '9px sans-serif';
                    ctx.fillText('TABLE', px + 4, py + 12);
                }

            } else if (p.type === 'row' || p.type === 'pew' || p.type === 'desk') {
                ctx.fillRect(px, py, pw, pd);
                // white seat-divider lines (only for horizontally oriented rows)
                if (p.seatsInRow && p.seatsInRow > 1 && pw > pd) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                    ctx.lineWidth = 1;
                    var slotW = pw / p.seatsInRow;
                    for (var s = 1; s < p.seatsInRow; s++) {
                        ctx.beginPath();
                        ctx.moveTo(px + s * slotW, py + 1);
                        ctx.lineTo(px + s * slotW, py + pd - 1);
                        ctx.stroke();
                    }
                }
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 1;
                ctx.strokeRect(px, py, pw, pd);

            } else {
                // existing bench types: picnic, crossbench
                ctx.fillRect(px, py, pw, pd);

                // dark stripe down the middle of picnic benches = table top
                if (p.type === 'picnic' && pd > 6) {
                    ctx.fillStyle = 'rgba(0,0,0,0.13)';
                    ctx.fillRect(px, py + pd * 0.33, pw, pd * 0.34);
                }

                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 1;
                ctx.strokeRect(px, py, pw, pd);

                if (pw > 24 && pd > 8) {
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    ctx.font = '9px sans-serif';
                    ctx.fillText(p.displaySize, px + 3, py + 11);
                }
            }
        }
    });

    ctx.fillStyle = '#999';
    ctx.font = '11px sans-serif';
    ctx.fillText((roomW / 1000).toFixed(1) + 'm \u00d7 ' + (roomD / 1000).toFixed(1) + 'm', offX + 6, offY + roomD * scale - 6);
}

function exportSeatingCSV() {
    if (!lastLayout || !lastLayout.length) return;

    var totalCovers = 0;
    lastLayout.forEach(function(p) { totalCovers += p.covers; });

    var rows = ['Nevawood Space Layout Report'];

    if (lastLayoutMode === 'venue') {
        var venueStyle = document.getElementById('venueStyle').value;
        rows.push('Venue Style,Room Width (m),Room Depth (m),Total Units,Est. Covers');
        rows.push(venueStyle + ',' + (lastRoomW / 1000).toFixed(1) + ',' + (lastRoomD / 1000).toFixed(1) + ',' + lastLayout.length + ',' + totalCovers);
        rows.push('');
        rows.push('Unit,Type,Details,Est. Covers');
        lastLayout.forEach(function(p, i) {
            rows.push((i + 1) + ',' + p.label + ',' + p.displaySize + ',' + p.covers);
        });
    } else {
        rows.push('Room Width (m),Room Depth (m),Total Units,Est. Covers');
        rows.push((lastRoomW / 1000).toFixed(1) + ',' + (lastRoomD / 1000).toFixed(1) + ',' + lastLayout.length + ',' + totalCovers);
        rows.push('');
        rows.push('Unit,Product,Size,X (mm),Y (mm),Est. Covers');
        lastLayout.forEach(function(p, i) {
            var x = p.isRound ? Math.round(p.cx) : Math.round(p.x);
            var y = p.isRound ? Math.round(p.cy) : Math.round(p.y);
            rows.push((i + 1) + ',' + p.label + ',' + p.displaySize + ',' + x + ',' + y + ',' + p.covers);
        });
    }

    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    a.download = 'nevawood-space-layout.csv';
    a.click();
}

function saveSeatingImage() {
    var canvas = document.getElementById('seatingCanvas');
    var a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'space-layout.png';
    a.click();
}
