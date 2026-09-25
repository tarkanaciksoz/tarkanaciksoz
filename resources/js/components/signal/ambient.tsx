import { useEffect, useRef } from 'react';

/*
 * The page's background. Two layers on one canvas:
 *
 * 1. Bits: sparse 0s and 1s falling. When one flips it glitches for a few
 *    frames — noise characters, split red and cyan — before it settles.
 * 2. A byte war, after Core War (1984): the screen is a memory grid, and two
 *    factions of tiny programs fight in it. Imps crawl forward copying themselves
 *    and leave a trail of bytes; dwarfs drop 00 bombs at a fixed stride. An imp that
 *    steps onto an enemy bomb dies (SIGSEGV); an imp that runs over an enemy dwarf's
 *    code takes it over (pwned). The dead respawn somewhere else.
 *
 * 30 fps, paused while the tab is hidden, a single still frame for reduced motion.
 */

type Side = 0 | 1; // 0 white, 1 red
type Bit = { x: number; y: number; vy: number; ch: string; a: number; size: number; red: boolean; glitch: number };
type Proc = { kind: 'imp' | 'dwarf'; side: Side; pos: number; stride: number; k: number; alive: boolean; respawn: number };
type Label = { x: number; y: number; text: string; side: Side; life: number };

const NOISE = '#%&@$*+=<>/\\|{}[]?!';
const CELL_W = 24;
const CELL_H = 18;
const TICK_MS = 150;
// Kept deliberately sparse: this sits behind text.
const TRAIL_TTL = 3.5;
const BOMB_TTL = 6;
const DWARF_EVERY = 3;

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
        let dpr = 1;
        let cols = 0;
        let rows = 0;
        let N = 0;

        // Core memory: one byte per cell, who wrote it, what it is, how old, whether it glitches.
        let value = new Uint8Array(0);
        let owner = new Int8Array(0); // -1 none, 0 white, 1 red
        let kind = new Uint8Array(0); // 0 empty, 1 trail, 2 bomb, 3 code
        let age = new Float32Array(0);
        let glitch = new Uint8Array(0);
        const live = new Set<number>();

        let bits: Bit[] = [];
        let procs: Proc[] = [];
        let labels: Label[] = [];
        let raf = 0;
        let last = 0;
        let lastTick = 0;
        let now = 0;

        const write = (i: number, v: number, side: Side, k: number) => {
            value[i] = v;
            owner[i] = side;
            kind[i] = k;
            age[i] = 0;
            live.add(i);
        };

        const shake = (i: number) => {
            for (let dy = 0; dy <= 0; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                    const c = (i % cols) + dx;
                    const r = Math.floor(i / cols) + dy;
                    if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
                    const j = r * cols + c;
                    glitch[j] = 8 + ((Math.random() * 6) | 0);
                    if (!kind[j]) write(j, (Math.random() * 256) | 0, owner[i] === 1 ? 1 : 0, 1);
                }
        };

        const say = (i: number, text: string, side: Side) => {
            labels.push({ x: (i % cols) * CELL_W, y: Math.floor(i / cols) * CELL_H - 4, text, side, life: 60 });
        };

        const spawn = (p: Proc) => {
            p.alive = true;
            p.pos = (Math.random() * N) | 0;
            p.k = 0;
            if (p.kind === 'dwarf') {
                // A dwarf is four cells of code; that is what an enemy imp can overwrite.
                for (let d = 0; d < 4; d++) write((p.pos + d) % N, [0x00, 0x01, 0x7a, 0x04][d], p.side, 3);
            }
        };

        const reset = () => {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            W = window.innerWidth;
            H = window.innerHeight;
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            canvas.style.width = `${W}px`;
            canvas.style.height = `${H}px`;

            cols = Math.max(8, Math.floor(W / CELL_W));
            rows = Math.max(8, Math.floor(H / CELL_H));
            N = cols * rows;
            value = new Uint8Array(N);
            owner = new Int8Array(N).fill(-1);
            kind = new Uint8Array(N);
            age = new Float32Array(N);
            glitch = new Uint8Array(N);
            live.clear();

            procs = [];
            for (const side of [0, 1] as Side[]) {
                procs.push({ kind: 'imp', side, pos: 0, stride: 1, k: 0, alive: false, respawn: 0 });
                procs.push({ kind: 'dwarf', side, pos: 0, stride: pick([5, 7, 9]), k: 0, alive: false, respawn: 0 });
            }
            procs.forEach(spawn);

            const count = Math.max(12, Math.min(36, Math.round((W * H) / 45000)));
            bits = Array.from({ length: count }, () => ({
                x: rand(0, W),
                y: rand(0, H),
                vy: rand(0.25, 0.75),
                ch: Math.random() < 0.5 ? '0' : '1',
                a: rand(0.05, 0.14),
                size: rand(9, 12),
                red: Math.random() < 0.07,
                glitch: 0,
            }));
        };

        // One instruction per process per tick.
        let tickCount = 0;
        const tick = () => {
            tickCount++;
            for (const p of procs) {
                if (!p.alive) {
                    if (now >= p.respawn) spawn(p);
                    continue;
                }

                if (p.kind === 'imp') {
                    const next = (p.pos + 1) % N;
                    if (kind[next] === 2 && owner[next] !== p.side) {
                        // Stepped on an enemy bomb.
                        p.alive = false;
                        p.respawn = now + rand(2500, 5000);
                        shake(next);
                        say(next, pick(['SIGSEGV', 'core dumped', 'segfault xd']), p.side);
                        continue;
                    }
                    if (kind[next] === 3 && owner[next] !== p.side) {
                        // Ran over an enemy dwarf's code: it now runs ours.
                        const victim = procs.find((q) => q.kind === 'dwarf' && q.alive && q.side !== p.side && (next - q.pos + N) % N < 4);
                        if (victim) {
                            victim.alive = false;
                            victim.respawn = now + rand(3000, 6000);
                            for (let d = 0; d < 4; d++) write((victim.pos + d) % N, 0x01, p.side, 1);
                            shake(next);
                            say(next, pick(['pwned', 'pwned xd', 'owned lol']), p.side);
                        }
                    }
                    write(p.pos, 0x01, p.side, 1); // MOV 0, 1 — the trail it leaves
                    p.pos = next;
                    glitch[p.pos] = 0;
                } else {
                    // DAT bomb at base + k * stride, skipping its own code, every few ticks.
                    if ((tickCount + (p.side === 1 ? 1 : 0)) % DWARF_EVERY !== 0) continue;
                    p.k++;
                    const target = (p.pos + 4 + p.k * p.stride) % N;
                    const victim = procs.find((q) => q.kind === 'imp' && q.alive && q.side !== p.side && q.pos === target);
                    write(target, 0x00, p.side, 2);
                    if (victim) {
                        victim.alive = false;
                        victim.respawn = now + rand(2500, 5000);
                        shake(target);
                        say(target, pick(['SIGSEGV', '0xDEAD', 'rip xd']), victim.side);
                    }
                    if (p.k * p.stride > N) p.k = 0;
                }
            }

            // Memory decays: trails fade in seconds, bombs last longer, code stays while it runs.
            for (const i of live) {
                age[i] += TICK_MS / 1000;
                const ttl = kind[i] === 1 ? TRAIL_TTL : kind[i] === 2 ? BOMB_TTL : 9999;
                if (age[i] > ttl && !glitch[i]) {
                    kind[i] = 0;
                    owner[i] = -1;
                    live.delete(i);
                }
            }
        };

        const step = () => {
            bits.forEach((b) => {
                b.y += b.vy;
                if (b.glitch > 0) b.glitch--;
                else if (Math.random() < 0.006) {
                    b.ch = b.ch === '0' ? '1' : '0';
                    b.glitch = 7;
                }
                if (b.y > H + 12) {
                    b.y = -12;
                    b.x = rand(0, W);
                }
            });
            labels = labels.filter((l) => {
                l.y -= 0.25;
                return --l.life > 0;
            });
            for (const i of live) if (glitch[i]) glitch[i]--;
        };

        const mono = (px: number) => `${px}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        const hex = (v: number) => v.toString(16).toUpperCase().padStart(2, '0');

        const draw = () => {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);
            ctx.textBaseline = 'top';

            // Core memory.
            ctx.font = mono(10);
            const heads = new Set(procs.filter((p) => p.alive && p.kind === 'imp').map((p) => p.pos));
            for (const i of live) {
                const x = (i % cols) * CELL_W + 3;
                const y = Math.floor(i / cols) * CELL_H + 3;
                const side = owner[i];
                const k = kind[i];
                const ttl = k === 1 ? TRAIL_TTL : k === 2 ? BOMB_TTL : 9999;
                const fade = k === 3 ? 1 : Math.max(0, 1 - age[i] / ttl);
                const base = k === 3 ? 0.2 : k === 2 ? 0.15 : 0.08;
                const a = base * fade;
                if (a < 0.01 && !glitch[i]) continue;

                const rgb = side === 1 ? '255,59,48' : '255,255,255';
                if (glitch[i]) {
                    const t = pick([...NOISE]) + pick([...NOISE]);
                    ctx.fillStyle = 'rgba(255,59,48,0.32)';
                    ctx.fillText(t, x - 2, y);
                    ctx.fillStyle = 'rgba(34,211,238,0.28)';
                    ctx.fillText(t, x + 2, y);
                    ctx.fillStyle = `rgba(${rgb},0.35)`;
                    ctx.fillText(t, x, y);
                } else {
                    ctx.fillStyle = `rgba(${rgb},${a.toFixed(3)})`;
                    ctx.fillText(hex(value[i]), x, y);
                }
            }

            // Imp heads: a bright cursor on the cell it is about to execute.
            for (const p of procs) {
                if (!p.alive || p.kind !== 'imp' || !heads.has(p.pos)) continue;
                const x = (p.pos % cols) * CELL_W + 2;
                const y = Math.floor(p.pos / cols) * CELL_H + 2;
                ctx.fillStyle = p.side === 1 ? 'rgba(255,59,48,0.4)' : 'rgba(255,255,255,0.3)';
                ctx.fillRect(x, y, 14, 12);
            }

            // Falling bits, glitching as they flip.
            for (const b of bits) {
                ctx.font = mono(b.size);
                const rgb = b.red ? '255,59,48' : '255,255,255';
                if (b.glitch > 0) {
                    const c = b.glitch > 2 ? pick([...NOISE, '0', '1']) : b.ch;
                    const off = 1 + (b.glitch % 3);
                    ctx.fillStyle = `rgba(255,59,48,${(b.a * 2).toFixed(3)})`;
                    ctx.fillText(c, b.x - off, b.y);
                    ctx.fillStyle = `rgba(34,211,238,${(b.a * 1.8).toFixed(3)})`;
                    ctx.fillText(c, b.x + off, b.y + 0.5);
                    ctx.fillStyle = `rgba(${rgb},${Math.min(0.5, b.a * 2.4).toFixed(3)})`;
                    ctx.fillText(c, b.x, b.y);
                } else {
                    ctx.fillStyle = `rgba(${rgb},${b.a.toFixed(3)})`;
                    ctx.fillText(b.ch, b.x, b.y);
                }
            }

            ctx.font = mono(9);
            for (const l of labels) {
                ctx.fillStyle = l.side === 1 ? `rgba(255,59,48,${Math.min(0.45, l.life / 60)})` : `rgba(255,255,255,${Math.min(0.35, l.life / 60)})`;
                ctx.fillText(l.text, l.x, l.y);
            }
        };

        const loop = (t: number) => {
            raf = requestAnimationFrame(loop);
            if (document.hidden || t - last < 33) return;
            last = t;
            now = t;
            if (t - lastTick >= TICK_MS) {
                lastTick = t;
                tick();
            }
            step();
            draw();
        };

        reset();
        window.addEventListener('resize', reset);
        if (reduced) {
            // A still frame with some history in it.
            now = performance.now();
            for (let i = 0; i < 120; i++) tick();
            draw();
        } else raf = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', reset);
        };
    }, []);

    return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true" />;
}
