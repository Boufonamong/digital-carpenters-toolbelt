// 3D Furniture Visualiser --- Nevawood bench product catalogue.
//
// Three.js is loaded globally via CDN in 3d-visualiser.html (there is no
// npm-side dependency for the browser build). Procedural geometry
// generators here consume dimensions + wood colour and emit box-primitive
// scene graphs which are exported as GLTF for the downstream Blender
// rendering pipeline.
//
// The bench-parts.js module is the authoritative source of truth for the
// component list.  This file uses it to populate the parts panel and the
// cut-list hand-off; the mesh generators below use the same numbers.

import { benchParts, partsToPieces } from './algorithms/bench-parts.js';

const WOOD_COLOURS = {
    oak:    0xc8a96e,
    pine:   0xd4a96a,
    walnut: 0x7b5230,
    white:  0xf0ede8,
    dark:   0x2e2319,
};

const BENCH_SIZES = [1000, 1200, 2000, 2400, 3000, 3600, 4800, 5000, 5600, 6000];

// Key used to hand off a cut list to the sheet optimiser via localStorage.
const HANDOFF_KEY = 'dc-sheet-handoff';

const state = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    furnitureGroup: null,
    currentParts: null, // { parts, meta } from bench-parts
};

function initViewer() {
    const container = document.getElementById('viewer');
    const vw = container.clientWidth;
    const vh = container.clientHeight;

    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0xf0f2f5);

    state.camera = new THREE.PerspectiveCamera(45, vw / vh, 1, 60000);
    state.camera.position.set(2200, 1300, 2600);

    state.renderer = new THREE.WebGLRenderer({ antialias: true });
    state.renderer.setPixelRatio(window.devicePixelRatio);
    state.renderer.setSize(vw, vh);
    state.renderer.shadowMap.enabled = true;
    container.appendChild(state.renderer.domElement);

    state.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(2000, 3000, 1500);
    sun.castShadow = true;
    state.scene.add(sun);

    state.scene.add(new THREE.GridHelper(8000, 32, 0xbbbbbb, 0xdddddd));

    state.controls = new THREE.OrbitControls(state.camera, state.renderer.domElement);
    state.controls.enableDamping = true;
    state.controls.dampingFactor = 0.08;
    state.controls.target.set(0, 380, 0);
    state.controls.update();

    window.addEventListener('resize', onResize);
    animate();

    populateSizes('picnic');
    buildModel();
}

function animate() {
    requestAnimationFrame(animate);
    state.controls.update();
    state.renderer.render(state.scene, state.camera);
}

function onResize() {
    const container = document.getElementById('viewer');
    state.camera.aspect = container.clientWidth / container.clientHeight;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(container.clientWidth, container.clientHeight);
}

function onTypeChange() {
    const type = document.getElementById('productType').value;
    const isRound = type === 'roundbench';
    document.getElementById('sizeGroup').style.display = isRound ? 'none' : 'block';
    document.getElementById('radiusGroup').style.display = isRound ? 'block' : 'none';
    if (!isRound) populateSizes(type);
}

function populateSizes() {
    const select = document.getElementById('productSize');
    select.innerHTML = '';
    for (const s of BENCH_SIZES) {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = `${(s / 1000).toFixed(1)}m`;
        select.appendChild(opt);
    }
    select.value = 2000;
}

function buildModel() {
    if (state.furnitureGroup) {
        state.scene.remove(state.furnitureGroup);
        state.furnitureGroup.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }

    const type = document.getElementById('productType').value;
    const colKey = document.getElementById('woodColour').value;
    const colour = WOOD_COLOURS[colKey] || WOOD_COLOURS.oak;
    const mat = new THREE.MeshLambertMaterial({ color: colour });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.25 });

    state.furnitureGroup = new THREE.Group();

    // Compute size input.
    const size = (type === 'roundbench')
        ? (parseInt(document.getElementById('productRadius').value, 10) || 1000)
        : (parseInt(document.getElementById('productSize').value, 10) || 2000);

    // Update the parts model --- this is what feeds the parts panel and hand-off.
    state.currentParts = benchParts(type, size);

    // Build the 3D geometry.
    if (type === 'roundbench') {
        buildRoundBench(size, mat, edgeMat);
        state.camera.position.set(size * 2.6, size * 1.4, size * 2.6);
        state.controls.target.set(0, 400, 0);
    } else if (type === 'crossbench') {
        buildCrossBench(size, mat, edgeMat);
        state.camera.position.set(size * 0.85, 1200, 2000);
        state.controls.target.set(0, 380, 0);
    } else {
        buildPicnicBench(size, mat, edgeMat);
        state.camera.position.set(size * 0.85, 1200, 2000);
        state.controls.target.set(0, 380, 0);
    }

    document.getElementById('modelLabel').textContent = state.currentParts.meta.label;

    state.scene.add(state.furnitureGroup);
    state.controls.update();

    renderPartsPanel();
}

// Adds a box mesh centred at (x, y, z) with optional edge overlay.
function addBox(x, y, z, w, h, d, mat, edgeMat) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    state.furnitureGroup.add(mesh);

    if (edgeMat) {
        const edges = new THREE.EdgesGeometry(geo);
        const lines = new THREE.LineSegments(edges, edgeMat);
        lines.position.set(x, y, z);
        state.furnitureGroup.add(lines);
    }
}

// Rotated box for the criss-cross diagonal leg frames.
function addRotatedBox(x, y, z, w, h, d, rx, ry, rz, mat) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    state.furnitureGroup.add(mesh);

    const edgeMesh = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.2 }),
    );
    mesh.add(edgeMesh);
}

// Pub / picnic bench: table top + two bench seats + trestle frames + rails.
function buildPicnicBench(len, mat, edgeMat) {
    const tableH = 750, tableT = 44, tableD = 560;
    const seatH = 460, seatT = 44, seatD = 320;
    const gap = 70;
    const legW = 70;

    const seatZ = tableD / 2 + gap + seatD / 2;

    addBox(0, tableH - tableT / 2, 0, len, tableT, tableD, mat, edgeMat);
    addBox(0, seatH - seatT / 2, -seatZ, len, seatT, seatD, mat, edgeMat);
    addBox(0, seatH - seatT / 2,  seatZ, len, seatT, seatD, mat, edgeMat);

    const inset = Math.min(160, len * 0.14);
    for (const lx of [-len / 2 + inset, len / 2 - inset]) {
        addBox(lx, (tableH - tableT) / 2, -tableD / 4, legW, tableH - tableT, legW, mat, edgeMat);
        addBox(lx, (tableH - tableT) / 2,  tableD / 4, legW, tableH - tableT, legW, mat, edgeMat);
        addBox(lx, (tableH - tableT) * 0.32, 0, legW, legW, tableD * 0.55, mat, edgeMat);
        addBox(lx, (seatH - seatT) / 2, -seatZ, legW, seatH - seatT, legW, mat, edgeMat);
        addBox(lx, (seatH - seatT) / 2,  seatZ, legW, seatH - seatT, legW, mat, edgeMat);
    }

    const railLen = len - inset * 2;
    addBox(0, legW / 2, -seatZ, railLen, legW, legW, mat, edgeMat);
    addBox(0, legW / 2,  seatZ, railLen, legW, legW, mat, edgeMat);
}

// Criss-cross bench: seat plank with X-frame legs at each end.
function buildCrossBench(len, mat, edgeMat) {
    const seatH = 600, seatT = 44, seatD = 300;
    const legW = 50;
    const inset = Math.min(140, len * 0.12);

    addBox(0, seatH - seatT / 2, 0, len, seatT, seatD, mat, edgeMat);

    const frameH = seatH - seatT;
    const halfD = seatD / 2;
    const diagLen = Math.hypot(frameH, halfD * 2);
    const tilt = Math.atan2(halfD * 2, frameH);

    for (const lx of [-len / 2 + inset, len / 2 - inset]) {
        addRotatedBox(lx, frameH / 2, 0, legW, diagLen, legW,  tilt, 0, 0, mat);
        addRotatedBox(lx, frameH / 2, 0, legW, diagLen, legW, -tilt, 0, 0, mat);
    }

    addBox(0, legW / 2, 0, len - inset, legW, legW, mat, edgeMat);
}

// Round bench: seat ring assembled from arc segments, central table.
function buildRoundBench(radius, mat, edgeMat) {
    const seatH = 450, seatT = 44;
    const innerR = radius * 0.68;
    const midR = (radius + innerR) / 2;
    const seatWidth = radius - innerR;
    const N = 36;

    for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2;
        const cx = Math.cos(angle) * midR;
        const cz = Math.sin(angle) * midR;
        const segLen = 2 * Math.PI * midR / N * 1.05;

        const geo = new THREE.BoxGeometry(segLen, seatT, seatWidth);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(cx, seatH - seatT / 2, cz);
        mesh.rotation.y = -angle;
        mesh.castShadow = true;
        state.furnitureGroup.add(mesh);

        if (i % 4 === 0) {
            const edgeMesh = new THREE.LineSegments(
                new THREE.EdgesGeometry(geo),
                new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.18 }),
            );
            mesh.add(edgeMesh);
        }
    }

    const numPosts = Math.max(4, Math.round(2 * Math.PI * radius / 700));
    const postH = seatH - seatT;
    for (let j = 0; j < numPosts; j++) {
        const a = (j / numPosts) * Math.PI * 2;
        addBox(Math.cos(a) * midR, postH / 2, Math.sin(a) * midR, 80, postH, 80, mat, edgeMat);
    }

    const tableH = 638, tableTopT = 44;
    const tableTopR = radius * 0.77;

    addBox(0, tableH / 2, 0, 120, tableH, 120, mat, edgeMat);

    const tableGeo = new THREE.CylinderGeometry(tableTopR, tableTopR, tableTopT, 40);
    const tableMesh = new THREE.Mesh(tableGeo, mat);
    tableMesh.position.set(0, tableH - tableTopT / 2, 0);
    tableMesh.castShadow = true;
    state.furnitureGroup.add(tableMesh);
    tableMesh.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(tableGeo),
        new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.2 }),
    ));
}

// ---- Parts panel + cut-list hand-off --------------------------------

function renderPartsPanel() {
    const panel = document.getElementById('partsPanel');
    if (!panel || !state.currentParts) return;

    const { parts } = state.currentParts;
    const sheetCount = parts.filter(p => p.stockType === 'sheet').reduce((s, p) => s + p.qty, 0);
    const timberCount = parts.filter(p => p.stockType === 'timber').reduce((s, p) => s + p.qty, 0);

    const rows = parts.map(p => `
        <tr>
            <td>
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.colour || '#999'};margin-right:6px"></span>
                ${p.name}
            </td>
            <td style="text-align:center">${p.stockType}</td>
            <td style="text-align:right">${p.w} × ${p.h}${p.stockType === 'timber' ? '' : ` × ${p.d}mm`}</td>
            <td style="text-align:center">${p.qty}</td>
        </tr>
    `).join('');

    panel.innerHTML = `
        <div class="parts-summary">
            <span><strong>${sheetCount}</strong> sheet parts</span>
            <span><strong>${timberCount}</strong> timber sections</span>
        </div>
        <table class="parts-table">
            <thead>
                <tr>
                    <th style="text-align:left">Component</th>
                    <th>Stock</th>
                    <th style="text-align:right">Dimensions (mm)</th>
                    <th>Qty</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="parts-actions">
            <button class="btn btn-secondary" onclick="exportPartsCSV()">&#8595; Parts CSV</button>
            <button class="btn btn-primary" style="width:auto;padding:9px 16px;margin-top:0" onclick="sendToSheetOptimiser()">
                Send sheet parts to Sheet Optimiser &rarr;
            </button>
        </div>
    `;
}

function exportPartsCSV() {
    if (!state.currentParts) return;
    const { parts, meta } = state.currentParts;

    const rows = [
        'Nevawood Bench Parts List',
        `Product,${meta.label}`,
        '',
        'Component,Stock Type,Width (mm),Height / Length (mm),Depth (mm),Qty',
    ];
    for (const p of parts) {
        rows.push(`${p.name},${p.stockType},${p.w},${p.h},${p.d},${p.qty}`);
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    a.download = `nevawood-${meta.type}-${meta.size}-parts.csv`;
    a.click();
}

function sendToSheetOptimiser() {
    if (!state.currentParts) return;

    const pieces = partsToPieces(state.currentParts, { includeTimber: false });
    if (pieces.length === 0) {
        alert('This bench has no sheet parts to send.');
        return;
    }

    const payload = {
        source: `3D Visualiser --- ${state.currentParts.meta.label}`,
        timestamp: new Date().toISOString(),
        pieces,
    };
    localStorage.setItem(HANDOFF_KEY, JSON.stringify(payload));

    window.location.href = 'sheet-optimiser.html?handoff=1';
}

function exportGLTF() {
    if (!state.furnitureGroup) {
        alert('Generate a model first.');
        return;
    }

    const type = document.getElementById('productType').value;
    const exporter = new THREE.GLTFExporter();
    exporter.parse(state.furnitureGroup, gltf => {
        const blob = new Blob([JSON.stringify(gltf)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `nevawood-${type}.gltf`;
        a.click();
    });
}

window.addEventListener('load', initViewer);

Object.assign(window, {
    onTypeChange,
    buildModel,
    exportGLTF,
    exportPartsCSV,
    sendToSheetOptimiser,
});
