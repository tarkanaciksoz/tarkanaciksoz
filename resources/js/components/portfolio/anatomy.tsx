import { apiGet, fetchTrace, ms, postClientTiming } from '@/lib/api';
import { ScrollTrigger } from '@/lib/gsap';
import type { ClientTiming, StackResponse, Trace } from '@/types/portfolio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DigitRoll } from '../signal/digit-roll';
import { crc32, HexDump } from '../signal/hex-dump';
import { NoiseField } from '../signal/noise-field';
import { buildSteps, LAYERS, type LayerId, type Step } from './anatomy-steps';
import { BootLog, type LogLine } from './boot-log';
import { ASSEMBLY_MS, DROP_STAGGER, dropOrder, layerY, StackVisual, VISUAL_LAYERS } from './stack-visual';

/** Slow motion: the whole request stretched to about this many seconds. */
const PLAYBACK_SECONDS = 6;

type Status = 'waiting' | 'building' | 'sending' | 'ready' | 'error';

function Bar({ steps, activeKey, onPick }: { steps: Step[]; activeKey: string; onPick: (key: string) => void }) {
    const total = steps.reduce((n, s) => n + s.ms, 0) || 1;
    return (
        <div className="flex h-2 gap-[2px]">
            {steps.map((step) => (
                <button
                    key={step.key}
                    type="button"
                    title={`${step.title}: ${ms(step.ms)} ms`}
                    onClick={() => onPick(step.key)}
                    style={{ flexGrow: Math.max(step.ms / total, 0.012) }}
                    className={`min-w-[2px] rounded-[2px] transition-colors ${
                        step.key === activeKey
                            ? step.slow
                                ? 'bg-[#ff3b30]'
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
        <div className="mt-4 overflow-hidden rounded-[2px] border border-white/8 bg-[#08080a]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-3 py-2 font-mono text-[11px] text-zinc-400">
                <span className="break-all">{src.file}</span>
                <span className="flex items-center gap-2">
                    {src.vendor ? (
                        <span className="rounded border border-white/12 px-1.5 py-0.5 text-[10px] text-zinc-400">vendor</span>
                    ) : (
                        src.commit && (
                            <span className="rounded-[2px] border border-white/25 px-1.5 py-0.5 text-[10px] text-zinc-200">{src.commit}</span>
                        )
                    )}
                </span>
            </div>
            <pre className="overflow-x-auto py-2 font-mono text-[11.5px] leading-relaxed">
                {src.excerpt.map((line) => {
                    const hit = line.n >= src.line_start && line.n <= src.line_end;
                    return (
                        <div
                            key={line.n}
                            className={`grid grid-cols-[42px_minmax(0,1fr)] ${hit ? 'bg-[#ff3b30]/10 shadow-[inset_2px_0_0_#ff3b30]' : ''}`}
                        >
                            <span className={`pr-3 text-right select-none ${hit ? 'text-[#ff3b30]' : 'text-zinc-600'}`}>{line.n}</span>
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
    const [status, setStatus] = useState<Status>('waiting');
    const [trace, setTrace] = useState<Trace | null>(null);
    const [client, setClient] = useState<ClientTiming | null>(null);
    const [cache, setCache] = useState<string | null>(null);
    const [rows, setRows] = useState<number | null>(null);
    const [raw, setRaw] = useState<string>('');
    const [activeKey, setActiveKey] = useState<string>('');
    const [playing, setPlaying] = useState(false);
    const [elapsed, setElapsed] = useState<number | null>(null);
    const [orbY, setOrbY] = useState(() => layerY('browser'));
    const [building, setBuilding] = useState(false);
    const [log, setLog] = useState<LogLine[]>([]);
    const stepRefs = useRef<Record<string, HTMLElement | null>>({});
    const rootRef = useRef<HTMLDivElement>(null);
    const frame = useRef<number>(0);
    const playhead = useRef(0);
    const clock = useRef(0);
    const running = useRef(false);

    const steps = useMemo(() => (trace ? buildSteps(trace, client) : []), [trace, client]);
    const active = steps.find((s) => s.key === activeKey) ?? steps[0] ?? null;
    const stepSum = useMemo(() => steps.reduce((n, s) => n + s.ms, 0), [steps]);
    // Steps overlap (a span contains its children), so the honest total is the measured one, not the sum.
    const total = client?.total_ms ?? trace?.duration_ms ?? stepSum;
    const shown = elapsed !== null && stepSum ? (Math.min(elapsed, stepSum) / stepSum) * total : total;
    const corrupt = !!active && (!!active.slow || (cache === 'miss' && (active.layer === 'db' || active.layer === 'cache')));
    const unclaimedMs = steps.find((s) => s.kind === 'gap')?.ms ?? 0;
    const unattributedShare = trace ? Math.min(0.9, unclaimedMs / Math.max(trace.duration_ms, 0.001)) : 0;
    const checksum = useMemo(() => (raw ? crc32(raw) : null), [raw]);

    const say = useCallback((text: string, tone: LogLine['tone'] = 'plain', tail?: string) => {
        const t = (performance.now() - clock.current) / 1000;
        setLog((lines) => [...lines, { t, text, tone, tail }]);
    }, []);

    /** Runs the recorded request back at a walking pace, in its real proportions. */
    const play = useCallback((list: Step[], speed: 'slow' | 'real') => {
        cancelAnimationFrame(frame.current);
        const sum = list.reduce((n, s) => n + s.ms, 0);
        if (!sum) return;

        const schedule: { step: Step; from: number; to: number; y: number; prevY: number }[] = [];
        let at0 = 0;
        let prevY = layerY('browser');
        list.forEach((step) => {
            const y = layerY(step.layer);
            schedule.push({ step, from: at0, to: at0 + step.ms, y, prevY });
            at0 += step.ms;
            prevY = y;
        });

        const factor = speed === 'real' ? 1 : (PLAYBACK_SECONDS * 1000) / sum;
        const startedAt = performance.now();
        setPlaying(true);
        playhead.current = -1;

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
            const index = schedule.indexOf(current);
            if (playhead.current !== index) {
                playhead.current = index;
                setActiveKey(current.step.key);
            }

            frame.current = requestAnimationFrame(tick);
        };

        frame.current = requestAnimationFrame(tick);
    }, []);

    /** Build the tower, send the request, read its trace, replay it. Nothing waits for a click. */
    const run = useCallback(async () => {
        if (running.current) return;
        running.current = true;
        cancelAnimationFrame(frame.current);

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        clock.current = performance.now();
        setLog([]);
        setTrace(null);
        setElapsed(null);
        setPlaying(false);
        setStatus('building');
        setBuilding(!reduced);

        // Each layer reports in as it lands, bottom-up, in step with the drawing.
        [...VISUAL_LAYERS]
            .sort((a, b) => dropOrder(a.id) - dropOrder(b.id))
            .forEach((layer) => {
                window.setTimeout(
                    () => say(`mount /${layer.id} `.padEnd(16, '.') + ` ${layer.name}`, 'ok', '[ ok ]'),
                    reduced ? 0 : dropOrder(layer.id) * DROP_STAGGER + 420,
                );
            });

        await new Promise((resolve) => window.setTimeout(resolve, reduced ? 20 : ASSEMBLY_MS + 120));
        setBuilding(false);

        try {
            setStatus('sending');
            say('GET /api/stack', 'plain', 'sending');
            const result = await apiGet<StackResponse>('/api/stack');
            setCache(result.cache);
            setRows(result.body.meta.items);
            setRaw(result.raw);
            setClient(result.timing);
            const bytes = new TextEncoder().encode(result.raw).length;
            say(
                `← ${result.status}  ${bytes.toLocaleString()} B  cache ${result.cache ?? 'n/a'}`,
                result.cache === 'miss' ? 'hot' : 'ok',
                `crc32 ${crc32(result.raw)}`,
            );

            if (!result.traceId) throw new Error('no trace id');
            say(`X-Trace-Id ${result.traceId}`, 'dim');

            if (result.timing) {
                await postClientTiming(result.traceId, result.timing);
                say('POST /api/traces/{id}/client-timing', 'plain', `dns ${ms(result.timing.dns_ms)}  ttfb ${ms(result.timing.ttfb_ms)} ms`);
            }

            const recorded = await fetchTrace(result.traceId);
            if (!recorded) throw new Error('trace not found');
            const queries = recorded.spans.filter((s) => s.kind === 'query').length;
            say(`GET /api/traces/{id}  ${recorded.spans.length} spans  ${queries} queries`, 'ok', `${recorded.duration_ms.toFixed(1)} ms`);

            const list = buildSteps(recorded, result.timing);
            const slow = list.find((s) => s.slow);
            if (slow) say(`slowest: ${slow.title}`, 'hot', `${ms(slow.ms)} ms`);
            say(`replay  ${list.length} steps in ${PLAYBACK_SECONDS} s`, 'dim');

            setTrace(recorded);
            setStatus('ready');
            play(list, 'slow');
        } catch {
            say('request failed, no trace to read', 'hot');
            setStatus('error');
        } finally {
            running.current = false;
        }
    }, [play, say]);

    // Start on its own the first time the section is on screen.
    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        const trigger = ScrollTrigger.create({ trigger: el, start: 'top 70%', once: true, onEnter: () => run() });
        return () => trigger.kill();
    }, [run]);

    useEffect(() => () => cancelAnimationFrame(frame.current), []);

    useEffect(() => {
        if (steps.length && !steps.some((s) => s.key === activeKey)) setActiveKey(steps[0].key);
    }, [steps, activeKey]);

    /** Once the replay has finished, scrolling the steps drives the light instead: whichever step crosses the middle owns it. */
    useEffect(() => {
        if (!steps.length || playing) return;

        const triggers = steps.flatMap((step) => {
            const el = stepRefs.current[step.key];
            if (!el) return [];
            return ScrollTrigger.create({
                trigger: el,
                start: 'top 45%',
                end: 'bottom 45%',
                onToggle: (self) => {
                    if (!self.isActive) return;
                    setActiveKey(step.key);
                    setOrbY(layerY(step.layer));
                },
            });
        });
        ScrollTrigger.refresh();
        return () => triggers.forEach((t) => t.kill());
    }, [steps, playing]);

    const totals = useMemo(() => {
        const acc: Partial<Record<LayerId, number>> = {};
        steps.forEach((s) => {
            if (s.depth === 0 || s.kind === 'server') acc[s.layer] = (acc[s.layer] ?? 0) + s.ms;
        });
        return acc;
    }, [steps]);

    const seen = useMemo(() => {
        if (!active) return new Set<LayerId>(VISUAL_LAYERS.map((l) => l.id));
        const set = new Set<LayerId>();
        const index = steps.findIndex((s) => s.key === active.key);
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

    const busy = status === 'building' || status === 'sending' || playing;
    const headline =
        status === 'waiting'
            ? 'waiting for the section to be seen'
            : status === 'building'
              ? 'assembling the stack'
              : status === 'sending'
                ? 'sending the request'
                : null;

    const tower = (className: string) => (
        <StackVisual
            className={className}
            active={active?.layer ?? null}
            building={building}
            seen={seen}
            totals={totals}
            orbY={orbY}
            flying={playing}
            onPick={jumpToLayer}
            format={ms}
            corrupt={corrupt}
        />
    );

    return (
        <div ref={rootRef}>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2px] border border-white/12 bg-[#050506] px-4 py-3">
                <div className="min-w-0 font-mono text-[12.5px] text-zinc-400">
                    <span className={`mr-2 inline-block h-1.5 w-1.5 align-middle ${busy ? 'blink bg-[#ff3b30]' : 'bg-white/60'}`} />
                    GET <span className="text-zinc-100">/api/stack</span>
                    {trace ? (
                        <span className="ml-3 inline-flex flex-wrap gap-x-4">
                            <span>{trace.status}</span>
                            <span>
                                <span className="text-zinc-100">{trace.duration_ms.toFixed(1)} ms</span> at the server
                            </span>
                            {client && <span>{ms(client.total_ms)} ms in the browser</span>}
                            <span>cache {cache}</span>
                        </span>
                    ) : (
                        <span className="ml-3 text-zinc-600">{headline ?? 'no trace'}</span>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {trace && !busy && (
                        <>
                            <button
                                type="button"
                                onClick={() => play(steps, 'slow')}
                                className="jitter font-mono text-[12.5px] text-zinc-500 underline decoration-white/25 underline-offset-4 hover:text-zinc-100"
                            >
                                replay slowly
                            </button>
                            <button
                                type="button"
                                onClick={() => play(steps, 'real')}
                                className="jitter font-mono text-[12.5px] text-zinc-500 underline decoration-white/25 underline-offset-4 hover:text-zinc-100"
                            >
                                1× real time
                            </button>
                        </>
                    )}
                    <button
                        type="button"
                        onClick={run}
                        disabled={busy}
                        className="jitter rounded-[2px] bg-zinc-50 px-4 py-2 font-mono text-[12px] tracking-[0.08em] text-black uppercase transition-colors hover:bg-[#ff3b30] disabled:opacity-40"
                    >
                        {status === 'waiting' ? 'Build and send' : busy ? (playing ? 'Replaying…' : 'Working…') : 'Rebuild and send'}
                    </button>
                </div>
            </div>

            <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:items-start lg:gap-16">
                <div className="top-16 hidden max-h-[calc(100vh-5rem)] lg:sticky lg:block">
                    <div className="flex items-baseline justify-between gap-3">
                        <div className="flex items-baseline gap-2">
                            <span
                                className={`font-mono text-5xl font-medium tracking-tight text-zinc-50 tabular-nums ${corrupt ? 'split' : ''}`}
                                data-text={ms(shown)}
                            >
                                {ms(shown)}
                            </span>
                            <span className="font-mono text-sm text-zinc-500">ms{playing ? ', replaying' : trace ? ' end to end' : ''}</span>
                        </div>
                        <span
                            className={`rounded-[2px] px-1.5 py-0.5 font-mono text-[10.5px] tracking-[0.14em] uppercase ${
                                cache === 'miss' ? 'bg-[#ff3b30] text-black' : 'border border-white/20 text-zinc-300'
                            }`}
                        >
                            cache {cache ?? 'n/a'}
                        </span>
                    </div>

                    {tower('mx-auto max-h-[56vh] w-full')}

                    <div className="mt-2 min-h-[72px] rounded-[2px] border border-white/10 bg-white/[0.02] px-4 py-3">
                        {active ? (
                            <>
                                <div className="flex items-baseline justify-between gap-3">
                                    <span className="truncate text-[15px] font-medium text-zinc-50">{active.title}</span>
                                    <span className={`shrink-0 font-mono text-[13px] ${active.slow ? 'text-[#ff3b30]' : 'text-zinc-300'}`}>
                                        {ms(active.ms)} ms
                                    </span>
                                </div>
                                <p className="mt-1 line-clamp-2 text-[13px] text-zinc-400">{active.detail}</p>
                            </>
                        ) : (
                            <p className="font-mono text-[12.5px] text-zinc-500">
                                {headline ?? 'no trace'} <span className="blink inline-block h-3.5 w-2 translate-y-0.5 bg-zinc-400" />
                            </p>
                        )}
                    </div>

                    {trace && active && (
                        <div className="mt-3">
                            <div className="mb-2 font-mono text-[12px] text-zinc-500">where the time went</div>
                            <Bar
                                steps={steps}
                                activeKey={active.key}
                                onPick={(key) => stepRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                            />
                            <div className="mt-2 font-mono text-[11px] text-zinc-600">
                                {trace.runtime.server}, PHP {trace.runtime.php}, Laravel {trace.runtime.laravel}
                                {rows !== null && <>, {rows} rows returned</>}
                            </div>
                        </div>
                    )}
                    {raw && (
                        <div className="scanlines relative mt-4 overflow-hidden rounded-[2px] border border-white/10 bg-[#050506] p-3">
                            <div className="mb-2 flex items-baseline justify-between gap-3 font-mono text-[10.5px] tracking-[0.12em] text-zinc-500 uppercase">
                                <span>response body, {new TextEncoder().encode(raw).length.toLocaleString()} bytes</span>
                                <span>
                                    crc32 <span className="text-zinc-200">{checksum}</span>
                                </span>
                            </div>
                            <HexDump source={raw} rows={5} hot={corrupt ? [18, 34] : null} />
                        </div>
                    )}
                </div>

                <div className="sticky top-14 z-20 -mx-4 border-b border-white/8 bg-[#050506]/90 px-4 pt-3 pb-3 backdrop-blur lg:hidden">
                    <div className="flex items-baseline justify-between gap-3">
                        <span className="font-mono text-2xl font-medium text-zinc-50 tabular-nums">
                            {ms(shown)} <span className="text-sm text-zinc-500">ms{playing ? ', replaying' : ''}</span>
                        </span>
                        <span className={`shrink-0 font-mono text-[12px] ${active?.slow ? 'text-[#ff3b30]' : 'text-zinc-400'}`}>
                            {active ? `${ms(active.ms)} ms` : `cache ${cache ?? 'n/a'}`}
                        </span>
                    </div>
                    {tower('mx-auto my-2 max-h-[34vh] w-full')}
                    <div className="mb-2 truncate text-[14px] font-medium text-zinc-100">{active?.title ?? headline}</div>
                    {trace && active && <Bar steps={steps} activeKey={active.key} onPick={setActiveKey} />}
                </div>

                <div className="min-w-0">
                    <BootLog lines={log} live={busy && !playing} />

                    {steps.map((step, i) => (
                        <section
                            key={step.key}
                            ref={(el) => {
                                stepRefs.current[step.key] = el;
                            }}
                            className={`line-in scroll-mt-24 border-t border-white/8 py-8 transition-opacity lg:py-[9vh] ${
                                step.key === active?.key ? 'opacity-100' : 'opacity-55'
                            }`}
                            style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                        >
                            <h3 className="flex flex-wrap items-baseline gap-3 text-xl leading-tight font-medium text-zinc-50 sm:text-2xl">
                                <span className={step.slow ? 'split' : ''} data-text={step.title}>
                                    {step.title}
                                </span>
                                <span className={`font-mono text-sm ${step.slow ? 'text-[#ff3b30]' : 'text-zinc-400'}`}>
                                    <DigitRoll value={step.ms} format={ms} /> ms{step.slow && ', slowest'}
                                </span>
                            </h3>
                            <div className="mt-1.5 font-mono text-[12px] text-zinc-500">
                                {LAYERS.find((l) => l.id === step.layer)?.name.toLowerCase()}
                                {step.depth > 0 && ', nested'}
                            </div>
                            <p className="mt-3 text-zinc-200">{step.detail}</p>

                            {step.sql && (
                                <pre className="mt-4 overflow-x-auto rounded-[2px] border border-white/8 bg-[#08080a] px-4 py-3 font-mono text-[12px] leading-relaxed text-zinc-200">
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
                                                        <td key={c} className="border-t border-white/8 py-1.5 pr-4 whitespace-nowrap text-zinc-300">
                                                            {String(value)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {step.kind === 'gap' && (
                                <div className="relative mt-4 h-16 overflow-hidden rounded-[2px] border border-white/10 bg-[#050506]">
                                    <NoiseField className="absolute inset-0 h-full w-full" density={0.08 + unattributedShare * 0.5} />
                                    <span className="absolute bottom-1.5 left-2 font-mono text-[10.5px] tracking-[0.12em] text-zinc-400 uppercase">
                                        {Math.round(unattributedShare * 100)}% of server time no span claimed
                                    </span>
                                </div>
                            )}

                            {step.why && (
                                <p className="mt-5 border-l-2 border-[#ff3b30]/60 py-1 pl-4 text-[15px] text-zinc-400">
                                    <span className="mr-2 font-mono text-[12px] text-[#ff3b30]">why</span>
                                    {step.why}
                                </p>
                            )}

                            <Code step={step} />
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
