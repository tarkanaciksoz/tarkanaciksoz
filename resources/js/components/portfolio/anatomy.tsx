import { apiGet, fetchTrace, ms, postClientTiming } from '@/lib/api';
import type { ClientTiming, StackResponse, Trace } from '@/types/portfolio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildSteps, LAYERS, type LayerId, type Step } from './anatomy-steps';
import { Glyph } from './glyph';

type Status = 'idle' | 'sending' | 'ready' | 'error';

function Stack({ active, seen, totals }: { active: LayerId; seen: Set<LayerId>; totals: Record<string, number> }) {
    return (
        <ol className="relative">
            <span className="absolute top-4 bottom-4 left-[15px] w-px bg-white/10" aria-hidden="true" />
            {LAYERS.map((layer) => {
                const on = layer.id === active;
                const visited = seen.has(layer.id);
                const isNode = layer.glyph === 'node';

                return (
                    <li
                        key={layer.id}
                        className={`relative flex items-center gap-3 py-1.5 transition-opacity ${visited ? 'opacity-100' : 'opacity-40'}`}
                    >
                        <span
                            className={`relative z-10 h-[9px] w-[9px] flex-none rounded-full border transition-all ${
                                on ? 'border-white bg-white shadow-[0_0_10px_rgba(255,255,255,.7)]' : 'border-white/25 bg-black'
                            }`}
                            style={{ marginLeft: 11 }}
                        />
                        <span className="flex h-9 w-12 flex-none items-center justify-center">
                            {isNode ? (
                                <span className={`block h-1.5 w-1.5 rotate-45 border ${on ? 'border-white bg-white/80' : 'border-white/30'}`} />
                            ) : (
                                <Glyph kind={layer.glyph} active={on} className="h-9 w-12" />
                            )}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className={`block text-[13px] leading-tight font-medium ${on ? 'text-zinc-50' : 'text-zinc-400'}`}>
                                {layer.name}
                            </span>
                            <span className="block font-mono text-[10.5px] text-zinc-600">{layer.sub}</span>
                        </span>
                        {totals[layer.id] !== undefined && (
                            <span className={`flex-none font-mono text-[11.5px] ${on ? 'text-zinc-100' : 'text-zinc-500'}`}>
                                {ms(totals[layer.id])} ms
                            </span>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}

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
    const stepRefs = useRef<Record<string, HTMLElement | null>>({});

    const steps = useMemo(() => (trace ? buildSteps(trace, client) : []), [trace, client]);
    const active = steps.find((s) => s.key === activeKey) ?? steps[0];

    const send = useCallback(async () => {
        setStatus('sending');
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
        } catch {
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        if (steps.length && !steps.some((s) => s.key === activeKey)) setActiveKey(steps[0].key);
    }, [steps, activeKey]);

    useEffect(() => {
        if (!steps.length) return;
        const onScroll = () => {
            const mid = window.innerHeight * 0.45;
            let current = steps[0].key;
            for (const step of steps) {
                const el = stepRefs.current[step.key];
                if (el && el.getBoundingClientRect().top <= mid) current = step.key;
            }
            setActiveKey(current);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener('scroll', onScroll);
    }, [steps]);

    const totals = useMemo(() => {
        const acc: Record<string, number> = {};
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

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#0a0a0b] px-4 py-3">
                <div className="min-w-0 font-mono text-[12.5px] text-zinc-400">
                    <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-white align-middle shadow-[0_0_8px_#fff]" />
                    GET <span className="text-zinc-100">/api/stack</span>
                    {trace && (
                        <span className="ml-1">
                            · {trace.status} · <span className="text-zinc-100">{trace.duration_ms.toFixed(1)} ms</span> at the server
                            {client && <> · {ms(client.total_ms)} ms in the browser</>} · cache {cache}
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={send}
                    disabled={status === 'sending'}
                    className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
                >
                    {status === 'idle' ? 'Send the request' : status === 'sending' ? 'Sending…' : 'Send it again'}
                </button>
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
                <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-14">
                    <div className="top-16 hidden lg:sticky lg:block">
                        <Stack active={active.layer} seen={seen} totals={totals} />
                        <div className="mt-4">
                            <div className="mb-2 flex items-baseline justify-between gap-3 font-mono text-[11px] tracking-[0.12em] text-zinc-500 uppercase">
                                <span>
                                    Where the time went · <span className="text-zinc-200">{active.title}</span>
                                </span>
                                <span className="text-zinc-200">{ms(active.ms)} ms</span>
                            </div>
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

                    <div className="lg:hidden">
                        <Bar steps={steps} activeKey={active.key} onPick={setActiveKey} />
                    </div>

                    <div>
                        {steps.map((step, i) => (
                            <section
                                key={step.key}
                                ref={(el) => {
                                    stepRefs.current[step.key] = el;
                                }}
                                className="scroll-mt-24 border-t border-white/8 py-8 first:border-t-0 lg:py-[9vh]"
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
