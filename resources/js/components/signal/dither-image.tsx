import { gsap, prefersReducedMotion } from '@/lib/gsap';
import { useEffect, useRef } from 'react';

/** Ordered 8x8 Bayer matrix: the threshold pattern that turns grey into 1-bit dots. */
const BAYER = [
    0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33,
    9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
].map((n) => (n + 0.5) / 64);

const DOT = 3; // CSS pixels per dither dot
const INK = [228, 228, 231];
const RED = [255, 59, 48];
const CYAN = [34, 211, 238];

type Props = { src: string; alt: string; className?: string };

/**
 * A photograph reduced to 1-bit dots, the way the rest of the page draws.
 * It decodes in the first time it is seen (the threshold falls from all-dark to
 * the real picture) and tears in red and cyan under the pointer.
 */
export function DitherImage({ src, alt, className = '' }: Props) {
    const wrap = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const box = wrap.current;
        const el = canvas.current;
        if (!box || !el) return;
        const ctx = el.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const reduced = prefersReducedMotion();
        const state = { bias: reduced ? 0 : 1, tear: 0 };
        let lum: Float32Array | null = null;
        let cols = 0;
        let rows = 0;
        let image: HTMLImageElement | null = null;
        let seen = reduced;

        const sample = () => {
            if (!image) return;
            cols = Math.max(8, Math.round(box.clientWidth / DOT));
            rows = Math.max(8, Math.round(box.clientHeight / DOT));
            el.width = cols;
            el.height = rows;
            // Cover-fit the photograph into the box, then read its brightness per dot.
            const scale = Math.max(cols / image.naturalWidth, rows / image.naturalHeight);
            const w = image.naturalWidth * scale;
            const h = image.naturalHeight * scale;
            ctx.drawImage(image, (cols - w) / 2, (rows - h) / 2, w, h);
            const px = ctx.getImageData(0, 0, cols, rows).data;
            lum = new Float32Array(cols * rows);
            for (let i = 0; i < lum.length; i++) {
                const v = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
                // Black point first, so a dark background stays empty instead of turning into a dot grid.
                lum[i] = Math.min(1, Math.pow(Math.max(0, (v - 0.1) / 0.9), 0.8) * 1.25);
            }
            draw();
        };

        const draw = () => {
            if (!lum) return;
            const out = ctx.createImageData(cols, rows);
            const d = out.data;
            const tearing = state.tear > 0.02;
            for (let y = 0; y < rows; y++) {
                // While tearing, whole bands slip sideways and pick up the split colours.
                const band = tearing && Math.random() < state.tear * 0.35;
                const shift = band ? Math.round((Math.random() - 0.5) * 18 * state.tear) : 0;
                const tint = band ? (Math.random() < 0.5 ? RED : CYAN) : INK;
                for (let x = 0; x < cols; x++) {
                    const sx = Math.min(cols - 1, Math.max(0, x + shift));
                    const v = lum[y * cols + sx];
                    if (v <= BAYER[(y % 8) * 8 + (x % 8)] + state.bias) continue;
                    const o = (y * cols + x) * 4;
                    d[o] = tint[0];
                    d[o + 1] = tint[1];
                    d[o + 2] = tint[2];
                    d[o + 3] = 255;
                }
            }
            ctx.putImageData(out, 0, 0);
        };

        const decode = () => {
            if (seen) return;
            seen = true;
            gsap.to(state, { bias: 0, duration: 1.6, ease: 'power2.out', onUpdate: draw });
        };

        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
            image = img;
            sample();
        };
        img.src = src;

        // Transformed parents (the sideways track) still report true geometry to an observer.
        const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && decode(), { threshold: 0.35 });
        io.observe(box);

        let timer = 0;
        const ro = new ResizeObserver(() => {
            window.clearTimeout(timer);
            timer = window.setTimeout(sample, 120);
        });
        ro.observe(box);

        const tear = () => {
            if (reduced || !seen) return;
            gsap.fromTo(state, { tear: 1 }, { tear: 0, duration: 0.45, ease: 'steps(6)', onUpdate: draw, overwrite: true });
        };
        box.addEventListener('pointerenter', tear);

        return () => {
            io.disconnect();
            ro.disconnect();
            window.clearTimeout(timer);
            box.removeEventListener('pointerenter', tear);
            gsap.killTweensOf(state);
            img.onload = null;
        };
    }, [src]);

    return (
        <div ref={wrap} className={`relative overflow-hidden ${className}`}>
            <canvas ref={canvas} role="img" aria-label={alt} className="absolute inset-0 h-full w-full [image-rendering:pixelated]" />
        </div>
    );
}
