import { useEffect, useRef } from 'react';

/*
 * The page's background, anchored to the document so it scrolls away with the content.
 *
 * 1. Bits: sparse 0s and 1s drifting down. When one flips it glitches for a few
 *    frames (noise glyphs, split red and cyan) before it settles.
 * 2. Light: a few hairline streaks in the tear-line colours (red, white, cyan) crossing
 *    the page at any angle, from any edge. Now and then two are timed to reach the same
 *    point — head-on or crossing — and burst into a handful of sparks; the bits nearby
 *    glitch for a moment.
 *
 * Only what is on screen is drawn; new light is spawned where the reader is looking.
 */

type Bit = { x: number; y: number; vy: number; ch: string; a: number; size: number; red: boolean; glitch: number };
type Streak = { x: number; y: number; vx: number; vy: number; len: number; life: number; alive: boolean };
type Pair = { a: Streak; b: Streak; x: number; y: number; frames: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string };
type Flash = { x: number; y: number; life: number };

const NOISE = '#%&@$*+=<>/\\|{}[]?!';
const RED = '255,59,48';
const CYAN = '34,211,238';
const WHITE = '255,255,255';

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
        let sparks: Spark[] = [];
        let flashes: Flash[] = [];
        let raf = 0;
        let lastStep = 0;
        let nextLone = 0;
        let nextPair = 0;

        const addBits = (from: number, to: number) => {
            const count = Math.round((W * (to - from)) / 50000);
            for (let i = 0; i < count; i++) {
                bits.push({
                    x: rand(0, W),
                    y: rand(from, to),
                    vy: rand(0.12, 0.35),
                    ch: Math.random() < 0.5 ? '0' : '1',
                    a: rand(0.05, 0.13),
                    size: rand(9, 12),
                    red: Math.random() < 0.07,
                    glitch: 0,
                });
            }
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
        const pointInView = (margin = 0.12) => ({ x: rand(margin, 1 - margin) * W, y: window.scrollY + rand(margin, 1 - margin) * H });
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
                len: rand(60, 140),
                life: Math.ceil((back * 2.2) / speed),
                alive: true,
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
            const make = (angle: number): Streak => {
                const dist = diag() * rand(0.45, 0.7);
                const speed = dist / frames;
                return {
                    x: meet.x - Math.cos(angle) * dist,
                    y: meet.y - Math.sin(angle) * dist,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    len: rand(70, 130),
                    life: frames + 2,
                    alive: true,
                };
            };
            const pair = { a: make(a), b: make(b), x: meet.x, y: meet.y, frames };
            streaks.push(pair.a, pair.b);
            pairs.push(pair);
        };

        const explode = (x: number, y: number) => {
            flashes.push({ x, y, life: 10 });
            const n = 14 + ((Math.random() * 10) | 0);
            for (let i = 0; i < n; i++) {
                const angle = rand(0, Math.PI * 2);
                const v = rand(0.6, 2.8);
                const max = rand(18, 40);
                sparks.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v * 0.6, life: max, max, color: pick([RED, RED, WHITE, CYAN]) });
            }
            // The shock reaches the nearest bits: they glitch.
            for (const b of bits) if (Math.abs(b.x - x) < 90 && Math.abs(b.y - y) < 60) b.glitch = 9;
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
                nextLone = now + rand(5000, 9000);
            }
            if (now >= nextPair) {
                spawnPair();
                nextPair = now + rand(9000, 16000);
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
                    explode(p.x, p.y);
                }
                return false;
            });
            streaks = streaks.filter((s) => s.alive);

            sparks = sparks.filter((sp) => {
                sp.x += sp.vx;
                sp.y += sp.vy;
                sp.vx *= 0.96;
                sp.vy *= 0.96;
                return --sp.life > 0;
            });
            flashes = flashes.filter((f) => --f.life > 0);
        };

        const mono = (px: number) => `${px}px ui-monospace, SFMono-Regular, Menlo, monospace`;

        const draw = () => {
            const sy = window.scrollY;
            const top = sy - 20;
            const bottom = sy + H + 20;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);
            ctx.textBaseline = 'top';

            for (const b of bits) {
                if (b.y < top || b.y > bottom) continue;
                const y = b.y - sy;
                ctx.font = mono(b.size);
                const rgb = b.red ? RED : WHITE;
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
            for (const s of streaks) {
                if (s.y < top - 160 || s.y > bottom + 160) continue;
                const speed = Math.hypot(s.vx, s.vy) || 1;
                const hx = s.x;
                const hy = s.y - sy;
                const tx = hx - (s.vx / speed) * s.len;
                const ty = hy - (s.vy / speed) * s.len;
                const g = ctx.createLinearGradient(tx, ty, hx, hy);
                g.addColorStop(0, `rgba(${RED},0)`);
                g.addColorStop(0.35, `rgba(${RED},0.55)`);
                g.addColorStop(0.72, `rgba(${WHITE},0.8)`);
                g.addColorStop(0.9, `rgba(${CYAN},0.7)`);
                g.addColorStop(1, `rgba(${CYAN},0)`);
                ctx.strokeStyle = g;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.lineTo(hx, hy);
                ctx.stroke();
                ctx.fillStyle = `rgba(${WHITE},0.85)`;
                ctx.fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 2, 2);
            }

            for (const f of flashes) {
                if (f.y < top || f.y > bottom) continue;
                const r = (10 - f.life) * 1.8 + 2;
                ctx.fillStyle = `rgba(${WHITE},${(f.life / 10) * 0.35})`;
                ctx.beginPath();
                ctx.arc(f.x, f.y - sy, r, 0, Math.PI * 2);
                ctx.fill();
            }

            for (const sp of sparks) {
                if (sp.y < top || sp.y > bottom) continue;
                ctx.fillStyle = `rgba(${sp.color},${Math.min(0.9, (sp.life / sp.max) * 1.1).toFixed(3)})`;
                ctx.fillRect(Math.round(sp.x), Math.round(sp.y - sy), 1.5, 1.5);
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
            draw();
            window.addEventListener('scroll', draw, { passive: true });
        } else {
            nextLone = performance.now() + 1200;
            nextPair = performance.now() + 2500;
            raf = requestAnimationFrame(loop);
        }

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', layout);
            window.removeEventListener('scroll', draw);
            observer.disconnect();
        };
    }, []);

    return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true" />;
}
