import { useEffect, useRef, type RefObject } from 'react';
import { sampleText } from './shapes';
import { useBitChapter } from './stage';
import { RED, WHITE, type Targets } from './types';

type Box = { x: number; y: number; w: number; h: number };

const COLS = 140;
const FONT = '{size} "Geist Pixel", "Geist Mono", monospace';

/**
 * A chapter in which the bits spell something: the open rule's number, the last
 * status code. Text is sampled once per string, after the pixel font has loaded,
 * and drawn into a box placed in the viewport.
 */
export function useTextFormation(
    id: string,
    section: RefObject<HTMLElement | null>,
    text: string | null,
    place: (vw: number, vh: number) => Box | null,
    redShare = 0.5,
    alpha = 0.55,
) {
    const cache = useRef(new Map<string, Float32Array>());
    const ready = useRef(false);

    useEffect(() => {
        let alive = true;
        document.fonts
            ?.load('200px "Geist Pixel"')
            .catch(() => undefined)
            .then(() => alive && (ready.current = true));
        return () => {
            alive = false;
        };
    }, []);

    useBitChapter(id, section, (t: Targets) => {
        const box = place(t.vw, t.vh);
        if (!text || !box || !ready.current) return t.rest(0, t.n);
        const aspect = box.w / box.h;
        const key = `${text}|${aspect.toFixed(2)}`;
        let dots = cache.current.get(key);
        if (!dots) {
            dots = sampleText(text, FONT, COLS, aspect);
            cache.current.set(key, dots);
        }
        const cell = box.w / COLS;
        const m = Math.min(t.n, dots.length / 2);
        for (let i = 0; i < m; i++) {
            const red = t.seed2[i] < redShare;
            const [r, g, b] = red ? RED : WHITE;
            t.x[i] = box.x + dots[i * 2] * box.w;
            t.y[i] = box.y + dots[i * 2 + 1] * box.h;
            t.a[i] = red ? Math.min(1, alpha + 0.2) : alpha;
            t.r[i] = r;
            t.g[i] = g;
            t.b[i] = b;
            t.s[i] = cell * 0.8;
            t.sq[i] = 1;
        }
        t.rest(m, t.n);
    });
}
