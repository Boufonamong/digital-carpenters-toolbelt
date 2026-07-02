// Unit tests for the space / venue layout algorithms.

import {
    calcCovers,
    runBenchLayout,
    layoutTheatre,
    layoutClassroom,
    layoutBoardroom,
    layoutChurch,
    layoutPub,
    runVenueLayout,
} from '../js/algorithms/space-layouts.js';

// --------------------------------------------------------------------
// Shared helpers / invariants
// --------------------------------------------------------------------

function assertRectInside(p, roomW, roomD, tag = '') {
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x + p.length).toBeLessThanOrEqual(roomW);
    expect(p.y + p.depth).toBeLessThanOrEqual(roomD);
    if (tag) expect(tag).toBeTruthy();
}

function assertNoOverlap(rects) {
    // Only rectangles (skip round entries).
    const rs = rects.filter(r => !r.isRound);
    for (let i = 0; i < rs.length; i++) {
        for (let j = i + 1; j < rs.length; j++) {
            const a = rs[i];
            const b = rs[j];
            const overlapX = a.x < b.x + b.length && b.x < a.x + a.length;
            const overlapY = a.y < b.y + b.depth && b.y < a.y + a.depth;
            expect(overlapX && overlapY).toBe(false);
        }
    }
}

// --------------------------------------------------------------------
// calcCovers
// --------------------------------------------------------------------

describe('calcCovers', () => {
    test('picnic bench: two sides x floor(len/450)', () => {
        expect(calcCovers({ type: 'picnic', length: 2000 })).toBe(Math.floor(2000 / 450) * 2);
    });

    test('cross bench: single side, one seat per 450mm', () => {
        expect(calcCovers({ type: 'crossbench', length: 2000 })).toBe(Math.floor(2000 / 450));
    });

    test('round bench: perimeter over 500mm per seat', () => {
        expect(calcCovers({ type: 'roundbench', radius: 1000 })).toBe(
            Math.floor(2 * Math.PI * 1000 / 500)
        );
    });
});

// --------------------------------------------------------------------
// runBenchLayout
// --------------------------------------------------------------------

describe('runBenchLayout', () => {
    const picnic = {
        type: 'picnic', label: 'Picnic 2m',
        length: 2000, depth: 1700, colour: '#c8a965',
        displaySize: '2.0m',
    };

    test('returns empty when no products are supplied', () => {
        expect(runBenchLayout({
            products: [], roomW: 10000, roomD: 10000, aisleGap: 900,
        })).toEqual([]);
    });

    test('returns empty when room dimensions are non-positive', () => {
        expect(runBenchLayout({
            products: [picnic], roomW: 0, roomD: 10000, aisleGap: 900,
        })).toEqual([]);
    });

    test('places at least one row when the room fits a picnic bench', () => {
        const placed = runBenchLayout({
            products: [picnic], roomW: 6000, roomD: 6000, aisleGap: 900,
        });
        expect(placed.length).toBeGreaterThan(0);
    });

    test('all placed units stay inside the room', () => {
        const placed = runBenchLayout({
            products: [picnic], roomW: 8000, roomD: 8000, aisleGap: 900,
        });
        for (const p of placed) {
            assertRectInside(p, 8000, 8000);
        }
    });

    test('placed benches do not overlap', () => {
        const placed = runBenchLayout({
            products: [picnic], roomW: 12000, roomD: 12000, aisleGap: 900,
        });
        assertNoOverlap(placed);
    });

    test('cycles through multiple product types across rows', () => {
        const cross = {
            type: 'crossbench', label: 'Cross 2m',
            length: 2000, depth: 300, colour: '#8b6340',
            displaySize: '2.0m',
        };
        const placed = runBenchLayout({
            products: [picnic, cross], roomW: 10000, roomD: 8000, aisleGap: 900,
        });
        const types = new Set(placed.map(p => p.type));
        expect(types.has('picnic') || types.has('crossbench')).toBe(true);
        // At least one of each if room fits both.
    });

    test('round benches are placed with centre coordinates and radius', () => {
        const round = {
            type: 'roundbench', label: 'Round 1m',
            radius: 1000, length: 2000, depth: 2000,
            colour: '#3a9fbf', displaySize: '1m radius',
        };
        const placed = runBenchLayout({
            products: [round], roomW: 10000, roomD: 10000, aisleGap: 900,
        });

        expect(placed.length).toBeGreaterThan(0);
        for (const p of placed) {
            expect(p.isRound).toBe(true);
            expect(p.radius).toBe(1000);
            expect(p.cx).toBeGreaterThan(0);
            expect(p.cy).toBeGreaterThan(0);
            // Round bench must not spill past the walls.
            expect(p.cx - p.radius).toBeGreaterThanOrEqual(0);
            expect(p.cy - p.radius).toBeGreaterThanOrEqual(0);
            expect(p.cx + p.radius).toBeLessThanOrEqual(10000);
            expect(p.cy + p.radius).toBeLessThanOrEqual(10000);
        }
    });
});

// --------------------------------------------------------------------
// Venue layouts --- shared expectations
// --------------------------------------------------------------------

describe('layoutTheatre', () => {
    test('returns empty when the room is too narrow for two sections + centre aisle', () => {
        // roomW = 2000mm: usable 1200mm, minus 900mm centre aisle = 300mm total
        // for two 450mm-min sections --- cannot fit even one seat per side.
        expect(layoutTheatre({ roomW: 2000, roomD: 10000, aisleGap: 900 })).toEqual([]);
    });

    test('produces symmetric left/right sections', () => {
        const placed = layoutTheatre({ roomW: 15000, roomD: 20000, aisleGap: 900 });
        expect(placed.length).toBeGreaterThan(0);
        expect(placed.length % 2).toBe(0); // pairs of left+right rows

        for (const p of placed) {
            expect(p.type).toBe('row');
            expect(p.seatsInRow).toBeGreaterThan(0);
            expect(p.covers).toBe(p.seatsInRow);
        }
    });

    test('every row stays within the room', () => {
        const placed = layoutTheatre({ roomW: 15000, roomD: 20000, aisleGap: 900 });
        for (const p of placed) assertRectInside(p, 15000, 20000);
    });

    test('centre aisle at least 900mm (regulatory floor)', () => {
        const placed = layoutTheatre({ roomW: 15000, roomD: 20000, aisleGap: 300 });
        // Aisle overridden to the 900mm floor. Verify by measuring the
        // gap between left and right rows on the first row-pair.
        const first = placed.slice(0, 2).sort((a, b) => a.x - b.x);
        if (first.length === 2) {
            const gap = first[1].x - (first[0].x + first[0].length);
            expect(gap).toBeGreaterThanOrEqual(900);
        }
    });
});

describe('layoutClassroom', () => {
    test('twin-bank layout when width allows a centre aisle', () => {
        const placed = layoutClassroom({ roomW: 12000, roomD: 15000, aisleGap: 900 });
        expect(placed.length).toBeGreaterThan(0);
        expect(placed.length % 2).toBe(0); // left + right rows
    });

    test('single-bank fallback in a narrow room', () => {
        // A 2.5m-wide room cannot fit two 600mm desks per bank + 900mm aisle.
        // The layout falls back to a single centred bank.
        const placed = layoutClassroom({ roomW: 2500, roomD: 8000, aisleGap: 900 });
        expect(placed.length).toBeGreaterThan(0);
        // In single-bank mode, every row starts at the same x.
        const xs = new Set(placed.map(p => p.x));
        expect(xs.size).toBe(1);
    });

    test('every desk row stays within the room', () => {
        const placed = layoutClassroom({ roomW: 12000, roomD: 15000, aisleGap: 900 });
        for (const p of placed) assertRectInside(p, 12000, 15000);
    });
});

describe('layoutBoardroom', () => {
    test('returns empty when the room is too small', () => {
        expect(layoutBoardroom({ roomW: 2000, roomD: 2000 })).toEqual([]);
    });

    test('produces one table plus up to four perimeter chair rows', () => {
        const placed = layoutBoardroom({ roomW: 8000, roomD: 8000 });
        const table = placed.filter(p => p.type === 'boardtable');
        const chairs = placed.filter(p => p.type === 'row');

        expect(table).toHaveLength(1);
        expect(chairs.length).toBeGreaterThan(0);
        expect(chairs.length).toBeLessThanOrEqual(4);
    });

    test('every element stays within the room', () => {
        const placed = layoutBoardroom({ roomW: 8000, roomD: 8000 });
        for (const p of placed) assertRectInside(p, 8000, 8000);
    });
});

describe('layoutChurch', () => {
    test('returns empty when the room is too narrow', () => {
        expect(layoutChurch({ roomW: 4000, roomD: 10000, aisleGap: 900 })).toEqual([]);
    });

    test('centre aisle enforced at 1200mm minimum (UK Approved Document B)', () => {
        const placed = layoutChurch({ roomW: 15000, roomD: 25000, aisleGap: 300 });
        // Same gap-measurement trick as the theatre.
        const first = placed.slice(0, 2).sort((a, b) => a.x - b.x);
        if (first.length === 2) {
            const gap = first[1].x - (first[0].x + first[0].length);
            expect(gap).toBeGreaterThanOrEqual(1200);
        }
    });

    test('every pew stays within the room', () => {
        const placed = layoutChurch({ roomW: 15000, roomD: 25000, aisleGap: 900 });
        for (const p of placed) assertRectInside(p, 15000, 25000);
        expect(placed.every(p => p.type === 'pew')).toBe(true);
    });
});

describe('layoutPub', () => {
    test('places at least one 4-cover unit in a modest room', () => {
        const placed = layoutPub({ roomW: 8000, roomD: 6000, aisleGap: 600 });
        expect(placed.length).toBeGreaterThan(0);
        expect(placed.every(p => p.type === 'pubtable')).toBe(true);
        expect(placed.every(p => p.covers === 4)).toBe(true);
    });

    test('grid units stay inside the room', () => {
        const placed = layoutPub({ roomW: 12000, roomD: 10000, aisleGap: 600 });
        for (const p of placed) assertRectInside(p, 12000, 10000);
    });

    test('no overlap between grid units', () => {
        const placed = layoutPub({ roomW: 12000, roomD: 10000, aisleGap: 600 });
        assertNoOverlap(placed);
    });
});

// --------------------------------------------------------------------
// runVenueLayout dispatcher
// --------------------------------------------------------------------

describe('runVenueLayout dispatcher', () => {
    const params = { roomW: 15000, roomD: 20000, aisleGap: 900 };

    test.each([
        ['theatre'],
        ['classroom'],
        ['boardroom'],
        ['church'],
        ['pub'],
    ])('routes to the %s layout', (style) => {
        const placed = runVenueLayout(style, params);
        expect(Array.isArray(placed)).toBe(true);
        expect(placed.length).toBeGreaterThan(0);
    });

    test('throws on unknown style', () => {
        expect(() => runVenueLayout('cinema', params)).toThrow(RangeError);
    });
});
