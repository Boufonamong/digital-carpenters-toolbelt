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

// ---- Procedural wood-grain texture ------------------------------------
// Generated once in a canvas.  Kept as a monochrome (white base + dark
// grain) so the MeshStandardMaterial's colour tints it to the selected
// wood finish.

let WOOD_TEXTURE = null;

// Background gradient rendered into a small canvas + used as scene bg.
function makeBackground() {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#e6ecf1');   // sky-ish top
    grad.addColorStop(0.65, '#d3d9e0');
    grad.addColorStop(1, '#b8bfc7');   // floor-ish bottom
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 512);
    return new THREE.CanvasTexture(canvas);
}

function getWoodTexture() {
    if (WOOD_TEXTURE) return WOOD_TEXTURE;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Base --- solid white, tinted by the material colour later.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Horizontal grain lines --- wavy so they don't look like ruled paper.
    for (let i = 0; i < 90; i++) {
        const yBase = Math.random() * size;
        const thickness = 0.3 + Math.random() * 1.8;
        const alpha = 0.05 + Math.random() * 0.14;
        ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
        ctx.lineWidth = thickness;
        ctx.beginPath();
        const wobble = 3 + Math.random() * 6;
        for (let x = 0; x <= size; x += 8) {
            const y = yBase + Math.sin((x / size) * Math.PI * (2 + Math.random() * 2)) * wobble;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Occasional darker knots for character.
    for (let i = 0; i < 4; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 4 + Math.random() * 7;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, 'rgba(0,0,0,0.28)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // Pore noise --- tiny dots for wood pore texture.
    for (let i = 0; i < 1500; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.09})`;
        ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
    }

    WOOD_TEXTURE = new THREE.CanvasTexture(canvas);
    WOOD_TEXTURE.wrapS = WOOD_TEXTURE.wrapT = THREE.RepeatWrapping;
    WOOD_TEXTURE.anisotropy = 8;
    return WOOD_TEXTURE;
}

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
    state.scene.background = makeBackground();

    state.camera = new THREE.PerspectiveCamera(45, vw / vh, 1, 60000);
    state.camera.position.set(2200, 1300, 2600);

    state.renderer = new THREE.WebGLRenderer({ antialias: true });
    state.renderer.setPixelRatio(window.devicePixelRatio);
    state.renderer.setSize(vw, vh);
    state.renderer.shadowMap.enabled = true;
    state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(state.renderer.domElement);

    state.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(2000, 3000, 1500);
    sun.castShadow = true;
    // Widen the shadow frustum so it covers the whole bench + ground plane.
    sun.shadow.camera.left = -5000;
    sun.shadow.camera.right = 5000;
    sun.shadow.camera.top = 5000;
    sun.shadow.camera.bottom = -5000;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 12000;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    state.scene.add(sun);

    // Shadow-catching ground plane replaces the wireframe grid.
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(20000, 20000),
        new THREE.ShadowMaterial({ opacity: 0.22 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    state.scene.add(ground);

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
    const mat = new THREE.MeshStandardMaterial({
        color: colour,
        map: getWoodTexture(),
        roughness: 0.72,
        metalness: 0.02,
    });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.22 });

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
