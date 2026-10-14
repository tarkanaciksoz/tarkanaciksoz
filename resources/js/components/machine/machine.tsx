import { apiGet, fetchTrace, ms, postClientTiming } from '@/lib/api';
import { gsap, prefersReducedMotion, scrollToY, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { useMagnetic } from '@/lib/magnetic';
import { useStage } from '@/lib/stage';
import type { StackResponse } from '@/types/portfolio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBitChapter } from '../bits/stage';
import { RED, WHITE, type Targets } from '../bits/types';
import { Scramble } from '../motion/scramble';
import { Evidence, type RunData } from './evidence';
import { buildSteps } from './steps';
import { buildTimeline, type Row } from './timeline';

/** Scroll per step while pinned, as a share of the viewport height. */
const PER_STEP = 0.34;
/** Bits poured into the bars; each step gets its share of the request's time. */
const POUR = 5200;

type Status = 'waiting' | 'sending' | 'ready' | 'error';

function StepText({ row, index, total }: { row: Row; index: number; total: number }) {
    const { step } = row;
    return (
        <div className="min-w-0">
            <div className="font-mono text-[12px] text-zinc-400">
                {index + 1} of {total}, {row.clock === 'browser' ? 'in the browser' : 'at the server'}
                {step.depth > 0 && ', nested'}
            </div>
            <h3 className="mt-2 text-3xl leading-[1.05] font-semibold tracking-[-0.03em] text-zinc-50">{step.title}</h3>
            <div className={`font-pixel mt-3 text-5xl leading-none ${step.slow ? 'text-[#ff3b30]' : 'text-zinc-100'}`}>
                <Scramble key={step.key} text={`${ms(step.ms)} ms`} duration={0.5} />
            </div>
            {step.slow && <div className="mt-2 font-mono text-[12px] text-[#ff3b30]">the slowest thing the server did</div>}
            <p className="mt-4 max-w-[56ch] text-[15px] leading-relaxed text-zinc-300">{step.detail}</p>
            {step.why && (
                <p className="mt-3 max-w-[56ch] border-l-2 border-[#ff3b30]/60 pl-4 text-[14.5px] leading-relaxed text-zinc-400">
                    <span className="mr-2 font-mono text-[12px] text-[#ff3b30]">why</span>
                    {step.why}
                </p>
            )}
        </div>
    );
}

/**
 * How this page was made: the page sends the request behind the map, reads the
 * trace it left, and shows where its time went. Bits wait beside the request
 * line; as the page scrolls they pour into each step in turn, as many as that
 * step's share of the time, and the step's proof opens beside it.
 */
export function Machine() {
    const stage = useStage();
    const root = useRef<HTMLDivElement>(null);
    const pinned = useRef<HTMLDivElement>(null);
    const source = useRef<HTMLDivElement>(null);
    const tracks = useRef<(HTMLSpanElement | null)[]>([]);
    const trigger = useRef<ScrollTrigger | null>(null);
    const head = useRef(0);
    const activeRef = useRef(0);
    const busy = useRef(false);
    const sendButton = useMagnetic<HTMLButtonElement>(0.25);

    const [status, setStatus] = useState<Status>('waiting');
    const [data, setData] = useState<RunData | null>(null);
    const [active, setActive] = useState(0);
    const [runs, setRuns] = useState(0);

    const rows = useMemo(() => (data ? buildTimeline(buildSteps(data.trace, data.client), data.trace, data.client).rows : []), [data]);
    const row = rows[active] ?? rows[0];

    // How many bits each step gets, and how long its bar is: both in proportion to its time.
    const shares = useMemo(() => {
        const total = rows.reduce((n, r) => n + r.step.ms, 0) || 1;
        const max = Math.max(...rows.map((r) => r.step.ms), 0.001);
        return rows.map((r) => ({ count: Math.max(16, Math.round((POUR * r.step.ms) / total)), length: r.step.ms / max }));
    }, [rows]);

    useBitChapter('made', root, (t: Targets, time: number) => {
        const src = source.current;
        if (!stage || !src || !rows.length) return t.rest(0, t.n);
        const s = src.getBoundingClientRect();
        const f = head.current;
        const now = Math.round(f);
        let i = 0;
        rows.forEach((r, k) => {
            const bar = tracks.current[k]?.getBoundingClientRect();
            const share = shares[k];
            const length = bar ? Math.max(3, share.length * bar.width) : 0;
            const poured = f >= k - 0.5;
            const isNow = k === now;
            for (let q = 0; q < share.count && i < t.n; q++, i++) {
                if (poured && bar) {
                    t.x[i] = bar.left + t.seed[i] * length;
                    t.y[i] = bar.top + bar.height / 2 + (t.seed2[i] - 0.5) * 10;
                    const [cr, cg, cb] = r.step.slow && k <= now ? RED : WHITE;
                    t.r[i] = cr;
                    t.g[i] = cg;
                    t.b[i] = cb;
                    t.a[i] = isNow ? 1 : 0.5;
                    t.s[i] = isNow ? 3 : 2.4;
                } else {
                    // Still waiting: a loose cloud beside the request line.
                    t.x[i] = s.left + s.width * (0.35 + 0.6 * t.seed[i]);
                    t.y[i] = s.top + s.height / 2 + (t.seed2[i] - 0.5) * 18 + Math.sin(time * 2 + t.seed[i] * 20) * 2;
                    t.r[i] = WHITE[0];
                    t.g[i] = WHITE[1];
                    t.b[i] = WHITE[2];
                    t.a[i] = 0.22;
                    t.s[i] = 2;
                }
                t.sq[i] = 1;
            }
        });
        t.rest(i, t.n);
    });

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
            head.current = 0;
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
                    head.current = self.progress * (n - 1);
                    const i = Math.round(head.current);
                    if (i !== activeRef.current) {
                        activeRef.current = i;
                        setActive(i);
                    }
                },
            });
            ScrollTrigger.refresh();
            return () => {
                trigger.current = null;
            };
        },
        { scope: root, dependencies: [runs, stage], revertOnUpdate: true },
    );

    // A new step's words and proof arrive; the bars are what moved.
    useGSAP(
        () => {
            if (!stage || !data || prefersReducedMotion()) return;
            gsap.fromTo('.mx-detail', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
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
            <div ref={source} className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-[12.5px] text-zinc-400">
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
        <div className="mt-6 space-y-3" aria-hidden="true">
            {[38, 22, 64, 30, 80, 46, 58].map((w, i) => (
                <div key={i} className="h-3 animate-pulse bg-white/[0.04]" style={{ width: `${w}%` }} />
            ))}
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
                                    <StepText row={r} index={k} total={rows.length} />
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

    return (
        <div ref={root}>
            <div ref={pinned} className="flex h-[100dvh] flex-col justify-center pt-16 pb-6">
                {requestLine}
                {data && row ? (
                    <div className="mt-6 grid min-h-0 grid-cols-[minmax(0,6fr)_minmax(0,5fr)] gap-12">
                        <div className="min-w-0">
                            <div className="mb-3 font-mono text-[12px] text-zinc-400">
                                where the time went: one bar of bits per step, in the order it happened
                            </div>
                            <ol>
                                {rows.map((r, k) => {
                                    const state = k === active ? 'now' : k < active ? 'past' : 'next';
                                    return (
                                        <li key={r.step.key}>
                                            <button
                                                type="button"
                                                onClick={() => pick(k)}
                                                aria-current={state === 'now' ? 'step' : undefined}
                                                className="group grid h-[26px] w-full grid-cols-[minmax(0,190px)_minmax(0,1fr)_56px] items-center gap-4 text-left font-mono text-[12px]"
                                            >
                                                <span
                                                    className={`truncate transition-colors group-hover:text-zinc-100 ${
                                                        state === 'now' ? 'text-zinc-50' : state === 'past' ? 'text-zinc-300' : 'text-zinc-400'
                                                    }`}
                                                    style={{ paddingLeft: `${Math.min(r.step.depth, 4) * 10}px` }}
                                                >
                                                    {r.step.title}
                                                </span>
                                                {/* The bar is drawn by the bits; this only marks where. */}
                                                <span
                                                    ref={(el) => {
                                                        tracks.current[k] = el;
                                                    }}
                                                    className="relative block h-full border-b border-white/[0.06]"
                                                />
                                                <span
                                                    className={`text-right tabular-nums ${
                                                        r.step.slow ? 'text-[#ff3b30]' : state === 'now' ? 'text-zinc-50' : 'text-zinc-400'
                                                    }`}
                                                >
                                                    {ms(r.step.ms)}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ol>
                        </div>
                        <div className="mx-detail flex min-h-0 flex-col gap-5">
                            <StepText row={row} index={active} total={rows.length} />
                            <div className="min-h-0 [&>*]:max-h-[36vh]">
                                <Evidence step={row.step} data={data} />
                            </div>
                        </div>
                    </div>
                ) : (
                    skeleton
                )}
            </div>
        </div>
    );
}
