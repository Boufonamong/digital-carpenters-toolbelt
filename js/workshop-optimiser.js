// Workshop Layout Optimiser
// Greedy placement – positions machines based on workflow type
// Anton Morris – Nevawood Joinery

// standard machine presets (footprint in mm, clearance in mm)
var PRESETS = {
    tablesaw:  { name: 'Table Saw',            w: 2000, d: 1500, clear: 2500 },
    mitre:     { name: 'Mitre Saw',            w: 1500, d: 800,  clear: 3000 }, // long infeed/outfeed
    bandsaw:   { name: 'Bandsaw',              w: 1000, d: 1000, clear: 1500 },
    planer:    { name: 'Planer/Thicknesser',   w: 1500, d: 800,  clear: 2000 },
    bench:     { name: 'Workbench',            w: 2000, d: 800,  clear: 1500 },
    assembly:  { name: 'Assembly Table',       w: 3000, d: 1500, clear: 1000 },
    storage:   { name: 'Sheet Storage Rack',   w: 2500, d: 600,  clear: 1500 },
    dust:      { name: 'Dust Extractor',       w: 800,  d: 800,  clear: 500  },
    drillpress:{ name: 'Drill Press',          w: 600,  d: 600,  clear: 1000 },
    finishing: { name: 'Finishing Area',       w: 2000, d: 1500, clear: 1000 }
};

var machines = [];
var lastPlaced = [], lastShopW = 0, lastShopD = 0, lastWorkflow = '';

// colour by zone type (used for cellular layout)
var ZONE_COLOURS = {
    cutting:   '#a8d8ea',
    assembly:  '#b5ead7',
    finishing: '#ffdac1',
    storage:   '#e2f0cb',
    default:   '#c3b1e1'
};

function loadPreset() {
    var type = document.getElementById('machinePreset').value;
    if (type === 'custom') {
        document.getElementById('machineName').value = '';
        document.getElementById('machineW').value = '';
        document.getElementById('machineD').value = '';
        document.getElementById('machineClear').value = '1000';
        return;
    }
    var p = PRESETS[type];
    document.getElementById('machineName').value = p.name;
    document.getElementById('machineW').value = p.w;
    document.getElementById('machineD').value = p.d;
    document.getElementById('machineClear').value = p.clear;
}

function addMachine() {
    var name  = document.getElementById('machineName').value.trim();
    var w     = parseFloat(document.getElementById('machineW').value);
    var d     = parseFloat(document.getElementById('machineD').value);
    var clear = parseFloat(document.getElementById('machineClear').value) || 1000;
    var type  = document.getElementById('machinePreset').value;

    if (!name || !w || !d) {
        alert('Please fill in the machine name and dimensions.');
        return;
    }

    machines.push({ name: name, w: w, d: d, clear: clear, type: type });
    renderMachineList();
}

function removeMachine(i) {
    machines.splice(i, 1);
    renderMachineList();
}

function clearMachines() {
    machines = [];
    renderMachineList();
    document.getElementById('results').style.display = 'none';
    document.getElementById('emptyResults').style.display = 'block';
}

function renderMachineList() {
    var list = document.getElementById('machineList');
    if (machines.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No machines added yet</p></div>';
        return;
    }
    var html = '';
    machines.forEach(function(m, i) {
        html += '<div class="tool-item">';
        html += '<span style="font-weight:500;flex:1">' + m.name + '</span>';
        html += '<span style="color:#7f8c8d;font-size:0.8rem;margin-right:8px">' + m.w + '&times;' + m.d + '</span>';
        html += '<button class="btn-danger" onclick="removeMachine(' + i + ')">&#10005;</button>';
        html += '</div>';
    });
    list.innerHTML = html;
}

// ---- Main layout algorithm ----

function runWorkshopLayout() {
    if (machines.length === 0) {
        alert('Add at least one machine first.');
        return;
    }

    var shopW    = parseFloat(document.getElementById('shopW').value) * 1000;
    var shopD    = parseFloat(document.getElementById('shopD').value) * 1000;
    var workflow = document.getElementById('workflow').value;

    var placed = [];

    if (workflow === 'assembly') {
        placed = layoutAssemblyLine(machines, shopW, shopD);
    } else if (workflow === 'jobshop') {
        placed = layoutJobShop(machines, shopW, shopD);
    } else if (workflow === 'cellular') {
        placed = layoutCellular(machines, shopW, shopD);
    }

    var flowScore = calcFlowScore(placed, workflow);

    showWorkshopResults(placed, machines.length, shopW, shopD, workflow, flowScore);
}

// Assembly line – machines placed left to right in sequence
function layoutAssemblyLine(machines, shopW, shopD) {
    var placed = [];
    var curX   = 800; // gap from wall
    var rowY   = shopD / 2 - 1000; // roughly centred

    machines.forEach(function(m) {
        // footprint with clearance
        var totalW = m.w + m.clear;
        var totalD = m.d + m.clear;

        // if it goes off the right edge, start a new row
        if (curX + totalW > shopW - 800) {
            curX = 800;
            rowY += totalD + 500;
        }

        placed.push({
            name:  m.name,
            x:     curX + m.clear / 2,
            y:     rowY,
            w:     m.w,
            d:     m.d,
            clear: m.clear,
            type:  m.type,
            zone:  getZone(m.type)
        });

        curX += totalW + 300;
    });

    return placed;
}

// Job shop – workbench goes in the centre, everything else around it
function layoutJobShop(machines, shopW, shopD) {
    var placed = [];
    var centreX = shopW / 2;
    var centreY = shopD / 2;

    // find the workbench first – put it in the middle
    var benchIdx = machines.findIndex(function(m) { return m.type === 'bench' || m.type === 'assembly'; });

    if (benchIdx >= 0) {
        var bench = machines[benchIdx];
        placed.push({
            name: bench.name, x: centreX - bench.w / 2, y: centreY - bench.d / 2,
            w: bench.w, d: bench.d, clear: bench.clear, type: bench.type, zone: 'assembly'
        });
    }

    // everything else around the perimeter
    var perimeterPositions = buildPerimeter(shopW, shopD, 800);
    var posIdx = 0;

    machines.forEach(function(m, i) {
        if (i === benchIdx) return; // already placed
        if (posIdx >= perimeterPositions.length) return;

        var pos = perimeterPositions[posIdx];
        placed.push({
            name: m.name, x: pos.x, y: pos.y,
            w: m.w, d: m.d, clear: m.clear, type: m.type, zone: getZone(m.type)
        });
        posIdx++;
    });

    return placed;
}

// Cellular – group by cutting, assembly, finishing zones
function layoutCellular(machines, shopW, shopD) {
    var placed = [];

    // split the workshop into 3 horizontal zones
    var zoneH = shopD / 3;

    var cuttingMachines  = machines.filter(function(m) { return getZone(m.type) === 'cutting'; });
    var assemblyMachines = machines.filter(function(m) { return getZone(m.type) === 'assembly'; });
    var finishingMachines= machines.filter(function(m) { return getZone(m.type) === 'finishing'; });
    var otherMachines    = machines.filter(function(m) {
        var z = getZone(m.type);
        return z !== 'cutting' && z !== 'assembly' && z !== 'finishing';
    });

    // add other machines to the biggest zone
    assemblyMachines = assemblyMachines.concat(otherMachines);

    placed = placed.concat(placeInZone(cuttingMachines,   shopW, 0,         zoneH, 'cutting'));
    placed = placed.concat(placeInZone(assemblyMachines,  shopW, zoneH,     zoneH, 'assembly'));
    placed = placed.concat(placeInZone(finishingMachines, shopW, zoneH * 2, zoneH, 'finishing'));

    return placed;
}

function placeInZone(machineList, shopW, zoneY, zoneH, zoneName) {
    var placed = [];
    var curX   = 600;
    var curY   = zoneY + 400;

    machineList.forEach(function(m) {
        if (curX + m.w + m.clear > shopW - 600) {
            curX = 600;
            curY += m.d + m.clear + 300;
        }

        if (curY + m.d > zoneY + zoneH) return; // doesn't fit in zone

        placed.push({
            name: m.name, x: curX, y: curY,
            w: m.w, d: m.d, clear: m.clear, type: m.type, zone: zoneName
        });

        curX += m.w + m.clear / 2 + 400;
    });

    return placed;
}

// rough perimeter positions for job shop
function buildPerimeter(shopW, shopD, gap) {
    var positions = [];
    var step = 2500;

    // top wall
    for (var x = gap; x < shopW - gap; x += step) {
        positions.push({ x: x, y: gap });
    }
    // bottom wall
    for (var x = gap; x < shopW - gap; x += step) {
        positions.push({ x: x, y: shopD - gap - 1500 });
    }
    // left wall
    for (var y = gap + 1500; y < shopD - gap - 1500; y += step) {
        positions.push({ x: gap, y: y });
    }
    // right wall
    for (var y = gap + 1500; y < shopD - gap - 1500; y += step) {
        positions.push({ x: shopW - gap - 2000, y: y });
    }

    return positions;
}

function getZone(type) {
    var cutting  = ['tablesaw', 'mitre', 'bandsaw', 'planer', 'drillpress'];
    var assembly = ['bench', 'assembly'];
    var finishing= ['finishing'];
    var storage  = ['storage', 'dust'];

    if (cutting.indexOf(type) >= 0)   return 'cutting';
    if (assembly.indexOf(type) >= 0)  return 'assembly';
    if (finishing.indexOf(type) >= 0) return 'finishing';
    if (storage.indexOf(type) >= 0)   return 'storage';
    return 'default';
}

// simple workflow score – shorter total path = better
function calcFlowScore(placed, workflow) {
    if (placed.length < 2) return 100;

    var totalDist = 0;
    for (var i = 0; i < placed.length - 1; i++) {
        var a = placed[i];
        var b = placed[i + 1];
        var cx1 = a.x + a.w / 2;
        var cy1 = a.y + a.d / 2;
        var cx2 = b.x + b.w / 2;
        var cy2 = b.y + b.d / 2;
        totalDist += Math.sqrt(Math.pow(cx2 - cx1, 2) + Math.pow(cy2 - cy1, 2));
    }

    // normalise to a 0-100 score (rough – lower distance is better)
    var score = Math.max(0, Math.round(100 - (totalDist / 1000 / placed.length)));
    return score;
}

// ---- Display ----

function showWorkshopResults(placed, total, shopW, shopD, workflow, flowScore) {
    lastPlaced = placed;
    lastShopW = shopW;
    lastShopD = shopD;
    lastWorkflow = workflow;
    document.getElementById('statMachines').textContent = total;
    document.getElementById('statPlaced').textContent   = placed.length;
    document.getElementById('statFlow').textContent     = flowScore + '%';

    var workflowNames = { assembly: 'Assembly Line', jobshop: 'Job Shop', cellular: 'Cellular' };
    document.getElementById('workshopLabel').textContent = workflowNames[workflow] + ' Layout';
    document.getElementById('workshopInfo').textContent =
        placed.length + ' of ' + total + ' machines placed – workflow efficiency score: ' + flowScore + '%';

    drawWorkshop(placed, shopW, shopD, workflow);

    document.getElementById('emptyResults').style.display = 'none';
    document.getElementById('results').style.display = 'block';
}

function drawWorkshop(placed, shopW, shopD, workflow) {
    var canvas = document.getElementById('workshopCanvas');
    var ctx    = canvas.getContext('2d');

    var canvasW = 700;
    var canvasH = 500;
    var scale   = Math.min(canvasW / shopW, canvasH / shopD) * 0.92;
    var offX    = (canvasW - shopW * scale) / 2;
    var offY    = (canvasH - shopD * scale) / 2;

    ctx.clearRect(0, 0, canvasW, canvasH);

    // workshop floor
    ctx.fillStyle = '#f5f2ec';
    ctx.fillRect(offX, offY, shopW * scale, shopD * scale);
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 2;
    ctx.strokeRect(offX, offY, shopW * scale, shopD * scale);

    // zone boundaries for cellular
    if (workflow === 'cellular') {
        var zoneH = shopD / 3;
        var zoneLabels = ['Cutting Zone', 'Assembly Zone', 'Finishing Zone'];
        var zoneColours = ['rgba(168,216,234,0.2)', 'rgba(181,234,215,0.2)', 'rgba(255,218,193,0.2)'];

        for (var z = 0; z < 3; z++) {
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

    // draw each machine with clearance zone
    placed.forEach(function(m) {
        var mx = offX + m.x * scale;
        var my = offY + m.y * scale;
        var mw = m.w * scale;
        var md = m.d * scale;
        var cl = (m.clear / 4) * scale; // show partial clearance so it's readable

        // clearance zone
        ctx.fillStyle = 'rgba(200,200,200,0.3)';
        ctx.fillRect(mx - cl, my - cl, mw + cl * 2, md + cl * 2);

        // machine body
        var colour = ZONE_COLOURS[m.zone] || ZONE_COLOURS.default;
        ctx.fillStyle = colour;
        ctx.fillRect(mx, my, mw, md);

        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(mx, my, mw, md);

        // label
        if (mw > 20 && md > 10) {
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.font = '10px sans-serif';
            var label = m.name.length > 14 ? m.name.substring(0, 12) + '…' : m.name;
            ctx.fillText(label, mx + 3, my + 13);
        }
    });

    // workflow arrows for assembly line
    if (workflow === 'assembly' && placed.length > 1) {
        ctx.strokeStyle = 'rgba(42,100,150,0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);

        for (var i = 0; i < placed.length - 1; i++) {
            var a  = placed[i];
            var b  = placed[i + 1];
            var ax = offX + (a.x + a.w / 2) * scale;
            var ay = offY + (a.y + a.d / 2) * scale;
            var bx = offX + (b.x + b.w / 2) * scale;
            var by = offY + (b.y + b.d / 2) * scale;

            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
        }

        ctx.setLineDash([]);
    }

    // dimensions
    ctx.fillStyle = '#999';
    ctx.font = '11px sans-serif';
    ctx.fillText((shopW / 1000).toFixed(1) + 'm \u00d7 ' + (shopD / 1000).toFixed(1) + 'm', offX + 6, offY + shopD * scale - 6);
}

// ---- Export ----

function exportWorkshopCSV() {
    if (!lastPlaced.length) return;

    var workflowNames = { assembly: 'Assembly Line', jobshop: 'Job Shop', cellular: 'Cellular' };
    var rows = [
        'Workshop Layout Report',
        'Workflow,Shop Width (m),Shop Depth (m),Machines Placed',
        workflowNames[lastWorkflow] + ',' + (lastShopW/1000).toFixed(1) + ',' + (lastShopD/1000).toFixed(1) + ',' + lastPlaced.length,
        '',
        'Machine,Zone,X (mm),Y (mm),Width (mm),Depth (mm),Clearance (mm)'
    ];
    lastPlaced.forEach(function(m) {
        rows.push(m.name + ',' + m.zone + ',' + Math.round(m.x) + ',' + Math.round(m.y) + ',' + m.w + ',' + m.d + ',' + m.clear);
    });

    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    a.download = 'workshop-layout.csv';
    a.click();
}

function saveWorkshopImage() {
    var canvas = document.getElementById('workshopCanvas');
    var a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'workshop-layout.png';
    a.click();
}
