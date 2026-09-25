import type { Flow, StackItem, StackLayer } from '@/types/portfolio';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DecodeText } from '../signal/decode-text';
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
    const packetRef = useRef<SVGGElement>(null);
    const pathRefs = useRef<(SVGPathElement | null)[]>([]);
    const lengths = useRef<number[]>([]);
    const hopRef = useRef(-1);

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

    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        const io = new IntersectionObserver((entries) => setInView(entries.some((e) => e.isIntersecting)), { threshold: 0.2 });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    // Measure every trace once it is drawn, so it can be revealed stroke by stroke.
    useLayoutEffect(() => {
        lengths.current = pathRefs.current.map((p) => p?.getTotalLength() ?? 0);
        pathRefs.current.forEach((p, i) => {
            if (!p) return;
            p.style.strokeDasharray = `${lengths.current[i]}`;
            p.style.strokeDashoffset = `${lengths.current[i]}`;
        });
    }, [steps, run]);

    // The sequencer: spawn on the first chip, then travel, land, dwell, repeat.
    useEffect(() => {
        if (!inView || !steps.length) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const reveal = (upTo: number, progress: number) => {
            pathRefs.current.forEach((p, i) => {
                if (!p) return;
                const len = lengths.current[i] ?? 0;
                const k = i + 1; // trace i leads into step k
                const shown = k <= upTo ? 1 : k === upTo + 1 ? progress : 0;
                p.style.strokeDashoffset = `${len * (1 - shown)}`;
            });
        };

        if (reduced) {
            hopRef.current = steps.length - 1;
            setHop(steps.length - 1);
            reveal(steps.length - 1, 1);
            return;
        }

        hopRef.current = 0;
        setHop(0);
        reveal(0, 0);
        const began = performance.now();
        const total = DWELL + (steps.length - 1) * (TRAVEL + DWELL) + HOLD;
        let raf = 0;

        const tick = (now: number) => {
            const t = now - began;
            if (t >= total) {
                if (auto) setFlowIndex((i) => (i + 1) % flows.length);
                return;
            }

            let reached = 0;
            let progress = 0;
            let traveling = -1;
            for (let k = 1; k < steps.length; k++) {
                const start = DWELL + (k - 1) * (TRAVEL + DWELL);
                if (t >= start + TRAVEL) reached = k;
                else if (t >= start) {
                    traveling = k;
                    progress = (t - start) / TRAVEL;
                    break;
                } else break;
            }

            if (reached !== hopRef.current) {
                hopRef.current = reached;
                setHop(reached);
            }
            reveal(reached, progress);

            const packet = packetRef.current;
            if (packet) {
                let x = steps[reached].box.cx;
                let y = steps[reached].box.cy;
                if (traveling > 0) {
                    const path = pathRefs.current[traveling - 1];
                    if (path) {
                        const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                        const pt = path.getPointAtLength((lengths.current[traveling - 1] ?? 0) * ease);
                        x = pt.x;
                        y = pt.y;
                    }
                }
                packet.setAttribute('transform', `translate(${x} ${y})`);
                packet.dataset.hot = String(traveling > 0 ? steps[traveling].hot : steps[reached].hot);
            }

            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
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
                <svg viewBox={`0 0 ${BOARD.w} ${BOARD.h}`} className="block h-auto w-full" role="img" aria-label={`Circuit board: ${flow.title}`}>
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
                            <text x="18" y={rowY(r) + 16} style={{ fill: '#ff3b30', fontSize: 10, fontFamily: 'ui-monospace, monospace' }}>
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
                                                <text x="13" y="26" style={{ fill: '#ff3b30', fontSize: 11.5, fontWeight: 500 }} className="la-ghost">
                                                    {item.name}
                                                </text>
                                                <text x="15" y="26" style={{ fill: '#22d3ee', fontSize: 11.5, fontWeight: 500 }} className="la-ghost">
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
                                                style={{ fill: isCurrent ? '#000' : '#ff3b30', fontSize: 9, fontFamily: 'ui-monospace, monospace' }}
                                            >
                                                {item.services}
                                            </text>
                                        )}
                                    </g>
                                </g>
                            );
                        }),
                    )}

                    <g
                        ref={packetRef}
                        className="cb-packet"
                        transform={current ? `translate(${current.box.cx} ${current.box.cy})` : 'translate(-50 -50)'}
                    >
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
                            <DecodeText key={`${flow.slug}${hop}${run}`} text={current.note} duration={380} />
                        </div>
                    )}
                </div>

                {pickedEntry && (
                    <div className="mt-5 rounded-[2px] border border-[#ff3b30]/50 bg-[#050506] p-4">
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="text-[16px] font-medium text-zinc-50">
                                <DecodeText key={pickedEntry.item.id} text={pickedEntry.item.name} duration={320} />
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
