// Sheet packing algorithm --- First Fit Decreasing + Guillotine Split.
//
// Pure functions only. No DOM access, no globals, no side effects.
// This module is imported by the browser UI (js/sheet-optimiser.js) and
// by the Jest test suite (tests/sheet-packing.test.js).

/**
 * Expand a list of piece definitions into per-instance pieces
 * (one entry per unit of quantity) and sort by descending area.
 *
 * The FFD (First Fit Decreasing) contract requires the largest pieces
 * to be placed first, so we sort as part of this preparation step.
 *
 * @param {Array<{name: string, w: number, h: number, qty?: number, colour?: string}>} pieces
 * @returns {Array<{name: string, w: number, h: number, colour?: string}>}
 */
export function expandAndSort(pieces) {
    const expanded = [];
    for (const piece of pieces) {
        const qty = Number.isFinite(piece.qty) ? piece.qty : 1;
        for (let i = 0; i < qty; i++) {
            expanded.push({
                name: piece.name,
                w: piece.w,
                h: piece.h,
                colour: piece.colour,
            });
        }
    }
    expanded.sort((a, b) => (b.w * b.h) - (a.w * a.h));
    return expanded;
}

/**
 * Perform a guillotine split of a free rectangle after a piece is placed
 * in its top-left corner.
 *
 * The split produces two child rectangles: one to the right of the piece
 * (spanning the piece's height only) and one below the piece (spanning
 * the full width of the parent rectangle). This preserves the guillotine
 * constraint --- every cut goes edge to edge.
 *
 * @param {number} fitW    width of the piece as placed
 * @param {number} fitH    height of the piece as placed
 * @param {{name: string, w: number, h: number, colour?: string}} piece
 * @param {{x: number, y: number, w: number, h: number}} rect  the free rect being consumed
 * @param {number} rectIndex  index of rect inside freeRects
 * @param {Array<{x: number, y: number, w: number, h: number}>} freeRects
 * @param {number} kerf   blade width in mm to subtract between placements
 * @returns {{placedPiece: object, freeRects: Array}} new placement + updated free-rect list
 */
export function guillotineSplit(fitW, fitH, piece, rect, rectIndex, freeRects, kerf) {
    const newRects = freeRects.filter((_, idx) => idx !== rectIndex);

    const rightW = rect.w - fitW - kerf;
    if (rightW > 0) {
        newRects.push({ x: rect.x + fitW + kerf, y: rect.y, w: rightW, h: fitH });
    }

    const belowH = rect.h - fitH - kerf;
    if (belowH > 0) {
        newRects.push({ x: rect.x, y: rect.y + fitH + kerf, w: rect.w, h: belowH });
    }

    return {
        placedPiece: {
            name: piece.name,
            w: fitW,
            h: fitH,
            x: rect.x,
            y: rect.y,
            colour: piece.colour,
        },
        freeRects: newRects,
    };
}

/**
 * Attempt to place a piece into the first free rectangle it fits into
 * on a single sheet.
 *
 * Tries the natural orientation first, then a 90-degree rotation --- unless
 * rotation is disabled (which is the case for veneer sheets where the
 * grain direction must be preserved).
 *
 * @returns {{placedPiece: object, freeRects: Array} | null}
 */
export function tryPlace(piece, freeRects, kerf, noRotate) {
    for (let i = 0; i < freeRects.length; i++) {
        const r = freeRects[i];

        if (piece.w <= r.w && piece.h <= r.h) {
            return guillotineSplit(piece.w, piece.h, piece, r, i, freeRects, kerf);
        }

        if (!noRotate && piece.h <= r.w && piece.w <= r.h) {
            return guillotineSplit(piece.h, piece.w, piece, r, i, freeRects, kerf);
        }
    }
    return null;
}

/**
 * Pack a list of pieces onto as few sheets as possible using FFD +
 * Guillotine Split.
 *
 * @param {object} params
 * @param {Array} params.pieces      piece definitions (with qty)
 * @param {number} params.sheetW     sheet width in mm
 * @param {number} params.sheetH     sheet height in mm
 * @param {number} [params.kerf=3]   saw kerf width in mm
 * @param {boolean} [params.noRotate=false]  disable rotation (veneer)
 * @returns {{sheets: Array<{placed: Array, freeRects: Array}>, allPieces: Array}}
 */
export function packSheets({ pieces, sheetW, sheetH, kerf = 3, noRotate = false }) {
    if (!Array.isArray(pieces) || pieces.length === 0) {
        return { sheets: [], allPieces: [] };
    }
    if (!(sheetW > 0) || !(sheetH > 0)) {
        throw new RangeError('Sheet dimensions must be positive.');
    }

    const allPieces = expandAndSort(pieces);
    const sheets = [];

    for (const piece of allPieces) {
        let placed = false;

        for (const sheet of sheets) {
            const result = tryPlace(piece, sheet.freeRects, kerf, noRotate);
            if (result) {
                sheet.placed.push(result.placedPiece);
                sheet.freeRects = result.freeRects;
                placed = true;
                break;
            }
        }

        if (!placed) {
            const newSheet = {
                placed: [],
                freeRects: [{ x: 0, y: 0, w: sheetW, h: sheetH }],
            };
            const result = tryPlace(piece, newSheet.freeRects, kerf, noRotate);
            if (result) {
                newSheet.placed.push(result.placedPiece);
                newSheet.freeRects = result.freeRects;
            }
            sheets.push(newSheet);
        }
    }

    return { sheets, allPieces };
}

/**
 * Compute material efficiency as (total piece area / total sheet area).
 *
 * @param {Array} placedPieces  flat list of every placed piece
 * @param {number} sheetCount   number of sheets used
 * @param {number} sheetW
 * @param {number} sheetH
 * @returns {number}  efficiency as a fraction in [0, 1]
 */
export function calculateEfficiency(placedPieces, sheetCount, sheetW, sheetH) {
    if (sheetCount <= 0) return 0;
    const totalPieceArea = placedPieces.reduce((sum, p) => sum + p.w * p.h, 0);
    const totalSheetArea = sheetCount * sheetW * sheetH;
    return totalPieceArea / totalSheetArea;
}
