// 3D Furniture Visualiser – Nevawood Bench Products
// Anton Morris – Nevawood Joinery

var scene, camera, renderer, controls;
var furnitureGroup = null;

var WOOD_COLOURS = {
    oak:    0xc8a96e,
    pine:   0xd4a96a,
    walnut: 0x7b5230,
    white:  0xf0ede8,
    dark:   0x2e2319
};

var BENCH_SIZES = [1000,1200,2000,2400,3000,3600,4800,5000,5600,6000];

function initViewer() {
    var container = document.getElementById('viewer');
    var vw = container.clientWidth;
    var vh = container.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f2f5);

    camera = new THREE.PerspectiveCamera(45, vw / vh, 1, 60000);
    camera.position.set(2200, 1300, 2600);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(vw, vh);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    var sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(2000, 3000, 1500);
    sun.castShadow = true;
    scene.add(sun);

    scene.add(new THREE.GridHelper(8000, 32, 0xbbbbbb, 0xdddddd));

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 380, 0);
    controls.update();

    window.addEventListener('resize', onResize);
    animate();

    populateSizes('picnic');
    buildModel();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function onResize() {
    var container = document.getElementById('viewer');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function onTypeChange() {
    var type = document.getElementById('productType').value;
    var isRound = type === 'roundbench';
    document.getElementById('sizeGroup').style.display = isRound ? 'none' : 'block';
    document.getElementById('radiusGroup').style.display = isRound ? 'block' : 'none';
    if (!isRound) populateSizes(type);
}

function populateSizes(type) {
    var select = document.getElementById('productSize');
    select.innerHTML = '';
    BENCH_SIZES.forEach(function(s) {
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = (s / 1000).toFixed(1) + 'm';
        select.appendChild(opt);
    });
    select.value = 2000;
}

function buildModel() {
    if (furnitureGroup) {
        scene.remove(furnitureGroup);
        furnitureGroup.traverse(function(obj) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }

    var type = document.getElementById('productType').value;
    var colKey = document.getElementById('woodColour').value;
    var colour = WOOD_COLOURS[colKey] || WOOD_COLOURS.oak;
    var mat = new THREE.MeshLambertMaterial({ color: colour });
    var edgeMat = new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.25 });

    furnitureGroup = new THREE.Group();

    if (type === 'roundbench') {
        var radius = parseInt(document.getElementById('productRadius').value) || 1000;
        buildRoundBench(radius, mat, edgeMat);
        document.getElementById('modelLabel').textContent = 'Round Bench – ' + (radius / 1000).toFixed(0) + 'm radius';
        camera.position.set(radius * 2.6, radius * 1.4, radius * 2.6);
        controls.target.set(0, 400, 0);
    } else {
        var len = parseInt(document.getElementById('productSize').value) || 2000;
        if (type === 'crossbench') {
            buildCrossBench(len, mat, edgeMat);
            document.getElementById('modelLabel').textContent = 'Criss-Cross Bench – ' + (len / 1000).toFixed(1) + 'm';
        } else {
            buildPicnicBench(len, mat, edgeMat);
            document.getElementById('modelLabel').textContent = 'Pub / Picnic Bench – ' + (len / 1000).toFixed(1) + 'm';
        }
        camera.position.set(len * 0.85, 1200, 2000);
        controls.target.set(0, 380, 0);
    }

    scene.add(furnitureGroup);
    controls.update();
}

// adds a box mesh centred at (x, y, z) with optional edge lines
function addBox(x, y, z, w, h, d, mat, edgeMat) {
    var geo = new THREE.BoxGeometry(w, h, d);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    furnitureGroup.add(mesh);

    if (edgeMat) {
        var edges = new THREE.EdgesGeometry(geo);
        var lines = new THREE.LineSegments(edges, edgeMat);
        lines.position.set(x, y, z);
        furnitureGroup.add(lines);
    }
}

// rotated box for the criss-cross diagonal legs
function addRotatedBox(x, y, z, w, h, d, rx, ry, rz, mat) {
    var geo = new THREE.BoxGeometry(w, h, d);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    furnitureGroup.add(mesh);

    var edgeMesh = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.2 })
    );
    mesh.add(edgeMesh);
}

// Pub / Picnic Bench – table in the middle, bench seats either side
function buildPicnicBench(len, mat, edgeMat) {
    var tableH = 750, tableT = 44, tableD = 560;
    var seatH = 460, seatT = 44, seatD = 320;
    var gap = 70;
    var legW = 70;

    var seatZ = tableD / 2 + gap + seatD / 2;

    // table top
    addBox(0, tableH - tableT / 2, 0, len, tableT, tableD, mat, edgeMat);

    // bench seats
    addBox(0, seatH - seatT / 2, -seatZ, len, seatT, seatD, mat, edgeMat);
    addBox(0, seatH - seatT / 2, +seatZ, len, seatT, seatD, mat, edgeMat);

    // trestle frames at both ends
    var inset = Math.min(160, len * 0.14);
    [-len / 2 + inset, len / 2 - inset].forEach(function(lx) {
        addBox(lx, (tableH - tableT) / 2, -tableD / 4, legW, tableH - tableT, legW, mat, edgeMat);
        addBox(lx, (tableH - tableT) / 2, +tableD / 4, legW, tableH - tableT, legW, mat, edgeMat);
        addBox(lx, (tableH - tableT) * 0.32, 0, legW, legW, tableD * 0.55, mat, edgeMat);
        addBox(lx, (seatH - seatT) / 2, -seatZ, legW, seatH - seatT, legW, mat, edgeMat);
        addBox(lx, (seatH - seatT) / 2, +seatZ, legW, seatH - seatT, legW, mat, edgeMat);
    });

    // foot rails
    var railLen = len - inset * 2;
    addBox(0, legW / 2, -seatZ, railLen, legW, legW, mat, edgeMat);
    addBox(0, legW / 2, +seatZ, railLen, legW, legW, mat, edgeMat);
}

// Criss-Cross Bench – single seat with X-shaped leg frames
function buildCrossBench(len, mat, edgeMat) {
    var seatH = 600, seatT = 44, seatD = 300;
    var legW = 50;
    var inset = Math.min(140, len * 0.12);

    addBox(0, seatH - seatT / 2, 0, len, seatT, seatD, mat, edgeMat);

    var frameH = seatH - seatT;
    var halfD = seatD / 2;
    var diagLen = Math.sqrt(frameH * frameH + (halfD * 2) * (halfD * 2));
    var tilt = Math.atan2(halfD * 2, frameH);

    [-len / 2 + inset, len / 2 - inset].forEach(function(lx) {
        addRotatedBox(lx, frameH / 2, 0, legW, diagLen, legW,  tilt, 0, 0, mat);
        addRotatedBox(lx, frameH / 2, 0, legW, diagLen, legW, -tilt, 0, 0, mat);
    });

    addBox(0, legW / 2, 0, len - inset, legW, legW, mat, edgeMat);
}

// Round Bench – ring seat with central table
function buildRoundBench(radius, mat, edgeMat) {
    var seatH = 450, seatT = 44;
    var innerR = radius * 0.68;
    var midR = (radius + innerR) / 2;
    var seatWidth = radius - innerR;
    var N = 36;

    for (var i = 0; i < N; i++) {
        var angle = (i / N) * Math.PI * 2;
        var cx = Math.cos(angle) * midR;
        var cz = Math.sin(angle) * midR;
        var segLen = 2 * Math.PI * midR / N * 1.05;

        var geo = new THREE.BoxGeometry(segLen, seatT, seatWidth);
        var mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(cx, seatH - seatT / 2, cz);
        mesh.rotation.y = -angle;
        mesh.castShadow = true;
        furnitureGroup.add(mesh);

        if (i % 4 === 0) {
            var edgeMesh = new THREE.LineSegments(
                new THREE.EdgesGeometry(geo),
                new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.18 })
            );
            mesh.add(edgeMesh);
        }
    }

    // support posts under the seat ring
    var numPosts = Math.max(4, Math.round(2 * Math.PI * radius / 700));
    var postH = seatH - seatT;
    for (var j = 0; j < numPosts; j++) {
        var a = (j / numPosts) * Math.PI * 2;
        addBox(Math.cos(a) * midR, postH / 2, Math.sin(a) * midR, 80, postH, 80, mat, edgeMat);
    }

    // central post and table top
    var tableH = 638, tableTopT = 44;
    var tableTopR = radius * 0.77;

    addBox(0, tableH / 2, 0, 120, tableH, 120, mat, edgeMat);

    var tableGeo = new THREE.CylinderGeometry(tableTopR, tableTopR, tableTopT, 40);
    var tableMesh = new THREE.Mesh(tableGeo, mat);
    tableMesh.position.set(0, tableH - tableTopT / 2, 0);
    tableMesh.castShadow = true;
    furnitureGroup.add(tableMesh);
    tableMesh.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(tableGeo),
        new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.2 })
    ));
}

function exportGLTF() {
    if (!furnitureGroup) { alert('Generate a model first.'); return; }

    var type = document.getElementById('productType').value;
    var exporter = new THREE.GLTFExporter();
    exporter.parse(furnitureGroup, function(gltf) {
        var blob = new Blob([JSON.stringify(gltf)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'nevawood-' + type + '.gltf';
        a.click();
    });
}

window.addEventListener('load', initViewer);
