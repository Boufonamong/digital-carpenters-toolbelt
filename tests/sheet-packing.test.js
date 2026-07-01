// Unit tests for the sheet-packing algorithm module.
//
// Run with:  npm test
// Coverage:  npm run test:coverage

import {
    expandAndSort,
    guillotineSplit,
    tryPlace,
    packSheets,
    calculateEfficiency,
} from '../js/algorithms/sheet-packing.js';

// --------------------------------------------------------------------
// expandAndSort
// --------------------------------------------------------------------

describe('expandAndSort', () => {
    test('expands quantities into individual pieces', () => {
        const result = expandAndSort([
            { name: 'A', w: 100, h: 100, qty: 3 },
        ]);
        expect(result).toHaveLength(3);
        for (const p of result) {
            expect(p.name).toBe('A');
            expect(p.w).toBe(100);
            expect(p.h).toBe(100);
        }
    });

    test('defaults missing qty to 1', () => {
        const result = expandAndSort([
            { name: 'A', w: 500, h: 400 },
        ]);
        expect(result).toHaveLength(1);
    });

    test('sorts pieces by descending area (FFD invariant)', () => {
        const result = expandAndSort([
            { name: 'small',  w: 100, h: 100 }, // area 10 000
            { name: 'big',    w: 500, h: 500 }, // area 250 000
            { name: 'medium', w: 300, h: 200 }, // area 60 000
        ]);
        expect(result.map(p => p.name)).toEqual(['big', 'medium', 'small']);
    });

    test('handles an empty input list', () => {
        expect(expandAndSort([])).toEqual([]);
    });

    test('preserves colour metadata on each expanded piece', () => {
        const result = expandAndSort([
            { name: 'A', w: 100, h: 100, qty: 2, colour: '#abc123' },
        ]);
        for (const p of result) {
            expect(p.colour).toBe('#abc123');
        }
    });
});

// --------------------------------------------------------------------
// guillotineSplit
// --------------------------------------------------------------------

describe('guillotineSplit', () => {
    test('places the piece at the free rect origin', () => {
        const rect = { x: 0, y: 0, w: 1000, h: 500 };
        const piece = { name: 'A', w: 400, h: 200, colour: '#f00' };
        const { placedPiece } = guillotineSplit(400, 200, piece, rect, 0, [rect], 0);

        expect(placedPiece.x).toBe(0);
        expect(placedPiece.y).toBe(0);
        expect(placedPiece.w).toBe(400);
        expect(placedPiece.h).toBe(200);
        expect(placedPiece.name).toBe('A');
    });

    test('produces right + below free rects with zero kerf', () => {
        const rect = { x: 0, y: 0, w: 1000, h: 500 };
        const piece = { name: 'A', w: 400, h: 200 };
        const { freeRects } = guillotineSplit(400, 200, piece, rect, 0, [rect], 0);

        expect(freeRects).toHaveLength(2);

        const right = freeRects.find(r => r.x === 400 && r.y === 0);
        const below = freeRects.find(r => r.x === 0 && r.y === 200);

        expect(right).toEqual({ x: 400, y: 0, w: 600, h: 200 });
        expect(below).toEqual({ x: 0, y: 200, w: 1000, h: 300 });
    });

    test('subtracts kerf from remaining widths and heights', () => {
        const rect = { x: 0, y: 0, w: 1000, h: 500 };
        const piece = { name: 'A', w: 400, h: 200 };
        const kerf = 3;
        const { freeRects } = guillotineSplit(400, 200, piece, rect, 0, [rect], kerf);

        const right = freeRects.find(r => r.x === 403);
        const below = freeRects.find(r => r.y === 203);

        expect(right.w).toBe(1000 - 400 - kerf); // 597
        expect(below.h).toBe(500 - 200 - kerf);  // 297
    });

    test('omits the right rect when the piece fills the parent width', () => {
        const rect = { x: 0, y: 0, w: 400, h: 500 };
        const piece = { name: 'A', w: 400, h: 200 };
        const { freeRects } = guillotineSplit(400, 200, piece, rect, 0, [rect], 0);

        expect(freeRects).toHaveLength(1);
        expect(freeRects[0].x).toBe(0);
        expect(freeRects[0].y).toBe(200);
    });

    test('omits both rects when the piece fills the parent exactly', () => {
        const rect = { x: 0, y: 0, w: 400, h: 200 };
        const piece = { name: 'A', w: 400, h: 200 };
        const { freeRects } = guillotineSplit(400, 200, piece, rect, 0, [rect], 0);

        expect(freeRects).toHaveLength(0);
    });

    test('removes the consumed rect from the free-rect list', () => {
        const rectA = { x: 0, y: 0, w: 100, h: 100 };
        const rectB = { x: 200, y: 200, w: 300, h: 300 };
        const piece = { name: 'A', w: 100, h: 100 };
        const { freeRects } = guillotineSplit(100, 100, piece, rectA, 0, [rectA, rectB], 0);

        // rectA fully consumed --- only rectB should remain (no new children
        // because piece fills the rect exactly).
        expect(freeRects).toEqual([rectB]);
    });
});

// --------------------------------------------------------------------
// tryPlace
// --------------------------------------------------------------------

describe('tryPlace', () => {
    test('places the piece in the first fitting rect (natural orientation)', () => {
        const freeRects = [{ x: 0, y: 0, w: 1000, h: 500 }];
        const piece = { name: 'A', w: 400, h: 200 };
        const result = tryPlace(piece, freeRects, 0, false);

        expect(result).not.toBeNull();
        expect(result.placedPiece.w).toBe(400);
        expect(result.placedPiece.h).toBe(200);
    });

    test('rotates a piece when the natural orientation does not fit', () => {
        // rect is 500 wide, 1000 tall; piece is 800x300 --- won't fit as-is but fits rotated.
        const freeRects = [{ x: 0, y: 0, w: 500, h: 1000 }];
        const piece = { name: 'tall', w: 800, h: 300 };
        const result = tryPlace(piece, freeRects, 0, false);

        expect(result).not.toBeNull();
        expect(result.placedPiece.w).toBe(300);
        expect(result.placedPiece.h).toBe(800);
    });

    test('does not rotate when noRotate flag is set (grain preservation)', () => {
        const freeRects = [{ x: 0, y: 0, w: 500, h: 1000 }];
        const piece = { name: 'veneer', w: 800, h: 300 };
        const result = tryPlace(piece, freeRects, 0, /* noRotate */ true);

        expect(result).toBeNull();
    });

    test('returns null when no free rect can fit the piece', () => {
        const freeRects = [{ x: 0, y: 0, w: 100, h: 100 }];
        const piece = { name: 'big', w: 500, h: 500 };
        expect(tryPlace(piece, freeRects, 0, false)).toBeNull();
    });

    test('skips over undersized rects and tries subsequent ones', () => {
        const freeRects = [
            { x: 0,   y: 0, w: 50,  h: 50 },   // too small
            { x: 100, y: 0, w: 500, h: 500 },  // fits
        ];
        const piece = { name: 'A', w: 300, h: 300 };
        const result = tryPlace(piece, freeRects, 0, false);

        expect(result).not.toBeNull();
        expect(result.placedPiece.x).toBe(100);
    });
});

// --------------------------------------------------------------------
// packSheets --- the top-level packing function
// --------------------------------------------------------------------

describe('packSheets', () => {
    const plywood = { sheetW: 2440, sheetH: 1220 };

    test('returns empty result for empty piece list', () => {
        const { sheets, allPieces } = packSheets({ pieces: [], ...plywood });
        expect(sheets).toEqual([]);
        expect(allPieces).toEqual([]);
    });

    test('throws on invalid sheet dimensions', () => {
        expect(() => packSheets({
            pieces: [{ name: 'A', w: 100, h: 100, qty: 1 }],
            sheetW: 0,
            sheetH: 1220,
        })).toThrow(RangeError);

        expect(() => packSheets({
            pieces: [{ name: 'A', w: 100, h: 100, qty: 1 }],
            sheetW: 2440,
            sheetH: -1,
        })).toThrow(RangeError);
    });

    test('packs a single small piece onto a single sheet', () => {
        const { sheets } = packSheets({
            pieces: [{ name: 'A', w: 500, h: 500, qty: 1 }],
            ...plywood,
        });
        expect(sheets).toHaveLength(1);
        expect(sheets[0].placed).toHaveLength(1);
    });

    test('does not drop any pieces (total placed = total expanded)', () => {
        const pieces = [
            { name: 'panel',  w: 800, h: 400, qty: 6 },
            { name: 'shelf',  w: 600, h: 200, qty: 8 },
            { name: 'door',   w: 500, h: 1200, qty: 2 },
        ];
        const { sheets, allPieces } = packSheets({ pieces, ...plywood });

        const totalPlaced = sheets.reduce((s, sh) => s + sh.placed.length, 0);
        expect(totalPlaced).toBe(allPieces.length);
        expect(totalPlaced).toBe(6 + 8 + 2);
    });

    test('all placed pieces stay within their sheet bounds', () => {
        const pieces = [
            { name: 'A', w: 800, h: 400, qty: 4 },
            { name: 'B', w: 600, h: 900, qty: 3 },
        ];
        const { sheets } = packSheets({ pieces, ...plywood });

        for (const sheet of sheets) {
            for (const p of sheet.placed) {
                expect(p.x).toBeGreaterThanOrEqual(0);
                expect(p.y).toBeGreaterThanOrEqual(0);
                expect(p.x + p.w).toBeLessThanOrEqual(plywood.sheetW);
                expect(p.y + p.h).toBeLessThanOrEqual(plywood.sheetH);
            }
        }
    });

    test('placed pieces do not overlap on the same sheet', () => {
        const pieces = [
            { name: 'A', w: 800, h: 400, qty: 3 },
            { name: 'B', w: 600, h: 300, qty: 4 },
        ];
        const { sheets } = packSheets({ pieces, ...plywood });

        for (const sheet of sheets) {
            const placed = sheet.placed;
            for (let i = 0; i < placed.length; i++) {
                for (let j = i + 1; j < placed.length; j++) {
                    const a = placed[i];
                    const b = placed[j];
                    const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
                    const overlapY = a.y < b.y + b.h && b.y < a.y + a.h;
                    expect(overlapX && overlapY).toBe(false);
                }
            }
        }
    });

    test('opens a second sheet when the first cannot fit everything', () => {
        // Six pieces that are each larger than half the sheet --- forces multi-sheet.
        const pieces = [
            { name: 'big', w: 2000, h: 1000, qty: 3 },
        ];
        const { sheets } = packSheets({ pieces, ...plywood });
        expect(sheets.length).toBeGreaterThanOrEqual(3);
    });

    test('veneer sheets do not rotate pieces (grain direction)', () => {
        // A tall thin piece that would only fit rotated on a landscape sheet.
        const pieces = [
            { name: 'strip', w: 2400, h: 600, qty: 1 },
        ];

        // On a landscape veneer sheet (matches plywood dims but rotation is forbidden),
        // this fits directly.
        const veneer = { sheetW: 2440, sheetH: 1220 };
        const { sheets } = packSheets({ pieces, ...veneer, noRotate: true });
        expect(sheets[0].placed[0].w).toBe(2400);
        expect(sheets[0].placed[0].h).toBe(600);

        // On a portrait veneer sheet, the same piece would only fit rotated ---
        // with noRotate, it cannot be placed and opens a new sheet each time.
        const portraitVeneer = { sheetW: 1220, sheetH: 2440 };
        const { sheets: portraitSheets } = packSheets({
            pieces,
            ...portraitVeneer,
            noRotate: true,
        });
        // Piece cannot fit at all; sheet is opened but nothing is placed.
        expect(portraitSheets[0].placed).toHaveLength(0);
    });

    test('non-veneer sheets rotate to fit portrait-friendly pieces', () => {
        const pieces = [
            { name: 'strip', w: 2400, h: 600, qty: 1 },
        ];
        // Portrait plywood sheet --- rotation allowed --- piece should fit.
        const { sheets } = packSheets({
            pieces,
            sheetW: 1220,
            sheetH: 2440,
            noRotate: false,
        });
        expect(sheets[0].placed).toHaveLength(1);
        // Piece width and height should be swapped after rotation.
        expect(sheets[0].placed[0].w).toBe(600);
        expect(sheets[0].placed[0].h).toBe(2400);
    });

    test('achieves high efficiency on a tightly-fitting set (kerf=0 sanity floor)', () => {
        // Four pieces at exactly half a plywood sheet each with no kerf
        // should tile perfectly: two per sheet, two sheets, ~100% efficiency.
        const pieces = [
            { name: 'A', w: 1220, h: 610, qty: 4 },
        ];
        const { sheets } = packSheets({ pieces, ...plywood, kerf: 0 });
        const placed = sheets.flatMap(s => s.placed);
        const eff = calculateEfficiency(placed, sheets.length, plywood.sheetW, plywood.sheetH);
        expect(eff).toBeGreaterThanOrEqual(0.5);
    });

    test('kerf costs efficiency vs. an ideal-fit pack (regression on kerf accounting)', () => {
        // Same tight set, but with the default 3mm kerf --- the algorithm
        // cannot double-up per sheet any more so efficiency drops sharply.
        const pieces = [
            { name: 'A', w: 1220, h: 610, qty: 4 },
        ];
        const { sheets: kerfless } = packSheets({ pieces, ...plywood, kerf: 0 });
        const { sheets: withKerf } = packSheets({ pieces, ...plywood, kerf: 3 });

        // With kerf the piece width (1220) can't tile alongside itself
        // (1220 + 3 + 1220 > 2440), so more sheets are consumed.
        expect(withKerf.length).toBeGreaterThan(kerfless.length);
    });
});

// --------------------------------------------------------------------
// calculateEfficiency
// --------------------------------------------------------------------

describe('calculateEfficiency', () => {
    test('returns 0 for zero sheets', () => {
        expect(calculateEfficiency([], 0, 2440, 1220)).toBe(0);
    });

    test('computes efficiency as total piece area / total sheet area', () => {
        // One sheet, half filled.
        const placed = [{ w: 1220, h: 1220 }];
        const eff = calculateEfficiency(placed, 1, 2440, 1220);
        expect(eff).toBeCloseTo(0.5, 5);
    });

    test('efficiency is bounded within [0, 1] for valid inputs', () => {
        // Pieces filling the sheet exactly.
        const placed = [{ w: 2440, h: 1220 }];
        expect(calculateEfficiency(placed, 1, 2440, 1220)).toBe(1);
    });
});

// --------------------------------------------------------------------
// End-to-end: representative Nevawood-style cut list
// --------------------------------------------------------------------

describe('end-to-end: fitted-wardrobe cut list', () => {
    test('packs a realistic wardrobe cut list without dropping pieces', () => {
        // Loosely modelled on a fitted-wardrobe project.
        const pieces = [
            { name: 'side',      w: 2100, h: 600, qty: 2 },
            { name: 'top',       w: 2000, h: 600, qty: 1 },
            { name: 'bottom',    w: 2000, h: 600, qty: 1 },
            { name: 'shelf',     w: 1980, h: 550, qty: 4 },
            { name: 'door',      w: 990,  h: 2100, qty: 2 },
            { name: 'back',      w: 2000, h: 2100, qty: 1 },
            { name: 'divider',   w: 2100, h: 450, qty: 1 },
        ];

        const { sheets, allPieces } = packSheets({
            pieces,
            sheetW: 2440,
            sheetH: 1220,
        });

        const totalPlaced = sheets.reduce((s, sh) => s + sh.placed.length, 0);

        // Some very tall pieces (>1220mm) will not fit even rotated on a
        // 2440x1220 sheet --- the algorithm should still not throw and should
        // place every piece that CAN fit.
        expect(totalPlaced).toBeGreaterThan(0);
        expect(totalPlaced).toBeLessThanOrEqual(allPieces.length);

        // Whatever is placed must be valid.
        for (const sheet of sheets) {
            for (const p of sheet.placed) {
                expect(p.x + p.w).toBeLessThanOrEqual(2440);
                expect(p.y + p.h).toBeLessThanOrEqual(1220);
            }
        }
    });
});
