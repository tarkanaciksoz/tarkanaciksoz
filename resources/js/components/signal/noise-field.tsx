import { useEffect, useRef } from 'react';
import { useReducedMotion } from './use-reduced-motion';

type Props = {
    className?: string;
    /** 0..1 — share of cells lit. Tie it to something real (unattributed ms / total). */
    density?: number;
    cell?: number;
    tone?: string;
};

/**
 * 1-bit static. Used where the honest answer is "unaccounted for": the time the
 * tracer could not assign to any span renders as noise, sized by how much of it there was.
 */
export function NoiseField({ className, density = 0.18, cell = 3, tone = '255,255,255' }: Props) {
    const ref = useRef<HTMLCanvasElement>(null);
    const reduced = useReducedMotion();

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let frame = 0;
        let last = 0;

        const draw = (now: number) => {
            const { width, height } = canvas.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            if (canvas.width !== Math.round(width * dpr)) {
                canvas.width = Math.round(width * dpr);
                canvas.height = Math.round(height * dpr);
            }

            if (now - last > 90) {
                last = now;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, width, height);
                for (let y = 0; y < height; y += cell) {
                    for (let x = 0; x < width; x += cell) {
                        if (Math.random() < density) {
                            ctx.fillStyle = `rgba(${tone},${(0.25 + Math.random() * 0.55).toFixed(2)})`;
                            ctx.fillRect(x, y, cell - 1, cell - 1);
                        }
                    }
                }
            }

            if (!reduced) frame = requestAnimationFrame(draw);
        };

        frame = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frame);
    }, [density, cell, tone, reduced]);

    return <canvas ref={ref} className={className} aria-hidden="true" />;
}
