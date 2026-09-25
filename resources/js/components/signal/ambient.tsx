import { useEffect, useRef } from 'react';

// Pixel sprites, drawn facing right; pirates are mirrored. x = hull and sail, r = flag.
const PACKET = ['....x....', '....xx...', '....xxx..', '....xxxx.', '....x....', 'xxxxxxxxx', '.xxxxxxx.'];
const PIRATE = ['....rr...', '....r....', '...xxxx..', '..xxxxx..', '....x....', 'xxxxxxxxx', '.xxxxxxx.'];

type Bit = { x: number; y: number; vy: number; ch: string; a: number; size: number; red: boolean };
type Ship = { x: number; dir: 1 | -1; side: 'packet' | 'pirate'; hp: number; speed: number; phase: number; sink: number; cooldown: number };
type Ball = { x: number; y: number; vx: number; vy: number; t: number; life: number; target: Ship; side: Ship['side'] };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; red: boolean };
type Tag = { x: number; y: number; text: string; life: number };

const G = 0.06;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * The page's background: sparse bits falling through the dark, and along the
 * bottom edge a very small naval war between packets and pirates. Drawn at
 * 30 fps on one canvas, paused when the tab is hidden, frozen for reduced motion.
 */
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
        let bits: Bit[] = [];
        let ships: Ship[] = [];
        let balls: Ball[] = [];
        let sparks: Spark[] = [];
        let tags: Tag[] = [];
        const respawn: { side: Ship['side']; at: number }[] = [];
        let frame = 0;
        let raf = 0;
        let last = 0;

        const perSide = () => (W < 640 ? 1 : 2);
        const px = () => 2;
        const seaY = () => H - 22;

        const spawnShip = (side: Ship['side']): Ship => ({
            x: side === 'packet' ? rand(-120, -30) : W + rand(30, 120),
            dir: side === 'packet' ? 1 : -1,
            side,
            hp: 3,
            speed: rand(0.22, 0.4),
            phase: rand(0, Math.PI * 2),
            sink: 0,
            cooldown: rand(40, 120),
        });

        const resize = () => {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            W = window.innerWidth;
            H = window.innerHeight;
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            canvas.style.width = `${W}px`;
            canvas.style.height = `${H}px`;

            const count = Math.max(28, Math.min(110, Math.round((W * H) / 16000)));
            bits = Array.from({ length: count }, () => ({
                x: rand(0, W),
                y: rand(0, H),
                vy: rand(0.25, 0.8),
                ch: Math.random() < 0.5 ? '0' : '1',
                a: rand(0.05, 0.17),
                size: rand(9, 12),
                red: Math.random() < 0.06,
            }));

            if (!ships.length) {
                ships = [
                    ...Array.from({ length: perSide() }, () => spawnShip('packet')),
                    ...Array.from({ length: perSide() }, () => spawnShip('pirate')),
                ];
                // Start mid-voyage so the first frame already has a scene in it.
                ships.forEach((s, i) => (s.x = s.side === 'packet' ? W * (0.08 + i * 0.12) : W * (0.92 - (i - perSide()) * 0.12)));
            }
        };

        const drawSprite = (ship: Ship, y: number, alpha: number) => {
            const sprite = ship.side === 'packet' ? PACKET : PIRATE;
            const s = px();
            const w = sprite[0].length * s;
            sprite.forEach((row, ry) => {
                [...row].forEach((c, rx) => {
                    if (c === '.') return;
                    const col = ship.dir === 1 ? rx : row.length - 1 - rx;
                    ctx.fillStyle = c === 'r' ? `rgba(255,59,48,${alpha * 1.6})` : `rgba(255,255,255,${alpha})`;
                    ctx.fillRect(Math.round(ship.x - w / 2 + col * s), Math.round(y - sprite.length * s + ry * s), s, s);
                });
            });
        };

        const fire = (shooter: Ship, target: Ship) => {
            const t = rand(42, 58);
            const sx = shooter.x + shooter.dir * 8;
            const sy = seaY() - 8;
            balls.push({ x: sx, y: sy, vx: (target.x - sx) / t, vy: (0 - 0.5 * G * t * t) / t, t: 0, life: t, target, side: shooter.side });
        };

        const burst = (x: number, y: number, n: number, red: boolean) => {
            for (let i = 0; i < n; i++)
                sparks.push({ x, y, vx: rand(-1.2, 1.2), vy: rand(-1.8, -0.3), life: rand(18, 34), red: red && Math.random() < 0.7 });
        };

        const step = () => {
            frame++;
            const sea = seaY();

            bits.forEach((b) => {
                b.y += b.vy;
                if (Math.random() < 0.006) b.ch = b.ch === '0' ? '1' : '0';
                if (b.y > sea - 6) {
                    b.y = -12;
                    b.x = rand(0, W);
                }
            });

            ships.forEach((ship) => {
                if (ship.sink > 0) {
                    ship.sink += 0.012;
                    return;
                }
                const enemy = ships
                    .filter((o) => o.side !== ship.side && o.sink === 0 && (o.x - ship.x) * ship.dir > 0)
                    .sort((a, b) => Math.abs(a.x - ship.x) - Math.abs(b.x - ship.x))[0];
                const near = enemy && Math.abs(enemy.x - ship.x) < 380;
                ship.x += ship.dir * (near ? 0.05 : ship.speed);
                if (near && --ship.cooldown <= 0) {
                    fire(ship, enemy);
                    ship.cooldown = rand(70, 150);
                }
            });

            balls = balls.filter((ball) => {
                ball.t++;
                ball.x += ball.vx;
                ball.vy += G;
                ball.y += ball.vy;
                if (ball.t < ball.life) return true;

                const hit = ball.target.sink === 0 && Math.random() < 0.5;
                if (hit) {
                    ball.target.hp--;
                    burst(ball.target.x, sea - 8, 12, true);
                    if (ball.target.hp <= 0) {
                        ball.target.sink = 0.001;
                        tags.push({ x: ball.target.x, y: sea - 22, text: ball.target.side === 'packet' ? '-1 packet xd' : 'rst', life: 110 });
                    }
                } else {
                    burst(ball.x, sea, 5, false);
                }
                return false;
            });

            sparks = sparks.filter((s) => {
                s.x += s.vx;
                s.vy += 0.08;
                s.y += s.vy;
                return --s.life > 0;
            });
            tags = tags.filter((t) => {
                t.y -= 0.2;
                return --t.life > 0;
            });

            ships = ships.filter((ship) => {
                const gone = ship.sink >= 1 || ship.x < -160 || ship.x > W + 160;
                if (gone) respawn.push({ side: ship.side, at: frame + Math.round(rand(160, 340)) });
                return !gone;
            });
            for (let i = respawn.length - 1; i >= 0; i--) {
                if (respawn[i].at <= frame && ships.filter((s) => s.side === respawn[i].side).length < perSide()) {
                    ships.push(spawnShip(respawn[i].side));
                    respawn.splice(i, 1);
                }
            }
        };

        const draw = () => {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);
            const sea = seaY();

            ctx.textBaseline = 'top';
            bits.forEach((b) => {
                ctx.font = `${b.size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
                ctx.fillStyle = b.red ? `rgba(255,59,48,${b.a * 1.4})` : `rgba(255,255,255,${b.a})`;
                ctx.fillText(b.ch, b.x, b.y);
            });

            // The sea: a dotted line with a slow swell.
            for (let x = 0; x < W; x += 4) {
                const y = sea + Math.round(Math.sin(x / 38 + frame / 30) * 1.2);
                ctx.fillStyle = 'rgba(255,255,255,0.12)';
                ctx.fillRect(x, y, 1, 1);
            }

            ships.forEach((ship) => {
                const bob = Math.sin(frame / 18 + ship.phase) * 1.2;
                drawSprite(ship, sea - 1 + bob + ship.sink * 16, 0.34 * (1 - ship.sink));
            });

            balls.forEach((b) => {
                ctx.fillStyle = b.side === 'pirate' ? 'rgba(255,59,48,0.8)' : 'rgba(255,255,255,0.7)';
                ctx.fillRect(Math.round(b.x), Math.round(b.y), 2, 2);
            });

            sparks.forEach((s) => {
                ctx.fillStyle = s.red ? `rgba(255,59,48,${Math.min(0.9, s.life / 24)})` : `rgba(255,255,255,${Math.min(0.6, s.life / 30)})`;
                ctx.fillRect(Math.round(s.x), Math.round(s.y), 1.5, 1.5);
            });

            ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
            tags.forEach((t) => {
                ctx.fillStyle = `rgba(255,255,255,${Math.min(0.45, t.life / 90)})`;
                ctx.fillText(t.text, t.x - ctx.measureText(t.text).width / 2, t.y);
            });
        };

        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            if (document.hidden || now - last < 33) return;
            last = now;
            step();
            draw();
        };

        resize();
        window.addEventListener('resize', resize);
        if (reduced) draw();
        else raf = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true" />;
}
