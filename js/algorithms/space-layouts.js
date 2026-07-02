// Parametric space-layout algorithms.
//
// Pure functions. Consumed by:
//   * js/seating-optimiser.js --- UI wrapper wires DOM inputs into these
//   * tests/space-layouts.test.js --- Jest unit tests
//
// Two families of layouts:
//
//   Bench mode  (runBenchLayout)
//     Cycles through a user-supplied list of Nevawood products
//     (picnic, cross, round) and fills the room in rows.
//
//   Venue mode  (layoutTheatre, ..., layoutPub)
//     Five hardcoded parametric layouts with regulatory-aware
//     spacing.  Each returns [] when the room is too small to
//     satisfy its own constraints.
//
// All dimensions are millimetres.

// --------------------------------------------------------------------
// Bench-mode helpers
// --------------------------------------------------------------------

/**
 * Estimate the number of covers (seats) for a bench product.
 *
 * @param {{type: string, length?: number, radius?: number}} entry
 * @returns {number}
 */
export function calcCovers(entry) {
    if (entry.type === 'roundbench') {
        return Math.floor(2 * Math.PI * entry.radius / 500);
    }
    if (entry.type === 'crossbench') {
        return Math.floor(entry.length / 450);
    }
    return Math.floor(entry.length / 450) * 2;
}

/**
 * Fill a rectangular room by cycling through the placement list, row by row.
 *
 * @param {object} params
 * @param {Array} params.products  user-added product entries
 * @param {number} params.roomW    room width in mm
 * @param {number} params.roomD    room depth in mm
 * @param {number} params.aisleGap gap between rows and between units in mm
 * @param {number} [params.wallClear=400]
 * @returns {Array}  placed unit descriptors
 */
export function runBenchLayout({ products, roomW, roomD, aisleGap, wallClear = 400 }) {
    if (!Array.isArray(products) || products.length === 0) return [];
    if (!(roomW > 0) || !(roomD > 0)) return [];

    const placed = [];
    let curY = wallClear;
    const n = products.length;
    let idx = 0;
    let skipped = 0;

    while (curY < roomD - wallClear) {
        const prod = products[idx % n];
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

// --------------------------------------------------------------------
// Venue-mode layouts
// --------------------------------------------------------------------

// Theatre: two banks either side of a centre aisle, stage clearance at front.
export function layoutTheatre({ roomW, roomD, aisleGap }) {
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
        placed.push(theatreRow(xLeft,  curY, sectionW, rowD, seatsPerSection));
        placed.push(theatreRow(xRight, curY, sectionW, rowD, seatsPerSection));
        curY += rowSpacing;
    }
    return placed;
}

function theatreRow(x, y, length, depth, seatsInRow) {
    return {
        type: 'row', isRound: false,
        x, y, length, depth,
        seatsInRow,
        colour: '#5b8db8',
        label: 'Theatre Row', displaySize: `${seatsInRow} seats`,
        covers: seatsInRow,
    };
}

// Classroom: single or split desk banks facing the front.
export function layoutClassroom({ roomW, roomD, aisleGap }) {
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
        if (desksPerSection < 1) return placed;
        const sectionW = desksPerSection * deskW;
        const xStart = wallClear + (usableW - sectionW) / 2;
        let curY = wallClear + frontClear;
        while (curY + deskD <= roomD - wallClear) {
            placed.push(deskRow(xStart, curY, sectionW, deskD, desksPerSection));
            curY += rowSpacing;
        }
    } else {
        const sectionW = desksPerSection * deskW;
        const xLeft = wallClear;
        const xRight = wallClear + sectionW + aisleW;
        let curY = wallClear + frontClear;
        while (curY + deskD <= roomD - wallClear) {
            placed.push(deskRow(xLeft,  curY, sectionW, deskD, desksPerSection));
            placed.push(deskRow(xRight, curY, sectionW, deskD, desksPerSection));
            curY += rowSpacing;
        }
    }
    return placed;
}

function deskRow(x, y, length, depth, seatsInRow) {
    return {
        type: 'desk', isRound: false,
        x, y, length, depth,
        seatsInRow,
        colour: '#5b9f5b',
        label: 'Desk Row', displaySize: `${seatsInRow} desks`,
        covers: seatsInRow,
    };
}

// Boardroom: central table with perimeter chairs on all four sides.
export function layoutBoardroom({ roomW, roomD }) {
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
        placed.push(boardChairs(tableX, wallClear, tableW, chairD, topChairs, 'Chairs (top)'));
        placed.push(boardChairs(tableX, tableY + tableD + gap, tableW, chairD, topChairs, 'Chairs (bottom)'));
    }
    if (sideChairs > 0) {
        placed.push(boardChairs(wallClear, tableY, chairD, tableD, sideChairs, 'Chairs (left)'));
        placed.push(boardChairs(tableX + tableW + gap, tableY, chairD, tableD, sideChairs, 'Chairs (right)'));
    }
    return placed;
}

function boardChairs(x, y, length, depth, seatsInRow, label) {
    return {
        type: 'row', isRound: false,
        x, y, length, depth,
        seatsInRow, colour: '#8b6340',
        label, displaySize: `${seatsInRow} seats`,
        covers: seatsInRow,
    };
}

// Church: two banks + centre aisle >= 1200mm (UK Building Regs), side aisles, chancel clearance.
export function layoutChurch({ roomW, roomD, aisleGap }) {
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
        placed.push(pew(xLeft,  curY, sectionW, pewD, seatsPerSection));
        placed.push(pew(xRight, curY, sectionW, pewD, seatsPerSection));
        curY += pewSpacing;
    }
    return placed;
}

function pew(x, y, length, depth, seatsInRow) {
    return {
        type: 'pew', isRound: false,
        x, y, length, depth,
        seatsInRow, colour: '#b08060',
        label: 'Pew', displaySize: `${seatsInRow} seats`,
        covers: seatsInRow,
    };
}

// Pub / bar: grid of 4-cover square table units.
export function layoutPub({ roomW, roomD, aisleGap }) {
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

// --------------------------------------------------------------------
// Dispatcher
// --------------------------------------------------------------------

/**
 * Run one of the parametric venue layouts by style name.
 *
 * @param {'theatre'|'classroom'|'boardroom'|'church'|'pub'} style
 * @param {{roomW: number, roomD: number, aisleGap: number}} params
 * @returns {Array}
 */
export function runVenueLayout(style, params) {
    switch (style) {
        case 'theatre':   return layoutTheatre(params);
        case 'classroom': return layoutClassroom(params);
        case 'boardroom': return layoutBoardroom(params);
        case 'church':    return layoutChurch(params);
        case 'pub':       return layoutPub(params);
        default:
            throw new RangeError(`runVenueLayout: unknown style "${style}"`);
    }
}
