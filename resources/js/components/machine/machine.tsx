import { apiGet, fetchTrace, ms, postClientTiming } from '@/lib/api';
import { gsap, prefersReducedMotion, ScrollSmoother, scrollToY, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { useMagnetic } from '@/lib/magnetic';
import type { StackResponse } from '@/types/portfolio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Scramble } from '../motion/scramble';
import { Evidence, type RunData } from './evidence';
import { buildSteps } from './steps';
import { buildTimeline, type Row } from './timeline';
import { Waterfall } from './waterfall';

/** Wide and tall enough to pin the whole stage: the waterfall above, one step and its proof below. */
const PIN = '(min-width: 1024px) and (min-height: 800px)';
/** Scroll distance per step, as a share of the viewport height. */
const PER_STEP = 0.42;

type Status = 'waiting' | 'sending' | 'ready' | 'error';

function usePinnable() {
    const query = `${PIN} and (prefers-reduced-motion: no-preference)`;
    const [ok, setOk] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
    useEffect(() => {
        const mq = window.matchMedia(query);
        const on = () => setOk(mq.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, [query]);
    return ok;
}

function StepText({ row, index, total }: { row: Row; index: number; total: number }) {
    const { step } = row;
    return (
        <div className="mx-text min-w-0">
            <div className="font-mono text-[12px] text-zinc-400">
                {index + 1} of {total}, {row.clock === 'browser' ? 'in the browser' : 'at the server'}
                {step.depth > 0 && ', nested'}
            </div>
            <h3 className="mt-2 text-3xl leading-[1.05] font-semibold tracking-[-0.03em] text-zinc-50 sm:text-4xl">{step.title}</h3>
            <div className={`font-pixel mt-3 text-5xl leading-none sm:text-6xl ${step.slow ? 'text-[#ff3b30]' : 'text-zinc-100'}`}>
                <Scramble key={step.key} text={`${ms(step.ms)} ms`} duration={0.5} />
            </div>
            {step.slow && <div className="mt-2 font-mono text-[12px] text-[#ff3b30]">the slowest thing the server did</div>}
            <p className="mt-5 max-w-[56ch] text-[15.5px] leading-relaxed text-zinc-300">{step.detail}</p>
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
 * How this page was made: the page sends the request behind the map, reads the
 * trace it left, and lays it out as a waterfall you scroll through one step at a
 * time, with the code, SQL, timings or bytes each step rests on.
 */
export function Machine() {
    const root = useRef<HTMLDivElement>(null);
    const stage = useRef<HTMLDivElement>(null);
    const trigger = useRef<ScrollTrigger | null>(null);
    const activeRef = useRef(0);
    const busy = useRef(false);
    const pinnable = usePinnable();
    const sendButton = useMagnetic<HTMLButtonElement>(0.25);

    const [status, setStatus] = useState<Status>('waiting');
    const [data, setData] = useState<RunData | null>(null);
    const [active, setActive] = useState(0);
    const [runs, setRuns] = useState(0);

    const timeline = useMemo(() => (data ? buildTimeline(buildSteps(data.trace, data.client), data.trace, data.client) : null), [data]);
    const rows = timeline?.rows ?? [];
    const row = rows[active] ?? rows[0];

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
        const t = ScrollTrigger.create({ trigger: el, start: 'top 80%', once: true, onEnter: () => void send() });
        return () => t.kill();
    }, [send]);

    const fills = useCallback((f: number) => {
        gsap.utils.toArray<HTMLElement>('.wf-fill', stage.current).forEach((el, k) => gsap.set(el, { scaleX: gsap.utils.clamp(0, 1, f - k + 1) }));
    }, []);

    useGSAP(
        () => {
            if (!timeline || !stage.current) return;
            const n = timeline.rows.length;
            const reduced = prefersReducedMotion();
            const bars = gsap.utils.toArray<HTMLElement>('.wf-bar', stage.current);

            // The waterfall grows in the order things happened, compressed into a second and a half.
            if (!reduced) {
                gsap.from(bars, { scaleX: 0, duration: 0.55, ease: 'power2.out', delay: (i) => 0.1 + (1.4 * i) / Math.max(n - 1, 1) });
            }

            if (!pinnable) {
                fills(activeRef.current);
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
                            fills(k);
                        },
                    }),
                );
                return;
            }

            fills(0);
            trigger.current = ScrollTrigger.create({
                trigger: stage.current,
                pin: true,
                start: 'top top',
                end: () => `+=${Math.max(1, n - 1) * window.innerHeight * PER_STEP}`,
                anticipatePin: 1,
                invalidateOnRefresh: true,
                // No snap: rounding already steps through the rows, and a snap tween fights the smoother's own scrolling.
                onUpdate: (self) => {
                    const f = self.progress * (n - 1);
                    fills(f);
                    const i = Math.round(f);
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
        { scope: root, dependencies: [runs, pinnable], revertOnUpdate: true },
    );

    // A new step's words and proof arrive; the waterfall above is what moved.
    useGSAP(
        () => {
            if (!pinnable || !data || prefersReducedMotion()) return;
            gsap.fromTo('.mx-detail', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' });
        },
        { scope: root, dependencies: [active, runs, pinnable, data] },
    );

    const pick = useCallback(
        (i: number) => {
            const t = trigger.current;
            const n = rows.length;
            if (t && n > 1) {
                scrollToY(t.start + ((t.end - t.start) * i) / (n - 1));
                return;
            }
            const el = root.current?.querySelectorAll<HTMLElement>('.mx-step')[i];
            if (el) scrollToY(Math.max(0, ScrollSmoother.get()?.offset(el, 'top 120px') ?? el.getBoundingClientRect().top + window.scrollY - 120));
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
            <p className="flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-[12.5px] text-zinc-400">
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
            </p>
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
        <div className="mt-6 space-y-2" aria-hidden="true">
            {[38, 22, 64, 30, 80, 46, 58].map((w, i) => (
                <div
                    key={i}
                    className="grid grid-cols-[minmax(0,104px)_minmax(0,1fr)_48px] items-center gap-3 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)_64px] sm:gap-4"
                >
                    <div className="h-3 w-3/4 animate-pulse bg-white/[0.05]" />
                    <div className="h-2 animate-pulse bg-white/[0.04]" style={{ width: `${w}%`, marginLeft: `${(i * 7) % 30}%` }} />
                    <div className="h-3 animate-pulse bg-white/[0.05]" />
                </div>
            ))}
        </div>
    );

    return (
        <div ref={root}>
            {pinnable ? (
                <div ref={stage} className="flex h-[100dvh] flex-col justify-center pt-16 pb-8">
                    {requestLine}
                    {timeline && data && row ? (
                        <>
                            <div className="mt-5">
                                <Waterfall timeline={timeline} active={active} onPick={pick} />
                            </div>
                            <div className="mx-detail mt-6 grid min-h-0 flex-initial grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-12 border-t border-white/10 pt-6">
                                <StepText row={row} index={active} total={rows.length} />
                                <div className="flex min-h-0 flex-col [&>*]:max-h-full">
                                    <Evidence step={row.step} data={data} />
                                </div>
                            </div>
                        </>
                    ) : (
                        skeleton
                    )}
                </div>
            ) : (
                <div ref={stage}>
                    {requestLine}
                    {timeline && data ? (
                        <>
                            <div className="mt-5">
                                <Waterfall timeline={timeline} active={active} onPick={pick} />
                            </div>
                            <ol className="mt-10">
                                {rows.map((r, i) => (
                                    <li
                                        key={r.step.key}
                                        className={`mx-step grid gap-6 py-10 transition-opacity lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 ${i === active ? '' : 'opacity-60'}`}
                                    >
                                        <StepText row={r} index={i} total={rows.length} />
                                        <div className="min-w-0">
                                            <Evidence step={r.step} data={data} />
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </>
                    ) : (
                        skeleton
                    )}
                </div>
            )}
        </div>
    );
}
