import { contentScrollY, prefersReducedMotion, remeasure, scrollToY, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { useMotion, useStage } from '@/lib/stage';
import type { Flow, StackItem, StackLayer } from '@/types/portfolio';
import { X } from '@phosphor-icons/react';
import { animate, stagger } from 'animejs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { arc } from '../bits/shapes';
import { useBitChapter } from '../bits/stage';
import { RED, WHITE, type Targets } from '../bits/types';
import { Scramble } from '../motion/scramble';

const LABEL_W = 150;
const NODE_BITS = 40;
const STREAM = 1100;
const LINE_BITS = 220;
/** Scroll per hop while pinned, as a share of the viewport height. */
const PER_HOP = 0.38;

type Node = { item: StackItem; layer: StackLayer; row: number; col: number; offset: number };
type Hop = { node: Node; note: string; hot: boolean };

/** Where a node sits in the box, as fractions: rows are layers, each row centred. */
function place(node: Node, maxCols: number, rows: number) {
    return { fx: (node.col + 0.5 + node.offset) / maxCols, fy: (node.row + 0.5) / rows };
}

/**
 * The stack as a constellation of bits. Every tool is a ring; every layer is a
 * dotted line; a scenario is a stream of bits that flows from tool to tool as
 * the page scrolls, with the reason for each hop on the line beneath.
 */
export function Constellation({ layers, flows }: { layers: StackLayer[]; flows: Flow[] }) {
    const stage = useStage();
    const motion = useMotion();
    const root = useRef<HTMLDivElement>(null);
    const pipe = useRef<HTMLOListElement>(null);
    const reachedRef = useRef(-1);
    const [reached, setReached] = useState(-1);
    const pinned = useRef<HTMLDivElement>(null);
    const box = useRef<HTMLDivElement>(null);
    const trigger = useRef<ScrollTrigger | null>(null);
    const head = useRef(0);

    const [flowIndex, setFlowIndex] = useState(0);
    const [hop, setHop] = useState(0);
    const [picked, setPicked] = useState<number | null>(null);
    const [roving, setRoving] = useState<number | null>(() => layers[0]?.items[0]?.id ?? null);

    const maxCols = Math.max(...layers.map((l) => l.items.length));
    const nodes = useMemo(() => {
        const out = new Map<number, Node>();
        layers.forEach((layer, row) =>
            layer.items.forEach((item, col) => out.set(item.id, { item, layer, row, col, offset: (maxCols - layer.items.length) / 2 })),
        );
        return out;
    }, [layers, maxCols]);
    const order = useMemo(() => Array.from(nodes.values()), [nodes]);
    const grid = useMemo(() => layers.map((l) => l.items.map((i) => i.id)), [layers]);

    const flow = flows[flowIndex];
    const hops: Hop[] = useMemo(
        () =>
            (flow?.steps ?? [])
                .filter((s) => s.item_id !== null && nodes.has(s.item_id))
                .map((s) => ({ node: nodes.get(s.item_id!)!, note: s.note, hot: s.hot })),
        [flow, nodes],
    );
    const inFlow = useMemo(() => new Set(hops.map((h) => h.node.item.id)), [hops]);
    const current = hops[Math.min(hop, hops.length - 1)];
    // Read by the pin's onUpdate, so a scenario change does not have to rebuild the pin.
    const hopCount = useRef(hops.length);
    hopCount.current = hops.length;
    const maxHops = useMemo(() => Math.max(0, ...flows.map((fl) => fl.steps.length)), [flows]);

    /**
     * Phones: the hops are a vertical line, and the request is a stream of bits
     * running down it to wherever the reader has scrolled. Every hop it has
     * passed wears a ring.
     */
    const pipeline = (t: Targets, time: number) => {
        const dots = pipe.current?.querySelectorAll<HTMLElement>('[data-dot]');
        if (!dots?.length) return t.rest(0, t.n);
        const pts = Array.from(dots, (d) => {
            const r = d.getBoundingClientRect();
            return [r.left + r.width / 2, r.top + r.height / 2] as const;
        });
        const x = pts[0][0];
        const y0 = pts[0][1];
        const headY = Math.min(Math.max(t.vh * 0.58, y0), pts[pts.length - 1][1]);
        let k = -1;
        pts.forEach(([, y], j) => {
            if (y <= headY + 2) k = j;
        });
        if (k !== reachedRef.current) {
            reachedRef.current = k;
            setReached(k);
        }

        let i = 0;
        const len = Math.max(1, headY - y0);
        const hotFrom = hops.findIndex((h) => h.hot);
        for (let q = 0; q < 900 && i < t.n; q++, i++) {
            // Bits fall down the line, continuously, from the first hop to the reader.
            const y = y0 + ((t.seed[i] * len + time * 70) % len);
            const nearHead = headY - y < 36;
            const red = hotFrom >= 0 && y >= pts[hotFrom][1] - 2 && k >= hotFrom;
            const [cr, cg, cb] = red ? RED : WHITE;
            t.x[i] = x + (t.seed2[i] - 0.5) * 3.5;
            t.y[i] = y;
            t.a[i] = nearHead ? 1 : 0.55;
            t.r[i] = cr;
            t.g[i] = cg;
            t.b[i] = cb;
            t.s[i] = nearHead ? 3 : 2.2;
            t.sq[i] = 1;
        }
        pts.forEach(([px, py], j) => {
            if (j > k) return;
            const [cr, cg, cb] = hops[j]?.hot ? RED : WHITE;
            for (let q = 0; q < 26 && i < t.n; q++, i++) {
                const ang = (q / 26) * Math.PI * 2 + time * 0.6;
                t.x[i] = px + Math.cos(ang) * 7;
                t.y[i] = py + Math.sin(ang) * 7;
                t.a[i] = 0.95;
                t.r[i] = cr;
                t.g[i] = cg;
                t.b[i] = cb;
                t.s[i] = 2.4;
                t.sq[i] = 1;
            }
        });
        // The head: a pulsing knot where the request is now.
        for (let q = 0; q < 36 && i < t.n; q++, i++) {
            const ang = (q / 36) * Math.PI * 2 - time * 2;
            const rr = 10 + Math.sin(time * 5) * 2;
            t.x[i] = x + Math.cos(ang) * rr;
            t.y[i] = headY + Math.sin(ang) * rr;
            t.a[i] = 1;
            t.r[i] = WHITE[0];
            t.g[i] = WHITE[1];
            t.b[i] = WHITE[2];
            t.s[i] = 2.6;
            t.sq[i] = 1;
        }
        t.rest(i, t.n);
    };

    // The bits: rings for tools, dotted lines for layers, a stream for the request.
    useBitChapter('stack', root, (t: Targets, time: number) => {
        if (!stage) return motion ? pipeline(t, time) : t.rest(0, t.n);
        const el = box.current;
        if (!el) return t.rest(0, t.n);
        const r = el.getBoundingClientRect();
        const w = r.width - LABEL_W;
        const rows = layers.length;
        const at = (n: Node) => {
            const p = place(n, maxCols, rows);
            return [r.left + LABEL_W + p.fx * w, r.top + p.fy * r.height] as const;
        };
        const f = head.current;
        const reached = Math.floor(f + 0.001);
        const now = Math.round(f);
        const visited = new Set(hops.slice(0, reached + 1).map((h) => h.node.item.id));
        let i = 0;

        order.forEach((node) => {
            const [nx, ny] = at(node);
            const id = node.item.id;
            const isNow = hops[now]?.node.item.id === id;
            const involved = inFlow.has(id);
            const lit = visited.has(id);
            const radius = isNow ? 9 + Math.sin(time * 6) * 1.5 : involved ? 7 : 5;
            const alpha = isNow ? 1 : lit ? 0.9 : involved ? 0.45 : 0.16;
            const [cr, cg, cb] = isNow && hops[now]?.hot ? RED : WHITE;
            for (let q = 0; q < NODE_BITS && i < t.n; q++, i++) {
                const ring = q < 32;
                const ang = ring ? (q / 32) * Math.PI * 2 + time * (isNow ? 0.8 : 0.15) : t.seed[i] * Math.PI * 2;
                const rr = ring ? radius : t.seed2[i] * 2.5;
                t.x[i] = nx + Math.cos(ang) * rr;
                t.y[i] = ny + Math.sin(ang) * rr;
                t.a[i] = alpha;
                t.r[i] = cr;
                t.g[i] = cg;
                t.b[i] = cb;
                t.s[i] = ring ? 2.5 : 2;
                t.sq[i] = 1;
            }
        });

        // The request: a stream along curved hops, densest at its head, fading behind it.
        const trail = 2.2;
        const pts = hops.map((h) => at(h.node));
        for (let q = 0; q < STREAM && i < t.n; q++, i++) {
            const lag = Math.pow(q / STREAM, 1.6) * trail;
            const pos = f - lag;
            if (pts.length < 2 || pos < 0) {
                const [sx, sy] = pts[0] ?? [r.left, r.top];
                t.x[i] = sx;
                t.y[i] = sy;
                t.a[i] = 0;
            } else {
                const seg = Math.min(pts.length - 2, Math.floor(pos));
                const u = Math.min(1, pos - seg);
                const [x, y] = arc(pts[seg][0], pts[seg][1], pts[seg + 1][0], pts[seg + 1][1], seg % 2 ? 0.16 : -0.16, u);
                // A fine thread: a hair of sideways scatter, brightest at the head.
                const wob = Math.sin(time * 2.2 + t.seed[i] * 30) * 1.4;
                t.x[i] = x + wob;
                t.y[i] = y + Math.cos(time * 1.7 + t.seed2[i] * 30) * 1.4;
                t.a[i] = (lag < 0.12 ? 1 : 0.55) * (1 - lag / trail);
                const [cr, cg, cb] = hops[seg + 1]?.hot ? RED : WHITE;
                t.r[i] = cr;
                t.g[i] = cg;
                t.b[i] = cb;
            }
            t.s[i] = lag < 0.08 ? 3.2 : 1.8;
            t.sq[i] = 1;
        }

        // Each layer is a faint dotted line of bits under its row.
        for (let row = 0; row < rows; row++) {
            const y = r.top + ((row + 0.5) / rows) * r.height;
            for (let q = 0; q < LINE_BITS && i < t.n; q++, i++) {
                t.x[i] = r.left + LABEL_W - 20 + (q / LINE_BITS) * (w + 20);
                t.y[i] = y + 20 + (t.seed[i] - 0.5) * 1.5;
                t.a[i] = 0.12;
                t.r[i] = WHITE[0];
                t.g[i] = WHITE[1];
                t.b[i] = WHITE[2];
                t.s[i] = 1.6;
                t.sq[i] = 1;
            }
        }
        t.rest(i, t.n);
    });

    // Pinned: scrolling walks the request through its hops. The pin is as long as the
    // longest scenario and outlives scenario changes: tearing it down and measuring again
    // while the page glides back to its start left the smoother stuck at the old position.
    useGSAP(
        () => {
            if (!stage || !pinned.current || maxHops < 2) return;
            trigger.current = ScrollTrigger.create({
                trigger: pinned.current,
                pin: true,
                start: 'top top',
                end: () => `+=${(maxHops - 1) * window.innerHeight * PER_HOP}`,
                anticipatePin: 1,
                invalidateOnRefresh: true,
                onUpdate: (self) => {
                    head.current = self.progress * (hopCount.current - 1);
                    const h = Math.round(head.current);
                    setHop((prev) => (prev === h ? prev : h));
                },
            });
            remeasure();
            return () => {
                trigger.current = null;
            };
        },
        { scope: root, dependencies: [stage, maxHops], revertOnUpdate: true },
    );

    // The first time the stage is seen, the names settle in from the middle out.
    useEffect(() => {
        const el = box.current;
        if (!stage || !el || prefersReducedMotion()) return;
        const once = ScrollTrigger.create({
            trigger: el,
            start: 'top 80%',
            once: true,
            onEnter: () => {
                animate(el.querySelectorAll('.cn-node'), {
                    opacity: [0, 1],
                    translateY: [8, 0],
                    duration: 600,
                    ease: 'outExpo',
                    delay: stagger(14, { grid: [maxCols, layers.length], from: 'center' }),
                });
            },
        });
        return () => once.kill();
    }, [stage, maxCols, layers.length]);

    const choose = useCallback((index: number) => {
        setPicked(null);
        setFlowIndex(index);
        setHop(0);
        head.current = 0;
        // A new scenario starts from its first hop: back to the top of the pin, unless already there.
        const t = trigger.current;
        if (t && Math.abs(contentScrollY() - (t.start + 1)) > 2) scrollToY(t.start + 1);
    }, []);

    const close = useCallback(() => {
        const id = picked;
        setPicked(null);
        if (id !== null) box.current?.querySelector<HTMLButtonElement>(`[data-node="${id}"]`)?.focus({ preventScroll: true });
    }, [picked]);

    useEffect(() => {
        if (picked === null) return;
        const visible = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[data-close]') ?? []).find((b) => b.offsetParent !== null);
        visible?.focus({ preventScroll: true });
    }, [picked]);

    const move = useCallback(
        (id: number, key: string) => {
            const n = nodes.get(id);
            if (!n) return;
            let row = n.row;
            let col = n.col;
            if (key === 'ArrowRight') col += 1;
            else if (key === 'ArrowLeft') col -= 1;
            else if (key === 'ArrowDown') row += 1;
            else if (key === 'ArrowUp') row -= 1;
            else return;
            if (row < 0 || row >= grid.length) return;
            const next = grid[row][Math.max(0, Math.min(col, grid[row].length - 1))];
            setRoving(next);
            box.current?.querySelector<HTMLButtonElement>(`[data-node="${next}"]`)?.focus({ preventScroll: true });
        },
        [nodes, grid],
    );

    if (!flow) return null;

    const pickedNode = picked !== null ? nodes.get(picked) : null;
    const pickedFlows = picked !== null ? flows.map((f, i) => ({ f, i })).filter(({ f }) => f.steps.some((s) => s.item_id === picked)) : [];

    const detail = pickedNode && (
        <>
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-[17px] font-medium text-zinc-50">
                    <Scramble key={pickedNode.item.id} text={pickedNode.item.name} duration={0.4} />
                </span>
                <button data-close type="button" onClick={close} className="text-zinc-400 hover:text-zinc-100" aria-label="Close">
                    <X size={16} weight="light" />
                </button>
            </div>
            <div className="mt-0.5 font-mono text-[11.5px] text-zinc-400">
                {pickedNode.layer.name}, {pickedNode.item.services !== null ? `used by ${pickedNode.item.services} services` : 'not counted'}
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-zinc-300">{pickedNode.item.why}</p>
            {pickedNode.item.instead_of && (
                <p className="mt-2 text-[13px] text-zinc-400">
                    <span className="text-zinc-300">Instead of</span> {pickedNode.item.instead_of}
                </p>
            )}
            <div className="mt-4 flex flex-wrap gap-1.5">
                {pickedFlows.length ? (
                    pickedFlows.map(({ f, i }) => (
                        <button
                            key={f.slug}
                            type="button"
                            onClick={() => choose(i)}
                            className="rounded-[2px] border border-white/20 px-2 py-0.5 text-[12.5px] text-zinc-300 transition-colors hover:border-white hover:text-zinc-50"
                        >
                            {f.title}
                        </button>
                    ))
                ) : (
                    <span className="font-mono text-[11.5px] text-zinc-400">in no scenario yet</span>
                )}
            </div>
        </>
    );

    const tabs = (
        <div role="group" aria-label="Scenarios" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {flows.map((f, i) => (
                <button
                    key={f.slug}
                    type="button"
                    aria-pressed={i === flowIndex}
                    onClick={() => choose(i)}
                    className={`shrink-0 rounded-[2px] border px-3.5 py-2 text-[14px] transition-colors active:translate-y-px ${
                        i === flowIndex
                            ? 'border-zinc-50 bg-zinc-50 text-black'
                            : 'border-white/15 text-zinc-400 hover:border-white/40 hover:text-zinc-100'
                    }`}
                >
                    {f.title}
                </button>
            ))}
        </div>
    );

    if (!stage) {
        // Phones, short screens, reduced motion: the scenario as a list, every hop in order.
        return (
            <div ref={root}>
                {tabs}
                <p className="mt-4 max-w-[70ch] text-zinc-400">{flow.summary}</p>
                <ol ref={pipe} className="relative mt-8 border-l border-white/10 pl-7">
                    {hops.map((h, i) => {
                        // With motion, a hop wakes up as the stream reaches it; without, all are awake.
                        const lit = !motion || i <= reached;
                        return (
                            <li
                                key={`${flow.slug}${i}`}
                                className={`relative pb-7 transition-[opacity,translate] duration-500 ${lit ? 'opacity-100' : 'translate-x-2 opacity-35'}`}
                            >
                                <span
                                    data-dot
                                    className={`absolute top-[9px] -left-[32px] h-2 w-2 ${
                                        motion ? 'border border-white/25' : h.hot ? 'bg-[#ff3b30]' : 'bg-white/60'
                                    }`}
                                />
                                <button type="button" onClick={() => setPicked(h.node.item.id)} className="flex items-start gap-3 text-left">
                                    {h.node.item.icon && <img src={h.node.item.icon} alt="" className="mt-1 h-4 w-4 shrink-0 opacity-80" />}
                                    <span>
                                        <span className={`block text-[17px] font-medium ${h.hot ? 'text-[#ff3b30]' : 'text-zinc-50'}`}>
                                            {h.node.item.name}
                                        </span>
                                        <span className="mt-0.5 block text-[14.5px] leading-snug text-zinc-400">{h.note}</span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
                {pickedNode && (
                    <div className="mt-2 border border-[#ff3b30]/60 p-4" onKeyDown={(e) => e.key === 'Escape' && close()}>
                        {detail}
                    </div>
                )}
            </div>
        );
    }

    const pop = pickedNode ? place(pickedNode, maxCols, layers.length) : null;

    return (
        <div ref={root}>
            <div ref={pinned} className="flex h-[100dvh] flex-col justify-center pt-16 pb-6">
                {tabs}
                {/* Two lines reserved, so a short summary does not shift the centred stage. */}
                <p className="mt-3 line-clamp-2 min-h-[3.25em] max-w-[70ch] text-zinc-400">{flow.summary}</p>

                <div
                    ref={box}
                    role="group"
                    aria-label={`Constellation of tools: ${flow.title}. Arrow keys move between tools, Enter opens one.`}
                    className="relative mt-6 h-[min(60vh,640px)] min-h-[360px]"
                >
                    {layers.map((layer, row) => (
                        <div
                            key={layer.slug}
                            className="absolute left-0 -translate-y-1/2 font-mono text-[12px] text-zinc-400"
                            style={{ top: `${((row + 0.5) / layers.length) * 100}%`, width: LABEL_W - 16 }}
                        >
                            <span className="text-[#ff3b30]">{String(row + 1).padStart(2, '0')}</span> {layer.name}
                        </div>
                    ))}

                    {order.map((node) => {
                        const p = place(node, maxCols, layers.length);
                        const id = node.item.id;
                        const isNow = current?.node.item.id === id;
                        const involved = inFlow.has(id);
                        return (
                            <button
                                key={id}
                                type="button"
                                data-node={id}
                                tabIndex={id === roving ? 0 : -1}
                                aria-label={`${node.item.name}, ${node.layer.name}${involved ? ', in this scenario' : ''}`}
                                onClick={() => setPicked(id)}
                                onFocus={() => setRoving(id)}
                                onKeyDown={(e) => {
                                    if (e.key.startsWith('Arrow')) {
                                        e.preventDefault();
                                        move(id, e.key);
                                    }
                                }}
                                className="cn-node group absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-1 focus-visible:ring-[#ff3b30]"
                                style={{ left: `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${p.fx})`, top: `${p.fy * 100}%` }}
                            >
                                <span
                                    className={`pointer-events-none absolute top-[22px] left-1/2 flex -translate-x-1/2 items-center gap-1.5 font-mono text-[11.5px] whitespace-nowrap transition-colors ${
                                        isNow
                                            ? current?.hot
                                                ? 'text-[#ff3b30]'
                                                : 'text-zinc-50'
                                            : involved
                                              ? 'text-zinc-300'
                                              : 'text-zinc-400 group-hover:text-zinc-200'
                                    }`}
                                >
                                    {node.item.icon && (
                                        <img src={node.item.icon} alt="" className={`h-3 w-3 ${involved ? 'opacity-90' : 'opacity-40'}`} />
                                    )}
                                    {node.item.name}
                                    {node.item.services !== null && <span className="text-[#ff3b30]">{node.item.services}</span>}
                                </span>
                            </button>
                        );
                    })}

                    {pickedNode && pop && (
                        <div
                            role="dialog"
                            aria-label={pickedNode.item.name}
                            onKeyDown={(e) => e.key === 'Escape' && close()}
                            className="absolute z-10 w-[340px] border border-[#ff3b30]/60 bg-[#09090b]/95 p-4 backdrop-blur"
                            style={{
                                ...(pop.fx > 0.6
                                    ? { right: `calc((100% - ${LABEL_W}px) * ${1 - pop.fx} + 24px)` }
                                    : { left: `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${pop.fx} + 24px)` }),
                                ...(pop.fy > 0.5 ? { bottom: `${(1 - pop.fy) * 100}%` } : { top: `${pop.fy * 100}%` }),
                            }}
                        >
                            {detail}
                        </div>
                    )}
                </div>

                <div className="mt-6 grid gap-2 border-t border-white/10 pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-baseline lg:gap-8">
                    <p className="min-w-0 text-[15px] [overflow-wrap:anywhere] text-zinc-300" aria-live="polite">
                        <span className="mr-3 font-mono text-[12px] text-zinc-400 tabular-nums">
                            {Math.min(hop + 1, hops.length)}/{hops.length}
                        </span>
                        {current && (
                            <>
                                <span className={`mr-2 font-medium ${current.hot ? 'text-[#ff3b30]' : 'text-zinc-50'}`}>
                                    {current.node.item.name}
                                </span>
                                <Scramble key={`${flow.slug}${hop}`} text={current.note} duration={0.45} />
                            </>
                        )}
                    </p>
                    <span className="font-mono text-[12px] text-zinc-400">
                        <span className="text-[#ff3b30]">red numbers</span> count the services using a tool; a{' '}
                        <span className="text-[#ff3b30]">red hop</span> is where the time goes
                    </span>
                </div>
            </div>
        </div>
    );
}
