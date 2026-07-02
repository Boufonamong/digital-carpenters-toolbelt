// Unit tests for the Nevawood bench parts model.

import {
    picnicBenchParts,
    crossBenchParts,
    roundBenchParts,
    benchParts,
    partsToPieces,
} from '../js/algorithms/bench-parts.js';

// --------------------------------------------------------------------
// Shared invariants
// --------------------------------------------------------------------

function invariants(parts) {
    for (const p of parts) {
        expect(p.name).toBeTruthy();
        expect(typeof p.qty).toBe('number');
        expect(p.qty).toBeGreaterThan(0);
        expect(p.w).toBeGreaterThan(0);
        expect(p.h).toBeGreaterThan(0);
        expect(p.d).toBeGreaterThan(0);
        expect(['sheet', 'timber']).toContain(p.stockType);
    }
}

// --------------------------------------------------------------------
// Picnic bench
// --------------------------------------------------------------------

describe('picnicBenchParts', () => {
    test('rejects non-positive length', () => {
        expect(() => picnicBenchParts(0)).toThrow(RangeError);
        expect(() => picnicBenchParts(-1)).toThrow(RangeError);
    });

    test('produces the six-component picnic assembly', () => {
        const { parts, meta } = picnicBenchParts(2000);

        expect(meta.type).toBe('picnic');
        expect(meta.size).toBe(2000);
        expect(meta.label).toMatch(/Pub \/ Picnic Bench/);

        const names = parts.map(p => p.name);
        expect(names).toEqual(expect.arrayContaining([
            'Table Top', 'Bench Seat',
            'Table Leg', 'Cross Brace', 'Seat Leg', 'Foot Rail',
        ]));
        expect(parts).toHaveLength(6);

        invariants(parts);
    });

    test('table top and bench seat span the bench length', () => {
        const len = 3000;
        const { parts } = picnicBenchParts(len);

        const tableTop = parts.find(p => p.name === 'Table Top');
        const benchSeat = parts.find(p => p.name === 'Bench Seat');

        expect(tableTop.w).toBe(len);
        expect(benchSeat.w).toBe(len);
        expect(benchSeat.qty).toBe(2); // two bench seats
        expect(tableTop.qty).toBe(1);
    });

    test('leg count is 4 table legs + 4 seat legs (per Nevawood assembly)', () => {
        const { parts } = picnicBenchParts(2400);
        const tableLegs = parts.find(p => p.name === 'Table Leg');
        const seatLegs  = parts.find(p => p.name === 'Seat Leg');

        expect(tableLegs.qty).toBe(4);
        expect(seatLegs.qty).toBe(4);
    });

    test('scales the foot rail with bench length', () => {
        const shortRun = picnicBenchParts(1000).parts.find(p => p.name === 'Foot Rail');
        const longRun  = picnicBenchParts(6000).parts.find(p => p.name === 'Foot Rail');

        expect(longRun.h).toBeGreaterThan(shortRun.h);
    });
});

// --------------------------------------------------------------------
// Criss-cross bench
// --------------------------------------------------------------------

describe('crossBenchParts', () => {
    test('rejects non-positive length', () => {
        expect(() => crossBenchParts(0)).toThrow(RangeError);
    });

    test('produces the three-component cross-bench assembly', () => {
        const { parts, meta } = crossBenchParts(2000);

        expect(meta.type).toBe('crossbench');
        expect(parts).toHaveLength(3);
        expect(parts.map(p => p.name)).toEqual(
            expect.arrayContaining(['Seat Plank', 'X-Frame Diagonal', 'Foot Rail'])
        );

        invariants(parts);
    });

    test('X-frame yields four diagonals (two frames x two diagonals)', () => {
        const { parts } = crossBenchParts(2400);
        const diagonals = parts.find(p => p.name === 'X-Frame Diagonal');
        expect(diagonals.qty).toBe(4);
    });

    test('diagonal length is longer than the seat height (Pythagoras sanity)', () => {
        const { parts } = crossBenchParts(2000);
        const diagonal = parts.find(p => p.name === 'X-Frame Diagonal');
        // frameH = seatH - seatT = 600 - 44 = 556. Diagonal must exceed 556.
        expect(diagonal.h).toBeGreaterThan(556);
    });

    test('seat plank spans the bench length', () => {
        const len = 3600;
        const seat = crossBenchParts(len).parts.find(p => p.name === 'Seat Plank');
        expect(seat.w).toBe(len);
        expect(seat.qty).toBe(1);
    });
});

// --------------------------------------------------------------------
// Round bench
// --------------------------------------------------------------------

describe('roundBenchParts', () => {
    test('rejects non-positive radius', () => {
        expect(() => roundBenchParts(0)).toThrow(RangeError);
    });

    test('produces the four-component round-bench assembly', () => {
        const { parts, meta } = roundBenchParts(2000);

        expect(meta.type).toBe('roundbench');
        expect(parts).toHaveLength(4);
        expect(parts.map(p => p.name)).toEqual(expect.arrayContaining([
            'Ring Segment', 'Support Post', 'Central Column',
            'Table Top (disc bounding)',
        ]));

        invariants(parts);
    });

    test('ring is assembled from 36 arc segments regardless of radius', () => {
        for (const r of [1000, 2000, 3000, 4000]) {
            const seg = roundBenchParts(r).parts.find(p => p.name === 'Ring Segment');
            expect(seg.qty).toBe(36);
        }
    });

    test('post count grows with radius (perimeter / 700mm)', () => {
        const small = roundBenchParts(1000).parts.find(p => p.name === 'Support Post');
        const large = roundBenchParts(4000).parts.find(p => p.name === 'Support Post');
        expect(large.qty).toBeGreaterThan(small.qty);
        expect(small.qty).toBeGreaterThanOrEqual(4); // floor
    });

    test('table top bounding square scales with radius', () => {
        const { parts } = roundBenchParts(2000);
        const disc = parts.find(p => p.name === 'Table Top (disc bounding)');
        // Table top R = radius * 0.77 -> diameter = 3080mm
        expect(disc.w).toBe(disc.h);
        expect(disc.w).toBe(Math.round(2000 * 0.77) * 2);
    });
});

// --------------------------------------------------------------------
// Dispatcher and cut-list adapter
// --------------------------------------------------------------------

describe('benchParts dispatcher', () => {
    test('routes to the correct generator per type', () => {
        expect(benchParts('picnic', 2000).meta.type).toBe('picnic');
        expect(benchParts('crossbench', 2000).meta.type).toBe('crossbench');
        expect(benchParts('roundbench', 2000).meta.type).toBe('roundbench');
    });

    test('throws on an unknown type', () => {
        expect(() => benchParts('cabinet', 2000)).toThrow(RangeError);
    });
});

describe('partsToPieces', () => {
    test('by default emits only sheet stock (matches sheet optimiser capability)', () => {
        const result = picnicBenchParts(2000);
        const pieces = partsToPieces(result);
        expect(pieces.every(p => ['Table Top', 'Bench Seat'].includes(p.name))).toBe(true);
    });

    test('with includeTimber=true emits every part', () => {
        const result = picnicBenchParts(2000);
        const pieces = partsToPieces(result, { includeTimber: true });
        expect(pieces).toHaveLength(result.parts.length);
    });

    test('reshapes descriptors into the sheet optimiser input shape', () => {
        const result = picnicBenchParts(2000);
        const pieces = partsToPieces(result);
        for (const piece of pieces) {
            expect(piece).toEqual({
                name: expect.any(String),
                w: expect.any(Number),
                h: expect.any(Number),
                qty: expect.any(Number),
                colour: expect.any(String),
            });
            // Should not carry through internal metadata.
            expect(piece.stockType).toBeUndefined();
            expect(piece.d).toBeUndefined();
        }
    });
});

// --------------------------------------------------------------------
// Regression: total covers-scale for common Nevawood sizes
// --------------------------------------------------------------------

describe('regression cases from the Nevawood product catalogue', () => {
    // A 2.4m picnic bench is the workshop's most common size.  Freeze the
    // total qty and total nominal sheet area so an accidental refactor
    // that changes the assembly grammar surfaces here.
    test('2.4m picnic bench totals: 15 individual components', () => {
        // 1 (top) + 2 (seat) + 4 (table leg) + 2 (brace) + 4 (seat leg) + 2 (rail).
        // Adjust if the assembly grammar changes.
        const { parts } = picnicBenchParts(2400);
        const totalQty = parts.reduce((s, p) => s + p.qty, 0);
        expect(totalQty).toBe(15);
    });

    test('4.8m picnic bench also totals 15 (assembly grammar is length-invariant)', () => {
        const { parts } = picnicBenchParts(4800);
        const totalQty = parts.reduce((s, p) => s + p.qty, 0);
        expect(totalQty).toBe(15);
    });
});
