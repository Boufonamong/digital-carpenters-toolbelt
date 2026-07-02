// Nevawood bench parametric parts model.
//
// Pure functions. Consumed by:
//   * js/3d-visualiser.js  --- builds Three.js geometry from these parts
//   * js/sheet-optimiser.js --- receives a hand-off of the same parts
//                              as a cut list
//   * tests/bench-parts.test.js --- Jest unit tests
//
// Each function returns { parts, meta } where:
//
//   parts   Array of component descriptors:
//             {
//               name:      human-readable label,
//               w, h, d:   part dimensions in mm (thickness, height, depth
//                          --- see helpers for the convention),
//               qty:       count of this part in the bench,
//               stockType: 'sheet' | 'timber' --- where the part comes
//                          from (sheet stock vs. timber lengths),
//               colour:    optional palette colour for the sheet
//                          optimiser preview,
//             }
//
//   meta    { type, size, label } describing the bench overall.
//
// The dimensions here are the AUTHORITATIVE source of truth for
// Nevawood's three bench products.  Any change to the geometry rules
// must live here so both the 3D preview and the cut list stay in sync.

// ---- shared helpers -----------------------------------------------------

const SHEET_COLOURS = {
    top:   '#c8a96e',
    seat:  '#b0854a',
    leg:   '#8b6340',
    rail:  '#7a5330',
    brace: '#a0724a',
    ring:  '#c8a96e',
    post:  '#8b6340',
    tabletop: '#c8a96e',
};

function sheetPart(name, w, h, qty, colour) {
    return { name, w, h, d: 44, qty, stockType: 'sheet', colour };
}

function timberPart(name, w, h, qty, colour) {
    // Timber sections stored as w x h where w = section, h = length.
    return { name, w, h, d: w, qty, stockType: 'timber', colour };
}

// ---- Pub / Picnic Bench -------------------------------------------------
//
// Assembly grammar:
//   * one table top (sheet)
//   * two bench seats (sheet)
//   * four table legs (timber)
//   * four seat legs (timber, per side --- two sides so eight seat legs)
//   * two cross-braces under the table (timber)
//   * two foot rails, one per bench (timber)
//
// Dimensions match the geometry generator in js/3d-visualiser.js so the
// cut list matches what appears in the 3D preview.

export function picnicBenchParts(len) {
    if (!(len > 0)) throw new RangeError('picnicBenchParts: len must be positive');

    const tableT = 44;   // sheet thickness
    const tableD = 560;  // table top depth
    const tableH = 750;  // overall table height
    const seatT = 44;
    const seatD = 320;
    const seatH = 460;
    const gap = 70;
    const legW = 70;

    const inset = Math.min(160, len * 0.14);
    const railLen = Math.round(len - inset * 2);
    const legLen = tableH - tableT;          // table leg length
    const seatLegLen = seatH - seatT;
    const braceLen = Math.round(tableD * 0.55);

    const parts = [
        sheetPart('Table Top',   len, tableD, 1, SHEET_COLOURS.top),
        sheetPart('Bench Seat',  len, seatD,  2, SHEET_COLOURS.seat),

        // Table trestle legs: 4 uprights + 2 cross-braces (per trestle x 2 trestles = 4 braces).
        timberPart('Table Leg',   legW, legLen,    4, SHEET_COLOURS.leg),
        timberPart('Cross Brace', legW, braceLen,  2, SHEET_COLOURS.brace),

        // Seat legs: 2 per bench x 2 benches = 4 legs.
        timberPart('Seat Leg',    legW, seatLegLen, 4, SHEET_COLOURS.leg),

        // Foot rails, one per bench.
        timberPart('Foot Rail',   legW, railLen,   2, SHEET_COLOURS.rail),
    ];

    return {
        parts,
        meta: {
            type: 'picnic',
            size: len,
            label: `Pub / Picnic Bench --- ${(len / 1000).toFixed(1)}m`,
        },
    };
}

// ---- Criss-Cross Bench --------------------------------------------------
//
// Assembly grammar:
//   * one seat plank (sheet)
//   * four X-frame legs (timber, two per end)
//   * one longitudinal foot rail (timber)

export function crossBenchParts(len) {
    if (!(len > 0)) throw new RangeError('crossBenchParts: len must be positive');

    const seatT = 44;
    const seatD = 300;
    const seatH = 600;
    const legW = 50;

    const inset = Math.min(140, len * 0.12);
    const frameH = seatH - seatT;
    const halfD = seatD / 2;
    const diagLen = Math.round(Math.hypot(frameH, halfD * 2));
    const railLen = Math.round(len - inset);

    const parts = [
        sheetPart('Seat Plank', len, seatD, 1, SHEET_COLOURS.seat),

        // Two X-frames, each with two diagonals --- 4 diagonals total.
        timberPart('X-Frame Diagonal', legW, diagLen, 4, SHEET_COLOURS.leg),

        // Longitudinal foot rail linking the two frames.
        timberPart('Foot Rail', legW, railLen, 1, SHEET_COLOURS.rail),
    ];

    return {
        parts,
        meta: {
            type: 'crossbench',
            size: len,
            label: `Criss-Cross Bench --- ${(len / 1000).toFixed(1)}m`,
        },
    };
}

// ---- Round Bench --------------------------------------------------------
//
// Assembly grammar:
//   * seat ring assembled from N arc segments (sheet)
//   * support posts under the ring (timber, count adaptive to radius)
//   * central column (timber, single square section)
//   * circular table top (sheet)

const ROUND_BENCH_SEGMENTS = 36;

export function roundBenchParts(radius) {
    if (!(radius > 0)) throw new RangeError('roundBenchParts: radius must be positive');

    const seatT = 44;
    const innerR = radius * 0.68;
    const midR = (radius + innerR) / 2;
    const seatWidth = Math.round(radius - innerR);
    const segLen = Math.round(2 * Math.PI * midR / ROUND_BENCH_SEGMENTS * 1.05);

    const numPosts = Math.max(4, Math.round(2 * Math.PI * radius / 700));
    const seatH = 450;
    const postLen = seatH - seatT;

    const tableH = 638;
    const tableTopT = 44;
    const tableTopR = Math.round(radius * 0.77);
    const tableTopDiameter = tableTopR * 2;
    const columnSection = 120;

    const parts = [
        sheetPart('Ring Segment',  segLen, seatWidth,        ROUND_BENCH_SEGMENTS, SHEET_COLOURS.ring),
        timberPart('Support Post', 80,    postLen,           numPosts,             SHEET_COLOURS.post),
        timberPart('Central Column', columnSection, tableH,  1,                    SHEET_COLOURS.post),
        // Table top rendered from a cylinder --- store the bounding square so
        // it can be laid out as a sheet cut (or the disc dropped into a router).
        sheetPart('Table Top (disc bounding)', tableTopDiameter, tableTopDiameter, 1, SHEET_COLOURS.tabletop),
    ];

    return {
        parts,
        meta: {
            type: 'roundbench',
            size: radius,
            label: `Round Bench --- ${(radius / 1000).toFixed(0)}m radius`,
        },
    };
}

// ---- Convenience dispatcher --------------------------------------------

/**
 * Return the parts for a bench of the given type and size.
 *
 * @param {'picnic'|'crossbench'|'roundbench'} type
 * @param {number} size  length in mm (or radius for roundbench)
 * @returns {{parts: Array, meta: object}}
 */
export function benchParts(type, size) {
    switch (type) {
        case 'picnic':     return picnicBenchParts(size);
        case 'crossbench': return crossBenchParts(size);
        case 'roundbench': return roundBenchParts(size);
        default:
            throw new RangeError(`benchParts: unknown bench type "${type}"`);
    }
}

// ---- Cut-list adapter --------------------------------------------------
//
// Convert a parts result into the shape expected by the sheet optimiser's
// piece list.  Timber sections are optionally included --- by default only
// sheet stock is emitted, matching the sheet optimiser's actual capability.

/**
 * @param {{parts: Array, meta: object}} benchResult
 * @param {object} [opts]
 * @param {boolean} [opts.includeTimber=false]  include timber lengths as
 *   rectangular pieces (a lie for cutting purposes but useful for a
 *   combined materials estimate).
 * @returns {Array<{name: string, w: number, h: number, qty: number, colour?: string}>}
 */
export function partsToPieces(benchResult, { includeTimber = false } = {}) {
    return benchResult.parts
        .filter(p => includeTimber || p.stockType === 'sheet')
        .map(p => ({
            name: p.name,
            w: p.w,
            h: p.h,
            qty: p.qty,
            colour: p.colour,
        }));
}
