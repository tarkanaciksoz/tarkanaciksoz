// Shared by every chapter; kept apart from field.ts so importing them never pulls in Three.js.

/**
 * Where every bit should be this frame. A chapter (one section of the page)
 * fills these arrays; the field springs each bit toward its target, so a change
 * of chapter becomes a flight, never a cut. Positions are CSS pixels in the
 * viewport, the same space as getBoundingClientRect().
 */
export type Targets = {
    n: number;
    vw: number;
    vh: number;
    x: Float32Array;
    y: Float32Array;
    /** 0..1 */
    a: Float32Array;
    r: Float32Array;
    g: Float32Array;
    b: Float32Array;
    /** Point size in CSS pixels. */
    s: Float32Array;
    /** 0 draws the bit as a 0/1 glyph, 1 as a solid square. */
    sq: Float32Array;
    /** Stable per-bit random numbers, for layouts that must not shuffle every frame. */
    seed: Float32Array;
    seed2: Float32Array;
    pointer: { x: number; y: number };
    /** Parks bits [from, to) in the faint background scatter. */
    rest: (from: number, to: number) => void;
};

export type ChapterFrame = (t: Targets, time: number) => void;

export const WHITE: [number, number, number] = [0.9, 0.9, 0.92];
export const RED: [number, number, number] = [1, 0.23, 0.19];
export const CYAN: [number, number, number] = [0.13, 0.83, 0.93];
