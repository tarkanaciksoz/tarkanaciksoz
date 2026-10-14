import { apiGet, fetchTrace, ms, postClientTiming } from '@/lib/api';
import { gsap, prefersReducedMotion, remeasure, scrollToY, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { useMagnetic } from '@/lib/magnetic';
import { useStage } from '@/lib/stage';
import type { StackResponse } from '@/types/portfolio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTextFormation } from '../bits/text';
import { Scramble } from '../motion/scramble';
import { Evidence, type RunData } from './evidence';
import { buildSteps } from './steps';
import { buildTimeline, type Row } from './timeline';

/** Scroll per step while pinned, as a share of the viewport height. */
const PER_STEP = 0.4;

type Status = 'waiting' | 'sending' | 'ready' | 'error';

/** What a step is, in words: where it ran, what it was, why it is there. */
function StepText({ row, index, total, number }: { row: Row; index: number; total: number; number: boolean }) {
    const { step } = row;
    return (
        <div className="min-w-0">
            <div className="font-mono text-[12px] text-zinc-400">
                step {index + 1} of {total}, {row.clock === 'browser' ? 'in the browser' : 'at the server'}
                {step.depth > 0 && ', nested'}
            </div>
            <h3 className="mt-2 text-3xl leading-[1.05] font-semibold tracking-[-0.03em] text-zinc-50 sm:text-4xl">{step.title}</h3>
            {number ? (
                <div className={`font-pixel mt-3 text-5xl leading-none ${step.slow ? 'text-[#ff3b30]' : 'text-zinc-100'}`}>
                    <Scramble key={step.key} text={`${ms(step.ms)} ms`} duration={0.5} />
                </div>
            ) : (
                <span className="sr-only">{`${ms(step.ms)} milliseconds`}</span>
            )}
            {step.slow && <div className="mt-2 font-mono text-[12px] text-[#ff3b30]">the slowest thing the server did</div>}
            <p className="mt-4 max-w-[56ch] text-[15.5px] leading-relaxed text-zinc-300">{step.detail}</p>
            {step.why && (
                <p className="mt-4 max-w-[56ch] border-l-2 border-[#ff3b30]/60 pl-4 text-[15px] leading-relaxed text-zinc-400">
                    <span className="mr-2 font-mono text-[12px] text-[#ff3b30]">why</span>
                    {step.why}
                </p>
            )}
        </div>
    );
}

/**
 * The whole request as one rail: a segment per step in the order it ran, each
 * as wide as its time (with a floor, so a 0.1 ms step is still a target). The
 * current one is lit; clicking any segment goes there.
 */
function Rail({ rows, active, onPick }: { rows: Row[]; active: number; onPick: (k: number) => void }) {
    return (
        <div>
            <div className="flex h-10 items-stretch gap-[3px]" role="list" aria-label="Steps of the request, by duration">
                {rows.map((r, k) => {
                    const state = k === active ? 'now' : k < active ? 'past' : 'next';
                    return (
                        <button
                            key={r.step.key}
                            type="button"
                            role="listitem"
                            onClick={() => onPick(k)}
                            aria-current={state === 'now' ? 'step' : undefined}
                            aria-label={`${r.step.title}, ${ms(r.step.ms)} milliseconds`}
                            title={`${r.step.title}: ${ms(r.step.ms)} ms`}
                            style={{ flexGrow: Math.max(r.step.ms, 0.0001), flexBasis: 10 }}
                            className="group relative min-w-[10px]"
                        >
                            <span
                                className={`absolute inset-x-0 bottom-0 transition-all duration-300 ${
                                    state === 'now'
                                        ? `h-full ${r.step.slow ? 'bg-[#ff3b30]' : 'bg-zinc-50'}`
                                        : state === 'past'
                                          ? `h-3 ${r.step.slow ? 'bg-[#ff3b30]/70' : 'bg-zinc-400'} group-hover:h-5`
                                          : 'h-3 bg-white/15 group-hover:h-5 group-hover:bg-white/30'
                                }`}
                            />
                        </button>
                    );
                })}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[11.5px] text-zinc-400">
                <span>fetch()</span>
                <span>each segment is one step, as wide as it took</span>
                <span>last byte</span>
            </div>
        </div>
    );
}

/**
 * How this page was made: the page sends the request behind the map, reads the
 * trace it left, and walks it step by step as the page scrolls. The rail shows
 * where the time went; the bits write the current step's time; the code, SQL,
 * timings or bytes that step rests on sit under it.
 */
export function Machine() {
    const stage = useStage();
    const root = useRef<HTMLDivElement>(null);
    const pinned = useRef<HTMLDivElement>(null);
    const number = useRef<HTMLDivElement>(null);
    const trigger = useRef<ScrollTrigger | null>(null);
    const activeRef = useRef(0);
    const busy = useRef(false);
    const sendButton = useMagnetic<HTMLButtonElement>(0.25);

    const [status, setStatus] = useState<Status>('waiting');
    const [data, setData] = useState<RunData | null>(null);
    const [active, setActive] = useState(0);
    const [runs, setRuns] = useState(0);

    const rows = useMemo(() => (data ? buildTimeline(buildSteps(data.trace, data.client), data.trace, data.client).rows : []), [data]);
    const row = rows[active] ?? rows[0];

    // The bits write the current step's time, large, and re-form into the next one as the page scrolls.
    useTextFormation(
        'made',
        root,
        stage && row ? `${ms(row.step.ms)}ms` : null,
        () => {
            const r = number.current?.getBoundingClientRect();
            return r && r.width > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
        },
        row?.step.slow ? 1 : 0.06,
        0.9,
    );

    const send = useCallback(async () => {
        if (busy.current) return;
        busy.current = true;
        setStatus('sending');
        try {
            const result = await apiGet<StackResponse>('/api/stack');
            if (!result.traceId) throw new Error('no trace id');
            if (result.timing) await postClientTiming(result.traceId, result.timing);
            const trace = await fetchTrace(result.traceId);
            if (!trace) throw new Error('trace not found');
            activeRef.current = 0;
            setActive(0);
            setData({ trace, client: result.timing, raw: result.raw, cache: result.cache });
            setRuns((n) => n + 1);
            setStatus('ready');
        } catch {
            setStatus('error');
        } finally {
            busy.current = false;
        }
    }, []);

    // The request goes out the first time the section is on its way into view.
    useEffect(() => {
        const el = root.current;
        if (!el) return;
        const t = ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => void send() });
        return () => t.kill();
    }, [send]);

    useGSAP(
        () => {
            if (!rows.length || !pinned.current) return;
            const n = rows.length;

            if (!stage) {
                // Unpinned, each step block takes over as it crosses the middle of the screen.
                gsap.utils.toArray<HTMLElement>('.mx-step', root.current).forEach((el, k) =>
                    ScrollTrigger.create({
                        trigger: el,
                        start: 'top 55%',
                        end: 'bottom 55%',
                        onToggle: (self) => {
                            if (!self.isActive) return;
                            activeRef.current = k;
                            setActive(k);
                        },
                    }),
                );
                return;
            }

            trigger.current = ScrollTrigger.create({
                trigger: pinned.current,
                pin: true,
                start: 'top top',
                end: () => `+=${Math.max(1, n - 1) * window.innerHeight * PER_STEP}`,
                anticipatePin: 1,
                invalidateOnRefresh: true,
                onUpdate: (self) => {
                    const i = Math.round(self.progress * (n - 1));
                    if (i !== activeRef.current) {
                        activeRef.current = i;
                        setActive(i);
                    }
                },
            });
            remeasure();
            return () => {
                trigger.current = null;
            };
        },
        { scope: root, dependencies: [runs, stage], revertOnUpdate: true },
    );

    // A new step's words and proof slide in; the frame around them never moves.
    useGSAP(
        () => {
            if (!stage || !data || prefersReducedMotion()) return;
            gsap.fromTo('.mx-detail', { autoAlpha: 0, x: 16 }, { autoAlpha: 1, x: 0, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
        },
        { scope: root, dependencies: [active, runs, stage, data] },
    );

    const pick = useCallback(
        (k: number) => {
            const t = trigger.current;
            const n = rows.length;
            if (t && n > 1) scrollToY(t.start + ((t.end - t.start) * k) / (n - 1));
        },
        [rows.length],
    );

    const again = useCallback(async () => {
        const top = trigger.current?.start;
        await send();
        if (top !== undefined) scrollToY(top);
    }, [send]);

    const t = data?.trace;
    const requestLine = (
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-b border-white/10 pb-4">
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-[12.5px] text-zinc-400">
                <span className="text-zinc-100">GET /api/stack</span>
                {status === 'ready' && t ? (
                    <>
                        <span>{t.status}</span>
                        {data?.client && (
                            <span>
                                <span className="text-zinc-100">{ms(data.client.total_ms)} ms</span> in the browser
                            </span>
                        )}
                        <span>
                            <span className="text-zinc-100">{ms(t.duration_ms)} ms</span> at the server
                        </span>
                        <span className={data?.cache === 'miss' ? 'text-[#ff3b30]' : undefined}>cache {data?.cache ?? 'n/a'}</span>
                    </>
                ) : (
                    <span>
                        {status === 'error'
                            ? 'did not come back with a trace'
                            : status === 'sending'
                              ? 'sending, then reading its trace'
                              : 'goes out when this section comes into view'}
                        <span className="blink ml-1 inline-block h-3 w-1.5 translate-y-0.5 bg-zinc-400" />
                    </span>
                )}
            </div>
            <button
                ref={sendButton}
                type="button"
                onClick={() => void again()}
                disabled={status === 'sending'}
                className="jitter rounded-[2px] border border-white/25 px-4 py-2 font-mono text-[12px] tracking-[0.08em] text-zinc-100 uppercase transition-colors hover:border-white active:translate-y-px disabled:opacity-40"
            >
                {status === 'waiting' ? 'Send it now' : 'Send it again'}
            </button>
        </div>
    );

    const skeleton = (
        <div className="mt-8 space-y-4" aria-hidden="true">
            <div className="h-10 animate-pulse bg-white/[0.04]" />
            <div className="h-6 w-1/3 animate-pulse bg-white/[0.04]" />
            <div className="h-4 w-1/2 animate-pulse bg-white/[0.03]" />
        </div>
    );

    if (!stage) {
        return (
            <div ref={root}>
                <div ref={pinned}>
                    {requestLine}
                    {data && rows.length ? (
                        <ol className="mt-6">
                            {rows.map((r, k) => (
                                <li key={r.step.key} className={`mx-step grid gap-6 py-10 transition-opacity ${k === active ? '' : 'opacity-60'}`}>
                                    <StepText row={r} index={k} total={rows.length} number />
                                    <div className="min-w-0">
                                        <Evidence step={r.step} data={data} />
                                    </div>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        skeleton
                    )}
                </div>
            </div>
        );
    }

    // Pinned: every block has a fixed place and height, so changing steps never moves the frame.
    return (
        <div ref={root}>
            <div ref={pinned} className="flex h-[100dvh] flex-col pt-20 pb-6">
                {requestLine}
                {data && row ? (
                    <>
                        <div className="mt-6">
                            <Rail rows={rows} active={active} onPick={pick} />
                        </div>
                        <div className="mt-8 grid min-h-0 flex-1 grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-14">
                            <div className="mx-detail min-h-0 overflow-hidden">
                                <StepText row={row} index={active} total={rows.length} number={false} />
                            </div>
                            <div className="grid min-h-0 grid-rows-[minmax(90px,20vh)_minmax(0,1fr)] gap-5">
                                {/* The step's time, written by the page's bits; this box only says where. */}
                                <div ref={number} aria-hidden="true" />
                                <div className="mx-detail min-h-0">
                                    <Evidence step={row.step} data={data} />
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    skeleton
                )}
            </div>
        </div>
    );
}
