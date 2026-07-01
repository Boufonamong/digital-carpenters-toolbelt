// Workshop Layout Optimiser --- Nevawood Joinery
//
// Greedy-flavoured placement across three workflow patterns:
//   - assembly line : sequential left-to-right placement
//   - job shop      : central workbench, perimeter for the rest
//   - cellular      : grouped by zone (cutting / assembly / finishing)

// Standard machine presets (footprint in mm, clearance in mm).
const PRESETS = {
    tablesaw:   { name: 'Table Saw',          w: 2000, d: 1500, clear: 2500 },
    mitre:      { name: 'Mitre Saw',          w: 1500, d: 800,  clear: 3000 },
    bandsaw:    { name: 'Bandsaw',            w: 1000, d: 1000, clear: 1500 },
    planer:     { name: 'Planer/Thicknesser', w: 1500, d: 800,  clear: 2000 },
    bench:      { name: 'Workbench',          w: 2000, d: 800,  clear: 1500 },
    assembly:   { name: 'Assembly Table',     w: 3000, d: 1500, clear: 1000 },
    storage:    { name: 'Sheet Storage Rack', w: 2500, d: 600,  clear: 1500 },
    dust:       { name: 'Dust Extractor',     w: 800,  d: 800,  clear: 500  },
    drillpress: { name: 'Drill Press',        w: 600,  d: 600,  clear: 1000 },
    finishing:  { name: 'Finishing Area',     w: 2000, d: 1500, clear: 1000 },
};

const ZONE_COLOURS = {
    cutting:   '#a8d8ea',
    assembly:  '#b5ead7',
    finishing: '#ffdac1',
    storage:   '#e2f0cb',
    default:   '#c3b1e1',
};

const state = {
    machines: [],
    lastPlaced: [],
    lastShopW: 0,
    lastShopD: 0,
    lastWorkflow: '',
};

// ---- UI helpers ----

function loadPreset() {
    const type = document.getElementById('machinePreset').value;
    if (type === 'custom') {
        document.getElementById('machineName').value = '';
        document.getElementById('machineW').value = '';
        document.getElementById('machineD').value = '';
        document.getElementById('machineClear').value = '1000';
        return;
    }
    const p = PRESETS[type];
    document.getElementById('machineName').value = p.name;
    document.getElementById('machineW').value = p.w;
    document.getElementById('machineD').value = p.d;
    document.getElementById('machineClear').value = p.clear;
}

function addMachine() {
    const name = document.getElementById('machineName').value.trim();
    const w = parseFloat(document.getElementById('machineW').value);
    const d = parseFloat(document.getElementById('machineD').value);
    const clear = parseFloat(document.getElementById('machineClear').value) || 1000;
    const type = document.getElementById('machinePreset').value;

    if (!name || !w || !d) {
        alert('Please fill in the machine name and dimensions.');
        return;
    }

    state.machines.push({ name, w, d, clear, type });
    renderMachineList();
}

function removeMachine(i) {
    state.machines.splice(i, 1);
    renderMachineList();
}

function clearMachines() {
    state.machines = [];
    renderMachineList();
    document.getElementById('results').style.display = 'none';
    document.getElementById('emptyResults').style.display = 'block';
}

function renderMachineList() {
    const list = document.getElementById('machineList');
    if (state.machines.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No machines added yet</p></div>';
        return;
    }
    const html = state.machines.map((m, i) => `
        <div class="tool-item">
            <span style="font-weight:500;flex:1">${m.name}</span>
            <span style="color:#7f8c8d;font-size:0.8rem;margin-right:8px">${m.w}&times;${m.d}</span>
            <button class="btn-danger" onclick="removeMachine(${i})">&#10005;</button>
        </div>
    `).join('');
    list.innerHTML = html;
}

// ---- Main layout algorithm ----

function runWorkshopLayout() {
    if (state.machines.length === 0) {
        alert('Add at least one machine first.');
        return;
    }

    const shopW = parseFloat(document.getElementById('shopW').value) * 1000;
    const shopD = parseFloat(document.getElementById('shopD').value) * 1000;
    const workflow = document.getElementById('workflow').value;

    let placed = [];
    if (workflow === 'assembly') placed = layoutAssemblyLine(state.machines, shopW, shopD);
    else if (workflow === 'jobshop') placed = layoutJobShop(state.machines, shopW, shopD);
    else if (workflow === 'cellular') placed = layoutCellular(state.machines, shopW, shopD);

    const flowScore = calcFlowScore(placed);

    showWorkshopResults(placed, state.machines.length, shopW, shopD, workflow, flowScore);
}

// Assembly line: machines left-to-right in sequence, row wrap on width overrun.
function layoutAssemblyLine(machines, shopW, shopD) {
    const placed = [];
    let curX = 800;
    let rowY = shopD / 2 - 1000;

    for (const m of machines) {
        const totalW = m.w + m.clear;
        const totalD = m.d + m.clear;

        if (curX + totalW > shopW - 800) {
            curX = 800;
            rowY += totalD + 500;
        }

        placed.push({
            name: m.name,
            x: curX + m.clear / 2,
            y: rowY,
            w: m.w, d: m.d, clear: m.clear,
            type: m.type,
            zone: getZone(m.type),
        });

        curX += totalW + 300;
    }

    return placed;
}

// Job shop: workbench (or assembly table) in the centre, everything else around it.
function layoutJobShop(machines, shopW, shopD) {
    const placed = [];
    const centreX = shopW / 2;
    const centreY = shopD / 2;

    const benchIdx = machines.findIndex(m => m.type === 'bench' || m.type === 'assembly');

    if (benchIdx >= 0) {
        const bench = machines[benchIdx];
        placed.push({
            name: bench.name,
            x: centreX - bench.w / 2, y: centreY - bench.d / 2,
            w: bench.w, d: bench.d, clear: bench.clear,
            type: bench.type, zone: 'assembly',
        });
    }

    const perimeterPositions = buildPerimeter(shopW, shopD, 800);
    let posIdx = 0;

    machines.forEach((m, i) => {
        if (i === benchIdx) return;
        if (posIdx >= perimeterPositions.length) return;

        const pos = perimeterPositions[posIdx];
        placed.push({
            name: m.name,
            x: pos.x, y: pos.y,
            w: m.w, d: m.d, clear: m.clear,
            type: m.type, zone: getZone(m.type),
        });
        posIdx++;
    });

    return placed;
}

// Cellular: group by cutting / assembly / finishing zones across three horizontal bands.
function layoutCellular(machines, shopW, shopD) {
    let placed = [];
    const zoneH = shopD / 3;

    const cuttingMachines  = machines.filter(m => getZone(m.type) === 'cutting');
    let   assemblyMachines = machines.filter(m => getZone(m.type) === 'assembly');
    const finishingMachines = machines.filter(m => getZone(m.type) === 'finishing');
    const otherMachines    = machines.filter(m => {
        const z = getZone(m.type);
        return z !== 'cutting' && z !== 'assembly' && z !== 'finishing';
    });

    assemblyMachines = assemblyMachines.concat(otherMachines);

    placed = placed.concat(placeInZone(cuttingMachines,   shopW, 0,         zoneH, 'cutting'));
    placed = placed.concat(placeInZone(assemblyMachines,  shopW, zoneH,     zoneH, 'assembly'));
    placed = placed.concat(placeInZone(finishingMachines, shopW, zoneH * 2, zoneH, 'finishing'));

    return placed;
}

function placeInZone(machineList, shopW, zoneY, zoneH, zoneName) {
    const placed = [];
    let curX = 600;
    let curY = zoneY + 400;

    for (const m of machineList) {
        if (curX + m.w + m.clear > shopW - 600) {
            curX = 600;
            curY += m.d + m.clear + 300;
        }

        if (curY + m.d > zoneY + zoneH) continue;

        placed.push({
            name: m.name,
            x: curX, y: curY,
            w: m.w, d: m.d, clear: m.clear,
            type: m.type, zone: zoneName,
        });

        curX += m.w + m.clear / 2 + 400;
    }

    return placed;
}

function buildPerimeter(shopW, shopD, gap) {
    const positions = [];
    const step = 2500;

    for (let x = gap; x < shopW - gap; x += step) positions.push({ x, y: gap });
    for (let x = gap; x < shopW - gap; x += step) positions.push({ x, y: shopD - gap - 1500 });
    for (let y = gap + 1500; y < shopD - gap - 1500; y += step) positions.push({ x: gap, y });
    for (let y = gap + 1500; y < shopD - gap - 1500; y += step) positions.push({ x: shopW - gap - 2000, y });

    return positions;
}

function getZone(type) {
    const cutting  = ['tablesaw', 'mitre', 'bandsaw', 'planer', 'drillpress'];
    const assembly = ['bench', 'assembly'];
    const finishing = ['finishing'];
    const storage  = ['storage', 'dust'];

    if (cutting.includes(type))   return 'cutting';
    if (assembly.includes(type))  return 'assembly';
    if (finishing.includes(type)) return 'finishing';
    if (storage.includes(type))   return 'storage';
    return 'default';
}

// Rough workflow score: shorter total centroid-to-centroid path = better.
function calcFlowScore(placed) {
    if (placed.length < 2) return 100;

    let totalDist = 0;
    for (let i = 0; i < placed.length - 1; i++) {
        const a = placed[i];
        const b = placed[i + 1];
        const cx1 = a.x + a.w / 2;
        const cy1 = a.y + a.d / 2;
        const cx2 = b.x + b.w / 2;
        const cy2 = b.y + b.d / 2;
        totalDist += Math.hypot(cx2 - cx1, cy2 - cy1);
    }

    return Math.max(0, Math.round(100 - (totalDist / 1000 / placed.length)));
}

// ---- Display ----

function showWorkshopResults(placed, total, shopW, shopD, workflow, flowScore) {
    state.lastPlaced = placed;
    state.lastShopW = shopW;
    state.lastShopD = shopD;
    state.lastWorkflow = workflow;

    document.getElementById('statMachines').textContent = total;
    document.getElementById('statPlaced').textContent = placed.length;
    document.getElementById('statFlow').textContent = `${flowScore}%`;

    const workflowNames = { assembly: 'Assembly Line', jobshop: 'Job Shop', cellular: 'Cellular' };
    document.getElementById('workshopLabel').textContent = `${workflowNames[workflow]} Layout`;
    document.getElementById('workshopInfo').textContent =
        `${placed.length} of ${total} machines placed – workflow efficiency score: ${flowScore}%`;

    drawWorkshop(placed, shopW, shopD, workflow);

    document.getElementById('emptyResults').style.display = 'none';
    document.getElementById('results').style.display = 'block';
}

function drawWorkshop(placed, shopW, shopD, workflow) {
    const canvas = document.getElementById('workshopCanvas');
    const ctx = canvas.getContext('2d');

    const canvasW = 700;
    const canvasH = 500;
    const scale = Math.min(canvasW / shopW, canvasH / shopD) * 0.92;
    const offX = (canvasW - shopW * scale) / 2;
    const offY = (canvasH - shopD * scale) / 2;

    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#f5f2ec';
    ctx.fillRect(offX, offY, shopW * scale, shopD * scale);
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 2;
    ctx.strokeRect(offX, offY, shopW * scale, shopD * scale);

    if (workflow === 'cellular') {
        const zoneH = shopD / 3;
        const zoneLabels = ['Cutting Zone', 'Assembly Zone', 'Finishing Zone'];
        const zoneColours = ['rgba(168,216,234,0.2)', 'rgba(181,234,215,0.2)', 'rgba(255,218,193,0.2)'];

        for (let z = 0; z < 3; z++) {
            ctx.fillStyle = zoneColours[z];
            ctx.fillRect(offX, offY + z * zoneH * scale, shopW * scale, zoneH * scale);
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 1;
            ctx.strokeRect(offX, offY + z * zoneH * scale, shopW * scale, zoneH * scale);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.font = '11px sans-serif';
            ctx.fillText(zoneLabels[z], offX + 8, offY + z * zoneH * scale + 16);
        }
    }

    for (const m of placed) {
        const mx = offX + m.x * scale;
        const my = offY + m.y * scale;
        const mw = m.w * scale;
        const md = m.d * scale;
        const cl = (m.clear / 4) * scale;

        ctx.fillStyle = 'rgba(200,200,200,0.3)';
        ctx.fillRect(mx - cl, my - cl, mw + cl * 2, md + cl * 2);

        const colour = ZONE_COLOURS[m.zone] || ZONE_COLOURS.default;
        ctx.fillStyle = colour;
        ctx.fillRect(mx, my, mw, md);

        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(mx, my, mw, md);

        if (mw > 20 && md > 10) {
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.font = '10px sans-serif';
            const label = m.name.length > 14 ? `${m.name.substring(0, 12)}…` : m.name;
            ctx.fillText(label, mx + 3, my + 13);
        }
    }

    if (workflow === 'assembly' && placed.length > 1) {
        ctx.strokeStyle = 'rgba(42,100,150,0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);

        for (let i = 0; i < placed.length - 1; i++) {
            const a = placed[i];
            const b = placed[i + 1];
            const ax = offX + (a.x + a.w / 2) * scale;
            const ay = offY + (a.y + a.d / 2) * scale;
            const bx = offX + (b.x + b.w / 2) * scale;
            const by = offY + (b.y + b.d / 2) * scale;

            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
        }

        ctx.setLineDash([]);
    }

    ctx.fillStyle = '#999';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${(shopW / 1000).toFixed(1)}m × ${(shopD / 1000).toFixed(1)}m`, offX + 6, offY + shopD * scale - 6);
}

// ---- Export ----

function exportWorkshopCSV() {
    if (!state.lastPlaced.length) return;

    const workflowNames = { assembly: 'Assembly Line', jobshop: 'Job Shop', cellular: 'Cellular' };
    const rows = [
        'Workshop Layout Report',
        'Workflow,Shop Width (m),Shop Depth (m),Machines Placed',
        `${workflowNames[state.lastWorkflow]},${(state.lastShopW / 1000).toFixed(1)},${(state.lastShopD / 1000).toFixed(1)},${state.lastPlaced.length}`,
        '',
        'Machine,Zone,X (mm),Y (mm),Width (mm),Depth (mm),Clearance (mm)',
    ];
    for (const m of state.lastPlaced) {
        rows.push(`${m.name},${m.zone},${Math.round(m.x)},${Math.round(m.y)},${m.w},${m.d},${m.clear}`);
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    a.download = 'workshop-layout.csv';
    a.click();
}

function saveWorkshopImage() {
    const canvas = document.getElementById('workshopCanvas');
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'workshop-layout.png';
    a.click();
}

Object.assign(window, {
    loadPreset,
    addMachine,
    removeMachine,
    clearMachines,
    runWorkshopLayout,
    exportWorkshopCSV,
    saveWorkshopImage,
});
