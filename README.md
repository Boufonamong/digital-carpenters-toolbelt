# Digital Carpenter's Toolbelt

Final-year project for CSF300 (BSc Applied Software Engineering, Swansea University).

Four browser-based calculation tools built for **Nevawood Joinery**, a bespoke
furniture and seating workshop in South-East Wales. Each tool goes after one of
the four things that get done by hand over and over at the workshop:

- **Sheet Material Optimiser** — packs a cut list onto standard-size plywood,
  MDF or veneer sheets using First Fit Decreasing with a guillotine split.
- **Space Planner** — lays out either Nevawood bench products or one of five
  venue styles (theatre, classroom, boardroom, church, pub) using parametric
  rules that respect the UK building-reg aisle widths.
- **Workshop Layout Optimiser** — drops the workshop machines into an assembly
  line, job shop or cellular pattern with proper clearance zones around each.
- **3D Furniture Visualiser** — renders Nevawood's bench catalogue procedurally
  in Three.js with a PBR wood-grain texture, and exports to GLTF so the model
  drops straight into Blender.

There's also a cross-tool hand-off: one click on the 3D Visualiser sends the
bench's sheet parts over to the Sheet Optimiser as a preloaded cut list.

## Stack

Vanilla JavaScript (ES6+), HTML5, CSS3, Three.js from a CDN. No frameworks
and no build step — the whole thing runs off any static host or straight off
the local filesystem.

## Running locally

Serve the folder with any static file server, or just open `index.html` in a
browser.

```bash
# any of these work
npm run serve                    # uses Python's http.server on port 8080
python -m http.server 8080
npx serve .
```

## Running the tests

```bash
npm install
npm run test              # 85 cases, ~4 seconds
npm run test:coverage     # same, plus Istanbul coverage
```

Expected: 85 out of 85 passing, 99.3% statement coverage on the algorithm
modules under `js/algorithms/`.

## Repository layout

```
├── index.html              # Dashboard
├── sheet-optimiser.html    # Tool 1
├── seating-optimiser.html  # Tool 2 (Space Planner)
├── workshop-optimiser.html # Tool 3
├── 3d-visualiser.html      # Tool 4
├── css/style.css           # Shared design system
├── js/
│   ├── algorithms/         # Pure DOM-free algorithm modules
│   │   ├── sheet-packing.js
│   │   ├── space-layouts.js
│   │   └── bench-parts.js
│   ├── sheet-optimiser.js
│   ├── seating-optimiser.js
│   ├── workshop-optimiser.js
│   └── 3d-visualiser.js
├── tests/                  # Jest, 85 cases
├── scripts/                # Benchmark + Playwright screenshot pipeline
└── logo.png
```

## Academic context

- Module: **CSF300 Project Implementation and Dissertation**
- Author: Anton Morris (2274309)
- Deadline: **06 July 2026 @ 11:00**
- The dissertation itself is kept outside this repository and is submitted
  directly to the marker. The proposal and progress report from CSF301 are
  archived separately.
