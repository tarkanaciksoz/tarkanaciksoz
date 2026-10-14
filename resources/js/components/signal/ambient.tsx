import { contentScrollY } from '@/lib/gsap';
import { useEffect, useRef } from 'react';

/*
 * The page's background, anchored to the document so it scrolls away with the content.
 *
 * 1. Bits: sparse 0s and 1s drifting down. When one flips it glitches for a few
 *    frames (noise glyphs, split red and cyan) before it settles.
 * 2. Light: now and then a streak crosses the page at any angle, from any edge: a bright
 *    head and a trail of short dashes, its red and cyan channels split to either side. Now and then two are timed to reach the same
 *    point, head-on or crossing. The frame they carried is lost: a few of its bytes spill
 *    out, scrambled at first, and drift apart; the bits nearby glitch for a moment.
 *
 * Only what is on screen is drawn; new light is spawned where the reader is looking.
 */

type Bit = { x: number; y: number; vy: number; ch: string; a: number; size: number; color: string; glitch: number };
type Streak = { x: number; y: number; vx: number; vy: number; len: number; life: number; alive: boolean; color: string };
type Pair = { a: Streak; b: Streak; x: number; y: number; frames: number };
type Drop = { x: number; y: number; vx: number; vy: number; text: string; life: number; max: number; color: string };

const NOISE = '#%&@$*+=<>/\\|{}[]?!';
const RED = '255,59,48';
const CYAN = '34,211,238';
const WHITE = '255,255,255';
/** Each streak carries its own colour; red and cyan stay as the glitch split. */
const COLORS = [RED, CYAN, WHITE, '251,191,36', '62,207,142', '167,139,250', '244,114,182'];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[(Math.random() * xs.length) | 0];

export function Ambient() {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = ref.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let W = 0;
        let H = 0;
        let docH = 0;
        let dpr = 1;
        let bits: Bit[] = [];
        let streaks: Streak[] = [];
        let pairs: Pair[] = [];
        let drops: Drop[] = [];
        let raf = 0;
        let lastStep = 0;
        let nextLone = 0;
        let nextPair = 0;

        const addBits = (from: number, to: number) => {
            const count = Math.round((W * (to - from)) / 75000);
            for (let i = 0; i < count; i++) {
                bits.push({
                    x: rand(0, W),
                    y: rand(from, to),
                    vy: rand(0.12, 0.35),
                    ch: Math.random() < 0.5 ? '0' : '1',
                    a: rand(0.05, 0.13),
                    // Three sizes only, so a frame sets the canvas font three times, not once per bit.
                    size: pick([9, 10.5, 12]),
                    color: Math.random() < 0.12 ? pick(COLORS) : WHITE,
                    glitch: 0,
                });
            }
            bits.sort((p, q) => p.size - q.size);
        };

        const layout = () => {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            const widthChanged = window.innerWidth !== W;
            W = window.innerWidth;
            H = window.innerHeight;
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            canvas.style.width = `${W}px`;
            canvas.style.height = `${H}px`;

            const nextDoc = Math.max(document.documentElement.scrollHeight, H);
            if (widthChanged || !bits.length) {
                bits = [];
                addBits(0, nextDoc);
            } else if (nextDoc > docH) {
                addBits(docH, nextDoc);
            }
            docH = nextDoc;
        };

        /** A point somewhere in the visible part of the page, in document coordinates. */
        const pointInView = (margin = 0.12) => ({ x: rand(margin, 1 - margin) * W, y: contentScrollY() + rand(margin, 1 - margin) * H });
        const diag = () => Math.hypot(W, H);

        /** One streak at a random angle, entering from off-screen and crossing the view. */
        const spawnLone = () => {
            const angle = rand(0, Math.PI * 2);
            const speed = rand(3, 5.5);
            const through = pointInView(0.2);
            const back = diag() * 0.6;
            streaks.push({
                x: through.x - Math.cos(angle) * back,
                y: through.y - Math.sin(angle) * back,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                len: rand(50, 110),
                life: Math.ceil((back * 2.2) / speed),
                alive: true,
                color: pick(COLORS),
            });
        };

        /**
         * Two streaks timed to reach the same point in the same frame: sometimes
         * head-on, sometimes crossing at an angle.
         */
        const spawnPair = () => {
            const meet = pointInView(0.18);
            const frames = Math.round(rand(80, 130));
            const a = rand(0, Math.PI * 2);
            const b = a + Math.PI + rand(-1.2, 1.2);
            const ca = pick(COLORS);
            const cb = pick(COLORS.filter((c) => c !== ca));
            const make = (angle: number, color: string): Streak => {
                const dist = diag() * rand(0.45, 0.7);
                const speed = dist / frames;
                return {
                    x: meet.x - Math.cos(angle) * dist,
                    y: meet.y - Math.sin(angle) * dist,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    len: rand(55, 105),
                    life: frames + 2,
                    alive: true,
                    color,
                };
            };
            const pair = { a: make(a, ca), b: make(b, cb), x: meet.x, y: meet.y, frames };
            streaks.push(pair.a, pair.b);
            pairs.push(pair);
        };

        const byte = () => ((Math.random() * 256) | 0).toString(16).toUpperCase().padStart(2, '0');

        /**
         * Two signals hit the same point: the frame they carried is lost and its bytes
         * spill out, scrambled at first, then settling as they drift apart and fade.
         * The nearest bits pick up the interference and glitch.
         */
        const collide = (x: number, y: number, colors: string[]) => {
            const n = 4 + ((Math.random() * 3) | 0);
            for (let i = 0; i < n; i++) {
                const angle = rand(0, Math.PI * 2);
                const v = rand(0.25, 0.7);
                const max = Math.round(rand(80, 120));
                drops.push({
                    x,
                    y,
                    vx: Math.cos(angle) * v,
                    vy: Math.sin(angle) * v,
                    text: byte(),
                    life: max,
                    max,
                    color: colors[i % colors.length],
                });
            }
            for (const b of bits) if (Math.abs(b.x - x) < 80 && Math.abs(b.y - y) < 50) b.glitch = 8;
        };

        const step = (now: number) => {
            for (const b of bits) {
                b.y += b.vy;
                if (b.glitch > 0) b.glitch--;
                else if (Math.random() < 0.006) {
                    b.ch = b.ch === '0' ? '1' : '0';
                    b.glitch = 7;
                }
                if (b.y > docH) {
                    b.y = -12;
                    b.x = rand(0, W);
                }
            }

            if (now >= nextLone) {
                spawnLone();
                nextLone = now + rand(9000, 16000);
            }
            if (now >= nextPair) {
                spawnPair();
                nextPair = now + rand(16000, 28000);
            }

            for (const s of streaks) {
                if (!s.alive) continue;
                s.x += s.vx;
                s.y += s.vy;
                if (--s.life <= 0) s.alive = false;
            }
            pairs = pairs.filter((p) => {
                if (--p.frames > 0) return true;
                if (p.a.alive || p.b.alive) {
                    p.a.alive = false;
                    p.b.alive = false;
                    collide(p.x, p.y, [p.a.color, p.b.color]);
                }
                return false;
            });
            streaks = streaks.filter((s) => s.alive);

            drops = drops.filter((d) => {
                d.x += d.vx;
                d.y += d.vy;
                d.vx *= 0.985;
                d.vy *= 0.985;
                // Scrambled for the first third of its life, then it holds its value.
                if (d.life > d.max * 0.66 && Math.random() < 0.35) d.text = byte();
                return --d.life > 0;
            });
        };

        const mono = (px: number) => `${px}px "Geist Mono", ui-monospace, monospace`;

        const draw = () => {
            const sy = contentScrollY();
            const top = sy - 20;
            const bottom = sy + H + 20;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);
            ctx.textBaseline = 'top';

            let font = 0;
            for (const b of bits) {
                if (b.y < top || b.y > bottom) continue;
                const y = b.y - sy;
                if (b.size !== font) {
                    font = b.size;
                    ctx.font = mono(font);
                }
                const rgb = b.color;
                if (b.glitch > 0) {
                    const c = b.glitch > 2 ? pick([...NOISE, '0', '1']) : b.ch;
                    const off = 1 + (b.glitch % 3);
                    ctx.fillStyle = `rgba(${RED},${(b.a * 2.2).toFixed(3)})`;
                    ctx.fillText(c, b.x - off, y);
                    ctx.fillStyle = `rgba(${CYAN},${(b.a * 2).toFixed(3)})`;
                    ctx.fillText(c, b.x + off, y + 0.5);
                    ctx.fillStyle = `rgba(${rgb},${Math.min(0.5, b.a * 2.6).toFixed(3)})`;
                    ctx.fillText(c, b.x, y);
                } else {
                    ctx.fillStyle = `rgba(${rgb},${b.a.toFixed(3)})`;
                    ctx.fillText(b.ch, b.x, y);
                }
            }

            // Streaks: the tear-line gradient, head first.
            // Streaks: a bright head and a trail of short dashes, like bits in flight,
            // with the red and cyan channels split to either side of it.
            for (const s of streaks) {
                if (s.y < top - 160 || s.y > bottom + 160) continue;
                const speed = Math.hypot(s.vx, s.vy) || 1;
                const ux = s.vx / speed;
                const uy = s.vy / speed;
                const px = -uy;
                const py = ux;
                const hx = s.x;
                const hy = s.y - sy;
                const dash = 5;
                const gap = 4;

                ctx.lineWidth = 1;
                for (let d = 3; d < s.len; d += dash + gap) {
                    const fade = 1 - d / s.len;
                    const x1 = hx - ux * d;
                    const y1 = hy - uy * d;
                    const x2 = hx - ux * Math.min(s.len, d + dash);
                    const y2 = hy - uy * Math.min(s.len, d + dash);
                    for (const [rgb, off, a] of [
                        [RED, 1.2, 0.22],
                        [CYAN, -1.2, 0.2],
                        [s.color, 0, 0.7],
                    ] as const) {
                        ctx.strokeStyle = `rgba(${rgb},${(a * fade).toFixed(3)})`;
                        ctx.beginPath();
                        ctx.moveTo(x1 + px * off, y1 + py * off);
                        ctx.lineTo(x2 + px * off, y2 + py * off);
                        ctx.stroke();
                    }
                }
                ctx.fillStyle = `rgba(${s.color},0.95)`;
                ctx.fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 2, 2);
                ctx.fillStyle = `rgba(${WHITE},0.9)`;
                ctx.fillRect(Math.round(hx), Math.round(hy), 1, 1);
            }

            ctx.font = mono(10);
            for (const d of drops) {
                if (d.y < top || d.y > bottom) continue;
                const a = Math.min(0.6, (d.life / d.max) * 0.75);
                ctx.fillStyle = `rgba(${d.color},${a.toFixed(3)})`;
                ctx.fillText(d.text, Math.round(d.x), Math.round(d.y - sy));
            }
        };

        const loop = (t: number) => {
            raf = requestAnimationFrame(loop);
            if (document.hidden) return;
            if (t - lastStep >= 16) {
                lastStep = t;
                step(t);
            }
            draw();
        };

        layout();
        window.addEventListener('resize', layout);
        const observer = new ResizeObserver(layout);
        observer.observe(document.body);

        if (reduced) {
            // Nothing moves, so only redraw when the page has scrolled.
            let lastY = -1;
            const still = () => {
                raf = requestAnimationFrame(still);
                if (contentScrollY() === lastY) return;
                lastY = contentScrollY();
                draw();
            };
            raf = requestAnimationFrame(still);
        } else {
            nextLone = performance.now() + 1200;
            nextPair = performance.now() + 2500;
            raf = requestAnimationFrame(loop);
        }

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', layout);
            observer.disconnect();
        };
    }, []);

    return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true" />;
}
