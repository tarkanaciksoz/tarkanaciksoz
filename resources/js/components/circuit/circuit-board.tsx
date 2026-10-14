import { prefersReducedMotion, ScrollTrigger } from '@/lib/gsap';
import type { Flow, StackItem, StackLayer } from '@/types/portfolio';
import { X } from '@phosphor-icons/react';
import { animate, createDrawable, createMotionPath, createTimeline, stagger, utils } from 'animejs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Scramble } from '../motion/scramble';
import { BOARD, CHIP, placeChips, route, rowY, type ChipBox } from './geometry';

const TRAVEL = 700;
const DWELL = 950;
const HOLD = 2800;

type Step = { box: ChipBox; item: StackItem; note: string; hot: boolean };

/**
 * The stack as a circuit board. Every tool is a chip carrying its own mark; a
 * scenario is a signal routed through the chips it really touches, in order,
 * with the reason for each hop on the console line under the board. Scenarios
 * play on their own once the board is on screen; picking one, or a chip, hands
 * control to the visitor.
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
        setPicked(null);
        setFlowIndex(index);
        setRun((r) => r + 1);
    }, []);

    const pickedEntry = picked !== null ? byId.get(picked) : null;
    const pickedBox = picked !== null ? chips.get(picked) : null;
    const pickedFlows = picked !== null ? flows.map((f, i) => ({ f, i })).filter(({ f }) => f.steps.some((s) => s.item_id === picked)) : [];

    if (!flow) return null;

    const detail = pickedEntry && (
        <>
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-[17px] font-medium text-zinc-50">
                    <Scramble key={pickedEntry.item.id} text={pickedEntry.item.name} duration={0.4} />
                </span>
                <button type="button" onClick={() => setPicked(null)} className="text-zinc-500 hover:text-zinc-100" aria-label="Close">
                    <X size={16} weight="light" />
                </button>
            </div>
            <div className="mt-0.5 font-mono text-[11.5px] text-zinc-500">
                {pickedEntry.layer.name}, {pickedEntry.item.services !== null ? `used by ${pickedEntry.item.services} services` : 'not counted'}
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-zinc-300">{pickedEntry.item.why}</p>
            {pickedEntry.item.instead_of && (
                <p className="mt-2 text-[13px] text-zinc-500">
                    <span className="text-zinc-300">Instead of</span> {pickedEntry.item.instead_of}
                </p>
            )}
            <div className="mt-4 flex flex-wrap gap-1.5">
                {pickedFlows.length ? (
                    pickedFlows.map(({ f, i }) => (
                        <button
                            key={f.slug}
                            type="button"
                            onClick={() => play(i)}
                            className="rounded-[2px] border border-white/20 px-2 py-0.5 text-[12.5px] text-zinc-300 transition-colors hover:border-white hover:text-zinc-50"
                        >
                            {f.title}
                        </button>
                    ))
                ) : (
                    <span className="font-mono text-[11.5px] text-zinc-600">in no scenario yet</span>
                )}
            </div>
        </>
    );

    // The detail opens beside the chip, flipping to stay inside the board.
    const popover = pickedBox
        ? {
              ...(pickedBox.x > BOARD.w * 0.62
                  ? { right: `${((BOARD.w - pickedBox.x - CHIP.w) / BOARD.w) * 100}%` }
                  : { left: `${(pickedBox.x / BOARD.w) * 100}%` }),
              ...(pickedBox.y > BOARD.h * 0.55
                  ? { bottom: `${((BOARD.h - pickedBox.y + 10) / BOARD.h) * 100}%` }
                  : { top: `${((pickedBox.y + CHIP.h + 10) / BOARD.h) * 100}%` }),
          }
        : null;

    return (
        <div ref={rootRef}>
            <div role="tablist" aria-label="Scenarios" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                {flows.map((f, i) => (
                    <button
                        key={f.slug}
                        type="button"
                        role="tab"
                        aria-selected={i === flowIndex}
                        onClick={() => play(i)}
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
            <p className="mt-4 max-w-[70ch] text-zinc-400">{flow.summary}</p>

            {/* Board: desktop */}
            <div className="relative mt-6 hidden overflow-hidden rounded-[2px] border border-white/12 bg-[#040405]/80 lg:block">
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

                    <rect width={BOARD.w} height={BOARD.h} fill="url(#cbDots)" onClick={() => setPicked(null)} />

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
                                            <ChipMark item={item} isCurrent={isCurrent} seen={seen} />
                                            {isCurrent && (
                                                <>
                                                    <ChipName name={item.name} x={33} fill="#ff3b30" className="la-ghost" />
                                                    <ChipName name={item.name} x={35} fill="#22d3ee" className="la-ghost" />
                                                </>
                                            )}
                                            <ChipName name={item.name} x={34} fill={isCurrent ? '#09090b' : seen ? '#fafafa' : '#a1a1aa'} />
                                            {item.services !== null && (
                                                <text
                                                    x={CHIP.w - 7}
                                                    y="12"
                                                    textAnchor="end"
                                                    style={{
                                                        fill: isCurrent ? '#09090b' : '#ff3b30',
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
                {pickedEntry && popover && (
                    <div
                        className="absolute w-[340px] border border-[#ff3b30]/60 bg-[#09090b]/95 p-4 backdrop-blur"
                        style={popover}
                        role="dialog"
                        aria-label={pickedEntry.item.name}
                    >
                        {detail}
                    </div>
                )}
            </div>

            {/* Pipeline: phones and tablets */}
            <ol className="relative mt-6 border-l border-white/15 pl-5 lg:hidden">
                {steps.map((s, i) => {
                    const state = i < hop ? 'past' : i === hop ? 'now' : 'next';
                    return (
                        <li
                            key={`${flow.slug}${i}`}
                            className={`relative pb-4 transition-opacity ${state === 'next' ? 'opacity-40' : 'opacity-100'}`}
                        >
                            <span
                                className={`absolute top-1.5 -left-[25px] h-2 w-2 ${
                                    state === 'now' ? (s.hot ? 'bg-[#ff3b30]' : 'bg-zinc-50') : state === 'past' ? 'bg-white/60' : 'bg-white/15'
                                }`}
                            />
                            <button type="button" onClick={() => setPicked(s.item.id)} className="text-left">
                                <span className={`block text-[15px] font-medium ${s.hot ? 'text-[#ff3b30]' : 'text-zinc-100'}`}>{s.item.name}</span>
                                <span className="block text-[13.5px] text-zinc-400">{s.note}</span>
                            </button>
                        </li>
                    );
                })}
            </ol>
            {pickedEntry && <div className="mt-2 border border-[#ff3b30]/60 p-4 lg:hidden">{detail}</div>}

            {/* Console: where the signal is, and why */}
            <div className="mt-4 grid gap-2 border-t border-white/10 pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-baseline lg:gap-8">
                <p className="min-w-0 text-[15px] text-zinc-300">
                    {current ? (
                        <>
                            <span className="mr-3 font-mono text-[12px] text-zinc-600 tabular-nums">
                                {hop + 1}/{steps.length}
                            </span>
                            <span className={`mr-2 font-medium ${current.hot ? 'text-[#ff3b30]' : 'text-zinc-50'}`}>{current.item.name}</span>
                            <Scramble key={`${flow.slug}${hop}${run}`} text={current.note} duration={0.5} />
                        </>
                    ) : (
                        <span className="text-zinc-500">The signal starts when the board is on screen.</span>
                    )}
                </p>
                <div className="flex items-baseline gap-6 font-mono text-[12px] text-zinc-500">
                    <span className="hidden lg:inline">
                        <span className="text-[#ff3b30]">red numbers</span> count the services using a tool
                    </span>
                    <button
                        type="button"
                        onClick={() => play(flowIndex)}
                        className="jitter text-zinc-100 underline decoration-white/30 underline-offset-4"
                    >
                        Replay
                    </button>
                </div>
            </div>
        </div>
    );
}

function monogram(name: string): string {
    return name
        .replace(/[^A-Za-z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

/** The tool's own mark when it has one, a two-letter monogram when it does not. */
function ChipMark({ item, isCurrent, seen }: { item: StackItem; isCurrent: boolean; seen: boolean }) {
    const y = CHIP.h / 2 - 7;
    if (item.icon) {
        return (
            <image
                href={item.icon}
                x="12"
                y={y}
                width="14"
                height="14"
                opacity={isCurrent ? 1 : seen ? 0.95 : 0.6}
                style={isCurrent ? { filter: 'invert(1)' } : undefined}
            />
        );
    }
    return (
        <g opacity={isCurrent ? 1 : seen ? 0.9 : 0.55}>
            <rect x="12.5" y={y + 0.5} width="13" height="13" fill="none" stroke={isCurrent ? '#09090b' : 'rgba(255,255,255,.5)'} />
            <text
                x="19"
                y={y + 9.6}
                textAnchor="middle"
                style={{ fill: isCurrent ? '#09090b' : '#d4d4d8', fontSize: 6.5, fontFamily: 'Geist Mono, ui-monospace, monospace' }}
            >
                {monogram(item.name)}
            </text>
        </g>
    );
}

/** Long names break at their separator onto two lines, so nothing runs off the chip. */
function ChipName({ name, x, fill, className }: { name: string; x: number; fill: string; className?: string }) {
    const parts = name.length > 14 && name.includes(' · ') ? name.split(' · ') : [name];
    const style = { fill, fontSize: parts.length > 1 ? 10.5 : 11.5, fontWeight: 500 };
    if (parts.length === 1) {
        return (
            <text x={x} y="25.5" style={style} className={className}>
                {name}
            </text>
        );
    }
    return (
        <text x={x} y="18.5" style={style} className={className}>
            <tspan x={x}>{parts[0]}</tspan>
            <tspan x={x} dy="12">
                {parts.slice(1).join(' · ')}
            </tspan>
        </text>
    );
}
