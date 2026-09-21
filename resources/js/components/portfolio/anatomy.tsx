import { apiGet, fetchTrace, ms, postClientTiming } from '@/lib/api';
import type { ClientTiming, StackResponse, Trace } from '@/types/portfolio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildSteps, LAYERS, type LayerId, type Step } from './anatomy-steps';
import { layerY, StackVisual } from './stack-visual';

/** Slow motion: the whole request stretched to about this many seconds. */
const PLAYBACK_SECONDS = 6;

type Status = 'idle' | 'sending' | 'ready' | 'error';

function Bar({ steps, activeKey, onPick }: { steps: Step[]; activeKey: string; onPick: (key: string) => void }) {
    const total = steps.reduce((n, s) => n + s.ms, 0) || 1;
    return (
        <div className="flex h-2 gap-[2px]">
            {steps.map((step) => (
                <button
                    key={step.key}
                    type="button"
                    title={`${step.title} · ${ms(step.ms)} ms`}
                    onClick={() => onPick(step.key)}
                    style={{ flexGrow: Math.max(step.ms / total, 0.012) }}
                    className={`min-w-[2px] rounded-sm transition-colors ${
                        step.key === activeKey
                            ? step.slow
                                ? 'bg-orange-400'
                                : 'bg-white'
                            : step.kind === 'gap'
                              ? 'bg-white/10'
                              : 'bg-white/20 hover:bg-white/40'
                    }`}
                />
            ))}
        </div>
    );
}

function Code({ step }: { step: Step }) {
    if (!step.source) return null;
    const src = step.source;
    return (
        <div className="mt-4 overflow-hidden rounded-lg border border-white/8 bg-[#08080a]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-3 py-2 font-mono text-[11px] text-zinc-400">
                <span className="break-all">{src.file}</span>
                <span className="flex items-center gap-2">
                    {src.vendor ? (
                        <span className="rounded border border-white/12 px-1.5 py-0.5 text-[10px] text-zinc-400">vendor</span>
                    ) : (
                        src.commit && <span className="rounded border border-sky-300/30 px-1.5 py-0.5 text-[10px] text-sky-300">{src.commit}</span>
                    )}
                </span>
            </div>
            <pre className="overflow-x-auto py-2 font-mono text-[11.5px] leading-relaxed">
                {src.excerpt.map((line) => {
                    const hit = line.n >= src.line_start && line.n <= src.line_end;
                    return (
                        <div
                            key={line.n}
                            className={`grid grid-cols-[42px_minmax(0,1fr)] ${hit ? 'bg-sky-400/8 shadow-[inset_2px_0_0_theme(colors.sky.400)]' : ''}`}
                        >
                            <span className={`pr-3 text-right select-none ${hit ? 'text-sky-300' : 'text-zinc-600'}`}>{line.n}</span>
                            <span className={`whitespace-pre ${hit ? 'text-zinc-100' : 'text-zinc-400'}`}>{line.text || ' '}</span>
                        </div>
                    );
                })}
            </pre>
            <div className="border-t border-white/8 px-3 py-2 font-mono text-[10.5px] text-zinc-600">
                Read from the checkout that served this request, not pasted in.
            </div>
        </div>
    );
}

export function Anatomy() {
    const [status, setStatus] = useState<Status>('idle');
    const [trace, setTrace] = useState<Trace | null>(null);
    const [client, setClient] = useState<ClientTiming | null>(null);
    const [cache, setCache] = useState<string | null>(null);
    const [rows, setRows] = useState<number | null>(null);
    const [activeKey, setActiveKey] = useState<string>('');
    const [playing, setPlaying] = useState(false);
    const [elapsed, setElapsed] = useState<number | null>(null);
    const [orbY, setOrbY] = useState(() => layerY('browser'));
    const stepRefs = useRef<Record<string, HTMLElement | null>>({});
    const frame = useRef<number>(0);
    const playhead = useRef(0);

    const steps = useMemo(() => (trace ? buildSteps(trace, client) : []), [trace, client]);
    const active = steps.find((s) => s.key === activeKey) ?? steps[0];
    const total = useMemo(() => steps.reduce((n, s) => n + s.ms, 0), [steps]);

    /** Runs the recorded request back at a walking pace, in its real proportions. */
    const play = useCallback((list: Step[], speed: 'slow' | 'real') => {
        cancelAnimationFrame(frame.current);
        const sum = list.reduce((n, s) => n + s.ms, 0);
        if (!sum) return;

        const schedule: { step: Step; from: number; to: number; y: number; prevY: number }[] = [];
        let clock = 0;
        let prevY = layerY('browser');
        list.forEach((step) => {
            const y = layerY(step.layer);
            schedule.push({ step, from: clock, to: clock + step.ms, y, prevY });
            clock += step.ms;
            prevY = y;
        });

        const factor = speed === 'real' ? 1 : (PLAYBACK_SECONDS * 1000) / sum;
        const startedAt = performance.now();
        setPlaying(true);
        playhead.current = 0;

        const tick = (now: number) => {
            const at = (now - startedAt) / factor;

            if (at >= sum) {
                setElapsed(sum);
                setActiveKey(list[list.length - 1].key);
                setOrbY(layerY(list[list.length - 1].layer));
                setPlaying(false);
                return;
            }

            const current = schedule.find((s) => at >= s.from && at < s.to) ?? schedule[0];
            const within = current.to > current.from ? (at - current.from) / (current.to - current.from) : 1;
            const travel = Math.min(1, within / 0.4);

            setElapsed(at);
            setOrbY(current.prevY + (current.y - current.prevY) * travel);
            if (playhead.current !== schedule.indexOf(current)) {
                playhead.current = schedule.indexOf(current);
                setActiveKey(current.step.key);
            }

            frame.current = requestAnimationFrame(tick);
        };

        frame.current = requestAnimationFrame(tick);
    }, []);

    const send = useCallback(async () => {
        cancelAnimationFrame(frame.current);
        setStatus('sending');
        setPlaying(false);
        setElapsed(null);

        try {
            const result = await apiGet<StackResponse>('/api/stack');
            setCache(result.cache);
            setRows(result.body.meta.items);
            setClient(result.timing);

            if (!result.traceId) throw new Error('no trace id');
            if (result.timing) await postClientTiming(result.traceId, result.timing);

            const recorded = await fetchTrace(result.traceId);
            if (!recorded) throw new Error('trace not found');

            setTrace(recorded);
            setStatus('ready');
            play(buildSteps(recorded, result.timing), 'slow');
        } catch {
            setStatus('error');
        }
    }, [play]);

    useEffect(() => () => cancelAnimationFrame(frame.current), []);

    useEffect(() => {
        if (steps.length && !steps.some((s) => s.key === activeKey)) setActiveKey(steps[0].key);
    }, [steps, activeKey]);

    /** Once the playback has finished, scrolling the steps drives the light instead. */
    useEffect(() => {
        if (!steps.length || playing) return;

        const onScroll = () => {
            const mid = window.innerHeight * 0.45;
            let current = steps[0].key;
            for (const step of steps) {
                const el = stepRefs.current[step.key];
                if (el && el.getBoundingClientRect().top <= mid) current = step.key;
            }
            setActiveKey(current);
            const step = steps.find((s) => s.key === current);
            if (step) setOrbY(layerY(step.layer));
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [steps, playing]);

    const totals = useMemo(() => {
        const acc: Partial<Record<LayerId, number>> = {};
        steps.forEach((s) => {
            if (s.depth === 0 || s.kind === 'server') acc[s.layer] = (acc[s.layer] ?? 0) + s.ms;
        });
        return acc;
    }, [steps]);

    const seen = useMemo(() => {
        const set = new Set<LayerId>();
        const index = steps.findIndex((s) => s.key === active?.key);
        steps.slice(0, index + 1).forEach((s) => set.add(s.layer));
        return set;
    }, [steps, active]);

    const jumpToLayer = useCallback(
        (id: LayerId) => {
            const step = steps.find((s) => s.layer === id);
            if (step) stepRefs.current[step.key]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
        [steps],
    );

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#0a0a0b] px-4 py-3">
                <div className="min-w-0 font-mono text-[12.5px] text-zinc-400">
                    <span
                        className={`mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle ${playing ? 'animate-pulse bg-white shadow-[0_0_10px_#fff]' : 'bg-white/60'}`}
                    />
                    GET <span className="text-zinc-100">/api/stack</span>
                    {trace && (
                        <span className="ml-1">
                            · {trace.status} · <span className="text-zinc-100">{trace.duration_ms.toFixed(1)} ms</span> at the server
                            {client && <> · {ms(client.total_ms)} ms in the browser</>} · cache {cache}
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {trace && !playing && (
                        <>
                            <button
                                type="button"
                                onClick={() => play(steps, 'slow')}
                                className="font-mono text-[12.5px] text-zinc-500 underline decoration-white/25 underline-offset-4 hover:text-zinc-100"
                            >
                                replay slowly
                            </button>
                            <button
                                type="button"
                                onClick={() => play(steps, 'real')}
                                className="font-mono text-[12.5px] text-zinc-500 underline decoration-white/25 underline-offset-4 hover:text-zinc-100"
                            >
                                1× real time
                            </button>
                        </>
                    )}
                    <button
                        type="button"
                        onClick={send}
                        disabled={status === 'sending' || playing}
                        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
                    >
                        {status === 'idle' ? 'Send the request' : status === 'sending' ? 'Sending…' : playing ? 'Playing…' : 'Send it again'}
                    </button>
                </div>
            </div>

            {status === 'error' && (
                <p className="mt-4 rounded-lg border border-orange-400/30 bg-orange-400/5 px-4 py-3 text-sm text-orange-200">
                    The request did not come back with a trace. Tracing may be disabled, or the record expired before it could be read.
                </p>
            )}

            {status === 'idle' && (
                <p className="mt-6 max-w-2xl text-zinc-400">
                    Nothing is staged here. Press the button and the page will call its own API, read the trace id off the response, post back what
                    only the browser can measure, and then draw the record that came out of it.
                </p>
            )}

            {trace && active && (
                <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:items-start lg:gap-16">
                    <div className="top-16 hidden max-h-[calc(100vh-5rem)] lg:sticky lg:block">
                        <div className="flex items-baseline gap-2">
                            <span className="font-mono text-4xl font-medium text-zinc-50 tabular-nums">{ms(elapsed ?? total)}</span>
                            <span className="font-mono text-sm text-zinc-500">ms{playing ? ' · playing' : ' · end to end'}</span>
                        </div>
                        <StackVisual
                            className="mx-auto max-h-[56vh] w-full"
                            active={active.layer}
                            seen={seen}
                            totals={totals}
                            orbY={orbY}
                            flying={playing}
                            onPick={jumpToLayer}
                            format={ms}
                        />
                        <div className="mt-2 min-h-[72px] rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3">
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="truncate text-[15px] font-medium text-zinc-50">{active.title}</span>
                                <span className={`shrink-0 font-mono text-[13px] ${active.slow ? 'text-orange-400' : 'text-zinc-300'}`}>
                                    {ms(active.ms)} ms
                                </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[13px] text-zinc-400">{active.detail}</p>
                        </div>
                        <div className="mt-3">
                            <div className="mb-2 font-mono text-[11px] tracking-[0.12em] text-zinc-500 uppercase">Where the time went</div>
                            <Bar
                                steps={steps}
                                activeKey={active.key}
                                onPick={(key) => stepRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                            />
                            <div className="mt-2 font-mono text-[11px] text-zinc-600">
                                {trace.runtime.server} · PHP {trace.runtime.php} · Laravel {trace.runtime.laravel}
                                {rows !== null && <> · {rows} rows returned</>}
                            </div>
                        </div>
                    </div>

                    <div className="sticky top-14 z-20 -mx-4 border-b border-white/8 bg-black/90 px-4 pt-3 pb-3 backdrop-blur lg:hidden">
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="font-mono text-2xl font-medium text-zinc-50 tabular-nums">
                                {ms(elapsed ?? total)} <span className="text-sm text-zinc-500">ms{playing ? ' · playing' : ''}</span>
                            </span>
                            <span className={`shrink-0 font-mono text-[12px] ${active.slow ? 'text-orange-400' : 'text-zinc-400'}`}>
                                {ms(active.ms)} ms
                            </span>
                        </div>
                        <StackVisual
                            className="mx-auto my-2 max-h-[34vh] w-full"
                            active={active.layer}
                            seen={seen}
                            totals={totals}
                            orbY={orbY}
                            flying={playing}
                            onPick={jumpToLayer}
                            format={ms}
                        />
                        <div className="mb-2 truncate text-[14px] font-medium text-zinc-100">{active.title}</div>
                        <Bar steps={steps} activeKey={active.key} onPick={setActiveKey} />
                    </div>

                    <div>
                        {steps.map((step, i) => (
                            <section
                                key={step.key}
                                ref={(el) => {
                                    stepRefs.current[step.key] = el;
                                }}
                                className={`scroll-mt-24 border-t border-white/8 py-8 transition-opacity first:border-t-0 lg:py-[9vh] ${
                                    step.key === active.key ? 'opacity-100' : 'opacity-55'
                                }`}
                            >
                                <div className="flex flex-wrap items-baseline gap-2 font-mono text-[11px] tracking-[0.12em] uppercase">
                                    <span className="text-sky-300">{String(i + 1).padStart(2, '0')}</span>
                                    <span className="text-zinc-500">{LAYERS.find((l) => l.id === step.layer)?.name}</span>
                                    {step.depth > 0 && <span className="text-zinc-600">nested</span>}
                                </div>
                                <h3 className="mt-3 flex flex-wrap items-baseline gap-3 text-xl leading-tight font-medium text-zinc-50 sm:text-2xl">
                                    {step.title}
                                    <span className={`font-mono text-sm ${step.slow ? 'text-orange-400' : 'text-zinc-400'}`}>{ms(step.ms)} ms</span>
                                </h3>
                                <p className="mt-3 text-zinc-200">{step.detail}</p>

                                {step.sql && (
                                    <pre className="mt-4 overflow-x-auto rounded-lg border border-white/8 bg-[#08080a] px-4 py-3 font-mono text-[12px] leading-relaxed text-zinc-200">
                                        {step.sql}
                                    </pre>
                                )}
                                {step.explain && step.explain.length > 0 && (
                                    <div className="mt-3 overflow-x-auto">
                                        <table className="w-max min-w-full border-collapse font-mono text-[11.5px]">
                                            <thead>
                                                <tr>
                                                    {Object.keys(step.explain[0]).map((key) => (
                                                        <th
                                                            key={key}
                                                            className="pr-4 pb-1 text-left text-[10px] tracking-[0.1em] text-zinc-500 uppercase"
                                                        >
                                                            {key}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {step.explain.map((row, r) => (
                                                    <tr key={r}>
                                                        {Object.values(row).map((value, c) => (
                                                            <td
                                                                key={c}
                                                                className="border-t border-white/8 py-1.5 pr-4 whitespace-nowrap text-zinc-300"
                                                            >
                                                                {String(value)}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {step.why && (
                                    <div className="mt-5 border-l-2 border-white/20 py-1 pl-4">
                                        <div className="font-mono text-[10.5px] tracking-[0.14em] text-sky-300 uppercase">Why</div>
                                        <p className="mt-1.5 text-[15px] text-zinc-400">{step.why}</p>
                                    </div>
                                )}

                                <Code step={step} />
                            </section>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
