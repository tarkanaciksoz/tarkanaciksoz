import { prefersReducedMotion, ScrollTrigger } from '@/lib/gsap';
import type { Flow, StackItem, StackLayer } from '@/types/portfolio';
import { animate, createDrawable, createMotionPath, createTimeline, stagger, utils } from 'animejs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Scramble } from '../motion/scramble';
import { BOARD, CHIP, placeChips, route, rowY, type ChipBox } from './geometry';

const TRAVEL = 700;
const DWELL = 950;
const HOLD = 2800;

type Step = { box: ChipBox; item: StackItem; note: string; hot: boolean };

/**
 * The stack as a circuit board. Every tool is a chip; a scenario is a signal
 * routed through the chips it really touches, in order, with the reason for each
 * hop in the log beside it. Scenarios play on their own once the board is on
 * screen; picking one, or a chip, hands control to the visitor.
 */
export function CircuitBoard({ layers, flows }: { layers: StackLayer[]; flows: Flow[] }) {
    const chips = useMemo(() => placeChips(layers), [layers]);
    const byId = useMemo(() => new Map(layers.flatMap((l) => l.items.map((i) => [i.id, { item: i, layer: l }] as const))), [layers]);

    const [flowIndex, setFlowIndex] = useState(0);
    const [hop, setHop] = useState(-1);
    const [auto, setAuto] = useState(true);
    const [run, setRun] = useState(0);
    const [picked, setPicked] = useState<number | null>(null);
    const [inView, setInView] = useState(false);

    const rootRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const packetRef = useRef<SVGGElement>(null);
    const pathRefs = useRef<(SVGPathElement | null)[]>([]);
    const landed = useRef(false);

    const flow = flows[flowIndex];
    const steps: Step[] = useMemo(
        () =>
            (flow?.steps ?? [])
                .filter((s) => s.item_id !== null && chips.has(s.item_id))
                .map((s) => ({ box: chips.get(s.item_id!)!, item: byId.get(s.item_id!)!.item, note: s.note, hot: s.hot })),
        [flow, chips, byId],
    );
    const inFlow = useMemo(() => new Set(steps.map((s) => s.item.id)), [steps]);
    const visited = useMemo(() => new Set(steps.slice(0, hop + 1).map((s) => s.item.id)), [steps, hop]);
    const current = hop >= 0 ? steps[hop] : null;

    // Plays only while the board is on screen.
    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        const trigger = ScrollTrigger.create({ trigger: el, start: 'top 80%', end: 'bottom 20%', onToggle: (self) => setInView(self.isActive) });
        return () => trigger.kill();
    }, []);

    // The first time the board is seen, the chips seat themselves row by row.
    useEffect(() => {
        const svg = svgRef.current;
        if (!inView || landed.current || !svg || prefersReducedMotion()) return;
        landed.current = true;
        const cols = Math.max(...layers.map((l) => l.items.length));
        const seat = animate(svg.querySelectorAll('.chip-body'), {
            opacity: [0, 1],
            translateY: [-10, 0],
            duration: 520,
            ease: 'outExpo',
            delay: stagger(14, { grid: [cols, layers.length], from: 'first' }),
        });
        return () => {
            seat.complete();
        };
    }, [inView, layers]);

    // The sequencer: one Anime.js timeline per run. Each hop draws its trace while
    // the packet rides the same path, then the chip it reaches takes the signal.
    useEffect(() => {
        const packet = packetRef.current;
        if (!inView || !steps.length || !packet) return;
        const paths = pathRefs.current.slice(0, steps.length - 1).filter((p): p is SVGPathElement => !!p);
        const traces = paths.map((p) => createDrawable(p)[0]);

        if (prefersReducedMotion()) {
            utils.set(traces, { draw: '0 1' });
            utils.set(packet, { translateX: steps[steps.length - 1].box.cx, translateY: steps[steps.length - 1].box.cy });
            setHop(steps.length - 1);
            return;
        }

        utils.set(traces, { draw: '0 0' });
        utils.set(packet, { translateX: steps[0].box.cx, translateY: steps[0].box.cy });
        packet.dataset.hot = String(steps[0].hot);
        setHop(0);

        const tl = createTimeline({
            onComplete: () => auto && setFlowIndex((i) => (i + 1) % flows.length),
        });
        paths.forEach((path, i) => {
            const k = i + 1;
            tl.add(traces[i], { draw: ['0 0', '0 1'], duration: TRAVEL, ease: 'inOutQuad' }, `+=${DWELL}`)
                .add(
                    packet,
                    {
                        ...createMotionPath(path),
                        rotate: 0,
                        duration: TRAVEL,
                        ease: 'inOutQuad',
                        onBegin: () => {
                            packet.dataset.hot = String(steps[k].hot);
                        },
                    },
                    '<',
                )
                .call(() => setHop(k));
        });
        tl.call(() => undefined, `+=${HOLD}`);

        return () => {
            tl.revert();
        };
    }, [inView, steps, run, auto, flows.length]);

    const play = useCallback((index: number) => {
        setAuto(false);
        setFlowIndex(index);
        setRun((r) => r + 1);
    }, []);

    const pickedEntry = picked !== null ? byId.get(picked) : null;
    const pickedFlows = picked !== null ? flows.map((f, i) => ({ f, i })).filter(({ f }) => f.steps.some((s) => s.item_id === picked)) : [];

    if (!flow) return null;

    return (
        <div ref={rootRef} className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start xl:gap-10">
            {/* Board: desktop */}
            <div className="relative hidden min-w-0 overflow-hidden rounded-[2px] border border-white/12 bg-[#040405]/80 lg:block">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${BOARD.w} ${BOARD.h}`}
                    className="block h-auto w-full"
                    role="img"
                    aria-label={`Circuit board: ${flow.title}`}
                >
                    <defs>
                        <pattern id="cbDots" width="12" height="12" patternUnits="userSpaceOnUse">
                            <rect width="1" height="1" fill="rgba(255,255,255,.07)" />
                        </pattern>
                        <pattern id="cbDither" width="3" height="3" patternUnits="userSpaceOnUse">
                            <rect width="1" height="1" fill="rgba(255,255,255,.22)" />
                        </pattern>
                        <filter id="cbGlow" x="-100%" y="-100%" width="300%" height="300%">
                            <feGaussianBlur stdDeviation="3" />
                        </filter>
                    </defs>

                    <rect width={BOARD.w} height={BOARD.h} fill="url(#cbDots)" />

                    {layers.map((layer, r) => (
                        <g key={layer.slug}>
                            <line x1="160" x2={BOARD.w - 12} y1={rowY(r) + CHIP.h + 22} y2={rowY(r) + CHIP.h + 22} stroke="rgba(255,255,255,.035)" />
                            <text
                                x="18"
                                y={rowY(r) + 16}
                                style={{ fill: '#ff3b30', fontSize: 10, fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                            >
                                {`G${r + 1}`}
                            </text>
                            <text x="18" y={rowY(r) + 31} style={{ fill: '#a1a1aa', fontSize: 12, fontWeight: 500 }}>
                                {layer.name}
                            </text>
                        </g>
                    ))}

                    {/* Faint preview of the whole route, then the live traces drawn over it. */}
                    {steps.slice(1).map((s, i) => (
                        <path
                            key={`p${flow.slug}${i}`}
                            d={route(steps[i].box, s.box, i)}
                            fill="none"
                            stroke="rgba(255,255,255,.08)"
                            strokeDasharray="2 4"
                        />
                    ))}
                    {steps.slice(1).map((s, i) => (
                        <path
                            key={`t${flow.slug}${run}${i}`}
                            ref={(el) => {
                                pathRefs.current[i] = el;
                            }}
                            d={route(steps[i].box, s.box, i)}
                            fill="none"
                            stroke={s.hot ? '#ff3b30' : 'rgba(255,255,255,.7)'}
                            strokeWidth="1.6"
                            strokeLinejoin="round"
                        />
                    ))}
                    {(() => {
                        pathRefs.current.length = Math.max(0, steps.length - 1);
                        return null;
                    })()}

                    {layers.flatMap((layer) =>
                        layer.items.map((item) => {
                            const box = chips.get(item.id)!;
                            const isCurrent = current?.item.id === item.id;
                            const hot = isCurrent && current?.hot;
                            const seen = visited.has(item.id);
                            const involved = inFlow.has(item.id);
                            const selected = picked === item.id;

                            return (
                                <g
                                    key={item.id}
                                    transform={`translate(${box.x} ${box.y})`}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={item.name}
                                    onClick={() => setPicked(item.id)}
                                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setPicked(item.id)}
                                    className="cursor-pointer outline-none"
                                    opacity={involved ? 1 : 0.32}
                                >
                                    <g className="chip-body">
                                        <g className={isCurrent ? 'chip-land' : undefined} key={isCurrent ? `c${hop}${run}` : 'idle'}>
                                            {[0, 1, 2, 3, 4].map((pin) => (
                                                <g key={pin} fill={seen ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.2)'}>
                                                    <rect x={16 + pin * 28} y={-4} width="3" height="4" />
                                                    <rect x={16 + pin * 28} y={CHIP.h} width="3" height="4" />
                                                </g>
                                            ))}
                                            <rect
                                                width={CHIP.w}
                                                height={CHIP.h}
                                                rx="2"
                                                fill={isCurrent ? (hot ? '#ff3b30' : '#fff') : '#0a0a0c'}
                                                stroke={selected ? '#ff3b30' : seen ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.22)'}
                                                strokeWidth={selected ? 1.6 : 1}
                                            />
                                            {!isCurrent && item.services !== null && (
                                                <rect
                                                    width={CHIP.w}
                                                    height={CHIP.h}
                                                    rx="2"
                                                    fill="url(#cbDither)"
                                                    opacity={Math.min(0.9, 0.15 + item.services / 60)}
                                                />
                                            )}
                                            <path
                                                d={`M 0 ${CHIP.h / 2 - 5} a 5 5 0 0 1 0 10`}
                                                fill="#040405"
                                                stroke={seen ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.25)'}
                                            />
                                            {isCurrent && (
                                                <>
                                                    <text
                                                        x="13"
                                                        y="26"
                                                        style={{ fill: '#ff3b30', fontSize: 11.5, fontWeight: 500 }}
                                                        className="la-ghost"
                                                    >
                                                        {item.name}
                                                    </text>
                                                    <text
                                                        x="15"
                                                        y="26"
                                                        style={{ fill: '#22d3ee', fontSize: 11.5, fontWeight: 500 }}
                                                        className="la-ghost"
                                                    >
                                                        {item.name}
                                                    </text>
                                                </>
                                            )}
                                            <text
                                                x="14"
                                                y="26"
                                                style={{ fill: isCurrent ? '#000' : seen ? '#fafafa' : '#a1a1aa', fontSize: 11.5, fontWeight: 500 }}
                                            >
                                                {item.name}
                                            </text>
                                            {item.services !== null && (
                                                <text
                                                    x={CHIP.w - 7}
                                                    y="12"
                                                    textAnchor="end"
                                                    style={{
                                                        fill: isCurrent ? '#000' : '#ff3b30',
                                                        fontSize: 9,
                                                        fontFamily: 'Geist Mono, ui-monospace, monospace',
                                                    }}
                                                >
                                                    {item.services}
                                                </text>
                                            )}
                                        </g>
                                    </g>
                                </g>
                            );
                        }),
                    )}

                    <g ref={packetRef} className="cb-packet">
                        <rect x="-7" y="-7" width="14" height="14" fill="#fff" opacity=".22" filter="url(#cbGlow)" />
                        <rect x="-3.5" y="-3.5" width="7" height="7" fill="#fff" />
                    </g>
                </svg>
                <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 font-mono text-[10.5px] text-zinc-600">
                    <span>
                        chips = tools · <span className="text-[#ff3b30]">red number</span> = services using it · dim = not in this scenario
                    </span>
                    <span>{auto ? 'autoplay' : 'manual'}</span>
                </div>
            </div>

            {/* Pipeline: phones and tablets */}
            <div className="min-w-0 lg:hidden">
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3">
                    {flows.map((f, i) => (
                        <button
                            key={f.slug}
                            type="button"
                            onClick={() => play(i)}
                            className={`shrink-0 rounded-[2px] border px-2.5 py-1.5 text-[12.5px] ${
                                i === flowIndex ? 'border-white bg-white text-black' : 'border-white/15 text-zinc-300'
                            }`}
                        >
                            {f.title}
                        </button>
                    ))}
                </div>
                <ol className="relative mt-2 border-l border-white/15 pl-5">
                    {steps.map((s, i) => {
                        const state = i < hop ? 'past' : i === hop ? 'now' : 'next';
                        return (
                            <li
                                key={`${flow.slug}${i}`}
                                className={`relative pb-4 transition-opacity ${state === 'next' ? 'opacity-40' : 'opacity-100'}`}
                            >
                                <span
                                    className={`absolute top-1.5 -left-[25px] h-2 w-2 ${
                                        state === 'now'
                                            ? (s.hot ? 'bg-[#ff3b30]' : 'bg-white') + ' shadow-[0_0_10px_#fff]'
                                            : state === 'past'
                                              ? 'bg-white/60'
                                              : 'bg-white/15'
                                    }`}
                                />
                                <div className={`text-[15px] font-medium ${s.hot ? 'text-[#ff3b30]' : 'text-zinc-100'}`}>{s.item.name}</div>
                                <div className="text-[13.5px] text-zinc-400">{s.note}</div>
                            </li>
                        );
                    })}
                </ol>
            </div>

            {/* Panel: scenarios, the hop log, a chip's reasoning */}
            <aside className="min-w-0 lg:sticky lg:top-20">
                <div className="hidden lg:block">
                    <div className="mb-2 font-mono text-[10.5px] tracking-[0.14em] text-zinc-500 uppercase">Scenarios · GET /api/flows</div>
                    <ol className="border-t border-white/10">
                        {flows.map((f, i) => (
                            <li key={f.slug}>
                                <button
                                    type="button"
                                    onClick={() => play(i)}
                                    className={`jitter flex w-full items-baseline gap-3 border-b border-white/10 py-2 text-left text-[14px] transition-colors ${
                                        i === flowIndex ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'
                                    }`}
                                >
                                    <span className={`font-mono text-[10.5px] ${i === flowIndex ? 'text-[#ff3b30]' : 'text-zinc-700'}`}>
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <span className="min-w-0 flex-1">{f.title}</span>
                                    {i === flowIndex && <span className="blink h-2 w-2 shrink-0 bg-[#ff3b30]" />}
                                </button>
                            </li>
                        ))}
                    </ol>
                </div>

                <div className="scanlines relative mt-5 overflow-hidden rounded-[2px] border border-white/12 bg-[#040405] px-4 py-3 font-mono text-[11.5px] leading-[1.7]">
                    <div className="mb-1 flex items-baseline justify-between text-[10.5px] tracking-[0.14em] text-zinc-600 uppercase">
                        <span>
                            <span className="text-[#ff3b30]">▌</span> {flow.slug}
                        </span>
                        <button type="button" onClick={() => play(flowIndex)} className="jitter text-zinc-500 hover:text-white">
                            replay
                        </button>
                    </div>
                    <p className="mb-2 font-sans text-[13px] text-zinc-400">{flow.summary}</p>
                    {steps.map((s, i) => (
                        <div key={`${flow.slug}${i}`} className={`flex gap-2 ${i > hop ? 'opacity-30' : ''}`}>
                            <span className="shrink-0 text-zinc-700">{String(i).padStart(2, '0')}</span>
                            <span className={`shrink-0 ${s.hot ? 'text-[#ff3b30]' : i === hop ? 'text-white' : 'text-zinc-300'}`}>{s.item.name}</span>
                        </div>
                    ))}
                    {current && (
                        <div className="mt-2 border-t border-white/10 pt-2 font-sans text-[13.5px] leading-snug text-zinc-200">
                            <Scramble key={`${flow.slug}${hop}${run}`} text={current.note} duration={0.5} />
                        </div>
                    )}
                </div>

                {pickedEntry && (
                    <div className="mt-5 rounded-[2px] border border-[#ff3b30]/50 bg-[#050506] p-4">
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="text-[16px] font-medium text-zinc-50">
                                <Scramble key={pickedEntry.item.id} text={pickedEntry.item.name} duration={0.4} />
                            </span>
                            <button
                                type="button"
                                onClick={() => setPicked(null)}
                                className="font-mono text-[11px] text-zinc-500 hover:text-white"
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>
                        <div className="mt-0.5 font-mono text-[10.5px] text-zinc-500">
                            {pickedEntry.layer.name.toLowerCase()} ·{' '}
                            {pickedEntry.item.services !== null ? `${pickedEntry.item.services} services` : 'not counted'}
                        </div>
                        <p className="mt-2 text-[13.5px] text-zinc-300">{pickedEntry.item.why}</p>
                        {pickedEntry.item.instead_of && (
                            <p className="mt-2 text-[12.5px] text-zinc-500">
                                <span className="text-zinc-300">Instead of:</span> {pickedEntry.item.instead_of}
                            </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {pickedFlows.length ? (
                                pickedFlows.map(({ f, i }) => (
                                    <button
                                        key={f.slug}
                                        type="button"
                                        onClick={() => play(i)}
                                        className="jitter rounded-[2px] border border-white/20 px-2 py-0.5 font-mono text-[11px] text-zinc-300 hover:border-white"
                                    >
                                        ▸ {f.slug}
                                    </button>
                                ))
                            ) : (
                                <span className="font-mono text-[11px] text-zinc-600">not in any scenario yet</span>
                            )}
                        </div>
                    </div>
                )}
            </aside>
        </div>
    );
}
