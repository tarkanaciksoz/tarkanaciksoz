import type { StackLayer } from '@/types/portfolio';

export const BOARD = { w: 1200, h: 650 };
export const CHIP = { w: 150, h: 42 };
const LEFT = 168;
const COL = 170;
const TOP = 34;
const ROW = 87;

export type ChipBox = { id: number; row: number; col: number; x: number; y: number; cx: number; cy: number };

/** Where every tool sits on the board: one row per layer, in the order the API returns them. */
export function placeChips(layers: StackLayer[]): Map<number, ChipBox> {
    const out = new Map<number, ChipBox>();
    layers.forEach((layer, row) => {
        layer.items.forEach((item, col) => {
            const x = LEFT + col * COL;
            const y = TOP + row * ROW;
            out.set(item.id, { id: item.id, row, col, x, y, cx: x + CHIP.w / 2, cy: y + CHIP.h / 2 });
        });
    });
    return out;
}

export const rowY = (row: number) => TOP + row * ROW;

/**
 * An orthogonal trace between two chips, routed the way a board is: out of one
 * chip's edge into the corridor between rows, sideways to the gutter beside the
 * target column, along the gutter (never through a chip), and into the target.
 * `lane` nudges hops that share a corridor apart so they stay readable.
 */
export function route(a: ChipBox, b: ChipBox, lane: number): string {
    const n = (lane % 4) * 3 - 4;
    const gutter = b.x - 10 + n / 2;

    if (a.row === b.row) {
        const y = a.y + CHIP.h + 12 + n;
        return `M ${a.cx} ${a.y + CHIP.h} L ${a.cx} ${y} L ${b.cx} ${y} L ${b.cx} ${b.y + CHIP.h}`;
    }

    if (b.row > a.row) {
        const out = a.y + CHIP.h + 12 + n;
        const inn = b.y - 12 + n;
        return `M ${a.cx} ${a.y + CHIP.h} L ${a.cx} ${out} L ${gutter} ${out} L ${gutter} ${inn} L ${b.cx} ${inn} L ${b.cx} ${b.y}`;
    }

    const out = a.y - 12 + n;
    const inn = b.y + CHIP.h + 12 + n;
    return `M ${a.cx} ${a.y} L ${a.cx} ${out} L ${gutter} ${out} L ${gutter} ${inn} L ${b.cx} ${inn} L ${b.cx} ${b.y + CHIP.h}`;
}
