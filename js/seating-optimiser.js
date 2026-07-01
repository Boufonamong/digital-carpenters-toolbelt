// Space Layout Planner --- Nevawood Joinery
//
// Two modes:
//   - bench : cycle through user-added Nevawood products filling the room
//   - venue : one of five hardcoded parametric layouts
//             (theatre, classroom, boardroom, church, pub)

const PRODUCTS = {
    picnic: {
        label: 'Pub / Picnic Bench',
        depth: 1700,
        sizes: [1000, 1200, 2000, 2400, 3000, 3600, 4800, 5000, 5600, 6000],
        colour: '#c8a965',
    },
    crossbench: {
        label: 'Criss-Cross Bench',
        depth: 300,
        sizes: [1000, 1200, 2000, 2400, 3000, 3600, 4800, 5000, 5600, 6000],
        colour: '#8b6340',
    },
    roundbench: {
        label: 'Round Bench',
        radii: [1000, 2000, 3000, 4000],
        colour: '#3a9fbf',
    },
};

const state = {
    placementList: [],
    lastLayout: null,
    lastRoomW: 0,
    lastRoomD: 0,
    lastLayoutMode: 'bench',
};

// ---- UI helpers ----

function onModeChange() {
    const mode = document.getElementById('layoutMode').value;
    state.lastLayoutMode = mode;
    document.getElementById('benchPanel').style.display = mode === 'bench' ? 'block' : 'none';
    document.getElementById('venuePanel').style.display = mode === 'venue' ? 'block' : 'none';
}

function onProductTypeChange() {
    const type = document.getElementById('productType').value;
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
    const select = document.getElementById('productSize');
    select.innerHTML = '';
    for (const s of PRODUCTS[type].sizes) {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = `${(s / 1000).toFixed(1)}m`;
        select.appendChild(opt);
    }
}

function addProduct() {
    const type = document.getElementById('productType').value;
    const prod = PRODUCTS[type];
    const entry = { type, label: prod.label, colour: prod.colour };

    if (type === 'roundbench') {
        entry.radius = parseInt(document.getElementById('productRadius').value, 10);
        entry.length = entry.radius * 2;
        entry.depth = entry.radius * 2;
        entry.displaySize = `${(entry.radius / 1000).toFixed(0)}m radius`;
    } else {
        entry.length = parseInt(document.getElementById('productSize').value, 10);
        entry.depth = prod.depth;
        entry.displaySize = `${(entry.length / 1000).toFixed(1)}m`;
    }

    state.placementList.push(entry);
    renderProductList();
}

function removeProduct(i) {
    state.placementList.splice(i, 1);
    renderProductList();
}

function clearProducts() {
    state.placementList = [];
    renderProductList();
    document.getElementById('results').style.display = 'none';
    document.getElementById('emptyResults').style.display = 'block';
}

function renderProductList() {
    const list = document.getElementById('productList');
    if (state.placementList.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No products added yet</p></div>';
        return;
    }
    const html = state.placementList.map((p, i) => `
        <div class="tool-item">
            <div style="display:flex;align-items:center;flex:1;gap:8px">
                <div style="width:10px;height:10px;border-radius:50%;background:${p.colour};flex-shrink:0"></div>
                <span style="font-weight:500;font-size:0.82rem">${p.label}</span>
                <span style="color:#64748b;font-size:0.75rem">${p.displaySize}</span>
            </div>
            <button class="btn-danger" onclick="removeProduct(${i})">&#10005;</button>
        </div>
    `).join('');
    list.innerHTML = html;
}

function calcCovers(entry) {
    if (entry.type === 'roundbench') {
        return Math.floor(2 * Math.PI * entry.radius / 500);
    }
    if (entry.type === 'crossbench') {
        return Math.floor(entry.length / 450);
    }
    return Math.floor(entry.length / 450) * 2;
}

// ---- Layout entry point ----

function runLayout() {
    const roomW = parseFloat(document.getElementById('roomW').value) * 1000;
    const roomD = parseFloat(document.getElementById('roomD').value) * 1000;
    const aisleGap = parseFloat(document.getElementById('aisleGap').value) || 900;
    const mode = document.getElementById('layoutMode').value;
    state.lastLayoutMode = mode;
    state.lastRoomW = roomW;
    state.lastRoomD = roomD;

    let placed;
    if (mode === 'venue') {
        placed = runVenueLayout(roomW, roomD, aisleGap);
        if (!placed.length) {
            alert('Room is too small for this venue style. Try larger dimensions.');
            return;
        }
    } else {
        if (state.placementList.length === 0) {
            alert('Add at least one product first.');
            return;
        }
        placed = runBenchLayout(roomW, roomD, aisleGap);
    }

    state.lastLayout = placed;
    showResults(placed, roomW, roomD);
}

// ---- Bench layout (product-cycling algorithm) ----

function runBenchLayout(roomW, roomD, aisleGap) {
    const wallClear = 400;
    const placed = [];
    let curY = wallClear;
    const n = state.placementList.length;
    let idx = 0;
    let skipped = 0;

    while (curY < roomD - wallClear) {
        const prod = state.placementList[idx % n];
        idx++;

        const rowH = (prod.type === 'roundbench') ? prod.radius * 2 : prod.depth;

        if (curY + rowH > roomD - wallClear) {
            skipped++;
            if (skipped >= n) break;
            continue;
        }

        skipped = 0;

        if (prod.type === 'roundbench') {
            const diam = prod.radius * 2;
            let curX = wallClear;
            while (curX + diam <= roomW - wallClear) {
                placed.push({
                    type: 'roundbench', isRound: true,
                    cx: curX + prod.radius,
                    cy: curY + prod.radius,
                    radius: prod.radius,
                    colour: prod.colour,
                    label: prod.label,
                    displaySize: prod.displaySize,
                    covers: calcCovers(prod),
                });
                curX += diam + aisleGap;
            }
        } else {
            let curX = wallClear;
            while (curX + prod.length <= roomW - wallClear) {
                placed.push({
                    type: prod.type, isRound: false,
                    x: curX, y: curY,
                    length: prod.length, depth: prod.depth,
                    colour: prod.colour,
                    label: prod.label,
                    displaySize: prod.displaySize,
                    covers: calcCovers(prod),
                });
                curX += prod.length + 50;
            }
        }

        curY += rowH + aisleGap;
    }

    return placed;
}

// ---- Venue layouts ----

function runVenueLayout(roomW, roomD, aisleGap) {
    const style = document.getElementById('venueStyle').value;
    if (style === 'theatre')   return layoutTheatre(roomW, roomD, aisleGap);
    if (style === 'classroom') return layoutClassroom(roomW, roomD, aisleGap);
    if (style === 'boardroom') return layoutBoardroom(roomW, roomD);
    if (style === 'church')    return layoutChurch(roomW, roomD, aisleGap);
    if (style === 'pub')       return layoutPub(roomW, roomD, aisleGap);
    return [];
}

// Theatre: rows of seats either side of a centre aisle, stage clearance at front.
function layoutTheatre(roomW, roomD, aisleGap) {
    const placed = [];
    const wallClear = 400;
    const stageClear = 800;
    const seatW = 450;
    const rowD = 400;
    const rowSpacing = 900;
    const centerAisle = Math.max(900, aisleGap);

    const usableW = roomW - 2 * wallClear;
    const halfSection = (usableW - centerAisle) / 2;
    if (halfSection < seatW) return placed;

    const seatsPerSection = Math.floor(halfSection / seatW);
    const sectionW = seatsPerSection * seatW;
    const xLeft = wallClear;
    const xRight = wallClear + sectionW + centerAisle;
    let curY = wallClear + stageClear;

    while (curY + rowD <= roomD - wallClear) {
        placed.push({
            type: 'row', isRound: false,
            x: xLeft, y: curY, length: sectionW, depth: rowD,
            seatsInRow: seatsPerSection,
            colour: '#5b8db8',
            label: 'Theatre Row', displaySize: `${seatsPerSection} seats`,
            covers: seatsPerSection,
        });
        placed.push({
            type: 'row', isRound: false,
            x: xRight, y: curY, length: sectionW, depth: rowD,
            seatsInRow: seatsPerSection,
            colour: '#5b8db8',
            label: 'Theatre Row', displaySize: `${seatsPerSection} seats`,
            covers: seatsPerSection,
        });
        curY += rowSpacing;
    }
    return placed;
}

// Classroom: desks in rows facing the front, split into two banks with centre aisle.
function layoutClassroom(roomW, roomD, aisleGap) {
    const placed = [];
    const wallClear = 400;
    const frontClear = 1200;
    const deskW = 600;
    const deskD = 400;
    const rowSpacing = 1100;
    const aisleW = Math.max(900, aisleGap);

    const usableW = roomW - 2 * wallClear;
    const halfSection = (usableW - aisleW) / 2;
    let desksPerSection = Math.floor(halfSection / deskW);

    if (desksPerSection < 1) {
        desksPerSection = Math.floor(usableW / deskW);
        const sectionW = desksPerSection * deskW;
        const xStart = wallClear + (usableW - sectionW) / 2;
        let curY = wallClear + frontClear;
        while (curY + deskD <= roomD - wallClear) {
            placed.push({
                type: 'desk', isRound: false,
                x: xStart, y: curY, length: sectionW, depth: deskD,
                seatsInRow: desksPerSection,
                colour: '#5b9f5b',
                label: 'Desk Row', displaySize: `${desksPerSection} desks`,
                covers: desksPerSection,
            });
            curY += rowSpacing;
        }
    } else {
        const sectionW = desksPerSection * deskW;
        const xLeft = wallClear;
        const xRight = wallClear + sectionW + aisleW;
        let curY = wallClear + frontClear;
        while (curY + deskD <= roomD - wallClear) {
            placed.push({
                type: 'desk', isRound: false,
                x: xLeft, y: curY, length: sectionW, depth: deskD,
                seatsInRow: desksPerSection,
                colour: '#5b9f5b',
                label: 'Desk Row', displaySize: `${desksPerSection} desks`,
                covers: desksPerSection,
            });
            placed.push({
                type: 'desk', isRound: false,
                x: xRight, y: curY, length: sectionW, depth: deskD,
                seatsInRow: desksPerSection,
                colour: '#5b9f5b',
                label: 'Desk Row', displaySize: `${desksPerSection} desks`,
                covers: desksPerSection,
            });
            curY += rowSpacing;
        }
    }
    return placed;
}

// Boardroom: central table with perimeter chairs on all four sides.
function layoutBoardroom(roomW, roomD) {
    const placed = [];
    const wallClear = 500;
    const chairD = 400;
    const gap = 150;

    const tableW = roomW - 2 * (wallClear + chairD + gap);
    const tableD = roomD - 2 * (wallClear + chairD + gap);
    if (tableW < 600 || tableD < 600) return placed;

    const tableX = wallClear + chairD + gap;
    const tableY = wallClear + chairD + gap;

    placed.push({
        type: 'boardtable', isRound: false,
        x: tableX, y: tableY, length: tableW, depth: tableD,
        colour: '#c8a96e',
        label: 'Boardroom Table',
        displaySize: `${(tableW / 1000).toFixed(1)}m × ${(tableD / 1000).toFixed(1)}m`,
        covers: 0,
    });

    const chairW = 500;
    const topChairs = Math.floor(tableW / chairW);
    const sideChairs = Math.floor(tableD / chairW);

    if (topChairs > 0) {
        placed.push({
            type: 'row', isRound: false,
            x: tableX, y: wallClear, length: tableW, depth: chairD,
            seatsInRow: topChairs, colour: '#8b6340',
            label: 'Chairs (top)', displaySize: `${topChairs} seats`,
            covers: topChairs,
        });
        placed.push({
            type: 'row', isRound: false,
            x: tableX, y: tableY + tableD + gap, length: tableW, depth: chairD,
            seatsInRow: topChairs, colour: '#8b6340',
            label: 'Chairs (bottom)', displaySize: `${topChairs} seats`,
            covers: topChairs,
        });
    }
    if (sideChairs > 0) {
        placed.push({
            type: 'row', isRound: false,
            x: wallClear, y: tableY, length: chairD, depth: tableD,
            colour: '#8b6340',
            label: 'Chairs (left)', displaySize: `${sideChairs} seats`,
            covers: sideChairs,
        });
        placed.push({
            type: 'row', isRound: false,
            x: tableX + tableW + gap, y: tableY, length: chairD, depth: tableD,
            colour: '#8b6340',
            label: 'Chairs (right)', displaySize: `${sideChairs} seats`,
            covers: sideChairs,
        });
    }
    return placed;
}

// Church: pews in two sections either side of a centre aisle, side aisles, chancel clearance.
function layoutChurch(roomW, roomD, aisleGap) {
    const placed = [];
    const wallClear = 400;
    const chancelClear = 1500;
    const sideAisle = 800;
    const centerAisle = Math.max(1200, aisleGap); // UK Building Regs minimum
    const pewD = 450;
    const seatW = 500;
    const pewSpacing = 900;

    const usableW = roomW - 2 * (wallClear + sideAisle);
    const halfSection = (usableW - centerAisle) / 2;
    if (halfSection < seatW) return placed;

    const seatsPerSection = Math.floor(halfSection / seatW);
    const sectionW = seatsPerSection * seatW;
    const xLeft = wallClear + sideAisle;
    const xRight = wallClear + sideAisle + sectionW + centerAisle;
    let curY = wallClear + chancelClear;

    while (curY + pewD <= roomD - wallClear) {
        placed.push({
            type: 'pew', isRound: false,
            x: xLeft, y: curY, length: sectionW, depth: pewD,
            seatsInRow: seatsPerSection,
            colour: '#b08060',
            label: 'Pew', displaySize: `${seatsPerSection} seats`,
            covers: seatsPerSection,
        });
        placed.push({
            type: 'pew', isRound: false,
            x: xRight, y: curY, length: sectionW, depth: pewD,
            seatsInRow: seatsPerSection,
            colour: '#b08060',
            label: 'Pew', displaySize: `${seatsPerSection} seats`,
            covers: seatsPerSection,
        });
        curY += pewSpacing;
    }
    return placed;
}

// Pub / Bar: grid of 4-cover square table units.
function layoutPub(roomW, roomD, aisleGap) {
    const placed = [];
    const wallClear = 400;
    const tableSize = 700;
    const chairRim = 350;
    const unitSize = tableSize + 2 * chairRim;
    const gap = Math.max(600, aisleGap);

    let curX = wallClear;
    while (curX + unitSize <= roomW - wallClear) {
        let curY = wallClear;
        while (curY + unitSize <= roomD - wallClear) {
            placed.push({
                type: 'pubtable', isRound: false,
                x: curX, y: curY, length: unitSize, depth: unitSize,
                colour: '#c8a965',
                label: 'Pub Table', displaySize: '4 covers',
                covers: 4,
            });
            curY += unitSize + gap;
        }
        curX += unitSize + gap;
    }
    return placed;
}

// ---- Results ----

function showResults(placed, roomW, roomD) {
    let totalCovers = 0;
    let usedArea = 0;

    for (const p of placed) {
        totalCovers += p.covers;
        usedArea += p.isRound ? Math.PI * p.radius * p.radius : p.length * p.depth;
    }

    const util = ((usedArea / (roomW * roomD)) * 100).toFixed(0);

    document.getElementById('statUnits').textContent = placed.length;
    document.getElementById('statCovers').textContent = totalCovers;
    document.getElementById('statUtil').textContent = `${util}%`;

    const unitsLabel = document.getElementById('statUnitsLabel');
    if (unitsLabel) {
        unitsLabel.textContent = state.lastLayoutMode === 'venue' ? 'Rows / Units' : 'Units Placed';
    }

    let modePrefix;
    if (state.lastLayoutMode === 'venue') {
        const style = document.getElementById('venueStyle').value;
        modePrefix = `${style.charAt(0).toUpperCase()}${style.slice(1)} Layout`;
    } else {
        modePrefix = 'Space Layout';
    }

    document.getElementById('layoutLabel').textContent =
        `${modePrefix} – ${(roomW / 1000).toFixed(1)}m × ${(roomD / 1000).toFixed(1)}m`;
    document.getElementById('layoutInfo').textContent =
        `${placed.length} units placed, approximately ${totalCovers} covers`;

    drawLayout(placed, roomW, roomD);

    document.getElementById('emptyResults').style.display = 'none';
    document.getElementById('results').style.display = 'block';
}

function drawLayout(placed, roomW, roomD) {
    const canvas = document.getElementById('seatingCanvas');
    const ctx = canvas.getContext('2d');

    const canvasW = 700;
    const canvasH = 500;
    const scale = Math.min(canvasW / roomW, canvasH / roomD) * 0.92;
    const offX = (canvasW - roomW * scale) / 2;
    const offY = (canvasH - roomD * scale) / 2;

    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#f5f2ec';
    ctx.fillRect(offX, offY, roomW * scale, roomD * scale);
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 2;
    ctx.strokeRect(offX, offY, roomW * scale, roomD * scale);

    for (const p of placed) {
        ctx.fillStyle = p.colour;

        if (p.isRound) {
            const cx = offX + p.cx * scale;
            const cy = offY + p.cy * scale;
            const r = p.radius * scale;

            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#f5f2ec';
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
            ctx.fill();
        } else {
            const px = offX + p.x * scale;
            const py = offY + p.y * scale;
            const pw = p.length * scale;
            const pd = p.depth * scale;

            if (p.type === 'pubtable') {
                ctx.fillRect(px, py, pw, pd);
                const mg = Math.min(pw, pd) * 0.28;
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
                if (p.seatsInRow && p.seatsInRow > 1 && pw > pd) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                    ctx.lineWidth = 1;
                    const slotW = pw / p.seatsInRow;
                    for (let s = 1; s < p.seatsInRow; s++) {
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
                ctx.fillRect(px, py, pw, pd);
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
    }

    ctx.fillStyle = '#999';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${(roomW / 1000).toFixed(1)}m × ${(roomD / 1000).toFixed(1)}m`, offX + 6, offY + roomD * scale - 6);
}

function exportSeatingCSV() {
    if (!state.lastLayout || !state.lastLayout.length) return;

    const totalCovers = state.lastLayout.reduce((sum, p) => sum + p.covers, 0);
    const rows = ['Nevawood Space Layout Report'];

    if (state.lastLayoutMode === 'venue') {
        const venueStyle = document.getElementById('venueStyle').value;
        rows.push('Venue Style,Room Width (m),Room Depth (m),Total Units,Est. Covers');
        rows.push(`${venueStyle},${(state.lastRoomW / 1000).toFixed(1)},${(state.lastRoomD / 1000).toFixed(1)},${state.lastLayout.length},${totalCovers}`);
        rows.push('');
        rows.push('Unit,Type,Details,Est. Covers');
        state.lastLayout.forEach((p, i) => {
            rows.push(`${i + 1},${p.label},${p.displaySize},${p.covers}`);
        });
    } else {
        rows.push('Room Width (m),Room Depth (m),Total Units,Est. Covers');
        rows.push(`${(state.lastRoomW / 1000).toFixed(1)},${(state.lastRoomD / 1000).toFixed(1)},${state.lastLayout.length},${totalCovers}`);
        rows.push('');
        rows.push('Unit,Product,Size,X (mm),Y (mm),Est. Covers');
        state.lastLayout.forEach((p, i) => {
            const x = p.isRound ? Math.round(p.cx) : Math.round(p.x);
            const y = p.isRound ? Math.round(p.cy) : Math.round(p.y);
            rows.push(`${i + 1},${p.label},${p.displaySize},${x},${y},${p.covers}`);
        });
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    a.download = 'nevawood-space-layout.csv';
    a.click();
}

function saveSeatingImage() {
    const canvas = document.getElementById('seatingCanvas');
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'space-layout.png';
    a.click();
}

Object.assign(window, {
    onModeChange,
    onProductTypeChange,
    addProduct,
    removeProduct,
    clearProducts,
    runLayout,
    exportSeatingCSV,
    saveSeatingImage,
});

// Populate the default product size dropdown once the module loads.
populateSizes('picnic');
