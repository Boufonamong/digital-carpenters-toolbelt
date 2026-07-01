# Digital Carpenter's Toolbelt

Final-year project (CSF300 — BSc Applied Software Engineering, Swansea University).

A browser-based suite of four calculation tools built for **Nevawood Joinery**, a
bespoke furniture and seating maker in South-East Wales.

- **Sheet Material Optimiser** — First Fit Decreasing + Guillotine Split bin packing
  for cutting plywood, MDF and veneer sheets.
- **Space Planner** — parametric layout tool for bench installations and venue
  seating (theatre, classroom, boardroom, church, pub styles).
- **Workshop Layout Optimiser** — machine placement across three workflow patterns
  (assembly line, job shop, cellular) with clearance zones.
- **3D Furniture Visualiser** — Three.js procedural modelling of Nevawood's bench
  product range, with GLTF export for client presentations.

## Stack

Vanilla JavaScript (ES6+), HTML5, CSS3, Three.js. No frameworks, no build step —
the app runs from any static host or straight off the local filesystem.

## Running locally

Serve the folder with any static file server, or just open `index.html` in a
browser. Three.js is loaded via CDN in `3d-visualiser.html`.

```bash
# any of these will work
python -m http.server 8080
npx serve .
```

## Repository layout

```
├── index.html              # Dashboard / entry point
├── sheet-optimiser.html    # Tool 1
├── seating-optimiser.html  # Tool 2 (Space Planner)
├── workshop-optimiser.html # Tool 3
├── 3d-visualiser.html      # Tool 4
├── css/style.css           # Shared design system
├── js/
│   ├── sheet-optimiser.js
│   ├── seating-optimiser.js
│   ├── workshop-optimiser.js
│   └── 3d-visualiser.js
└── logo.png
```

## Academic context

- Module: **CSF300 Project Implementation and Dissertation**
- Author: Anton Morris (2274309)
- Supervisor: MC
- Deadline: **06 July 2026 @ 11:00**
- Previous deliverable (CSF301) proposal and progress report evidence is
  archived separately.
