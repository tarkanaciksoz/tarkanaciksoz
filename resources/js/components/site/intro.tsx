import { requestLog, type LogEntry } from '@/lib/api';
import { gsap, prefersReducedMotion, SCRAMBLE_CHARS, useGSAP } from '@/lib/gsap';
import { markIntroDone } from '@/lib/intro';
import { useEffect, useRef, useState } from 'react';

const SEEN_KEY = 'glassbox:booted';
const BANDS = 9;
/** What the page waits for before it opens: its own document, its fonts, and the first two answers from its API. */
const WAITS = ['document', 'fonts', '/api/profile', '/api/stack'];
const MIN_MS = 600;
const MAX_MS = 1600;

const seenThisSession = () => {
    try {
        return sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
        return false;
    }
};

const line = (e: LogEntry) => `${e.method} ${e.path}  ${e.status}  ${e.ms.toFixed(1)} ms${e.cache ? `  cache ${e.cache}` : ''}`;

/**
 * The boot screen: the page loading itself, told with its own numbers (navigation
 * timing, fonts, the first API answers). It counts to 200, then tears open in bands.
 * Once per session; never under reduced motion.
 */
export function Intro() {
    // Not when the visitor arrived at a particular section: they came for it, not for the show.
    const [show] = useState(() => typeof window !== 'undefined' && !prefersReducedMotion() && !seenThisSession() && !window.location.hash);
    const [gone, setGone] = useState(!show);
    const [lines, setLines] = useState<string[]>([]);
    const root = useRef<HTMLDivElement>(null);
    const counter = useRef<HTMLSpanElement>(null);
    const bar = useRef<HTMLDivElement>(null);
    const done = useRef(new Set<string>());

    useEffect(() => {
        if (!show) markIntroDone();
    }, [show]);

    const { contextSafe } = useGSAP(
        () => {
            if (!show) return;
            const html = document.documentElement;
            html.style.overflow = 'hidden';
            const started = performance.now();
            const progress = { value: 0 };
            let finished = false;

            const say = (text: string) => setLines((all) => [...all.slice(-7), text]);
            const tick = (key: string) => {
                if (done.current.has(key)) return;
                done.current.add(key);
                gsap.to(progress, {
                    value: (done.current.size / WAITS.length) * 100,
                    duration: 0.45,
                    ease: 'power2.out',
                    onUpdate: () => {
                        if (counter.current) counter.current.textContent = String(Math.round(progress.value)).padStart(3, '0');
                        gsap.set(bar.current, { scaleX: progress.value / 100 });
                    },
                });
                if (done.current.size === WAITS.length) window.setTimeout(open, Math.max(0, MIN_MS - (performance.now() - started)));
            };

            const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
            say(`GET /  200  ${nav ? (nav.responseStart - nav.requestStart).toFixed(1) : '?'} ms to first byte`);
            if (nav) say(`document parsed in ${nav.domInteractive.toFixed(0)} ms`);
            tick('document');

            document.fonts?.ready.then(() => {
                say('fonts  Geist, Geist Mono, Geist Pixel');
                tick('fonts');
            });

            const seen = (e: LogEntry) => {
                say(line(e));
                if (WAITS.includes(e.path)) tick(e.path);
            };
            requestLog.entries().forEach(seen);
            const off = requestLog.subscribe(seen);
            const timeout = window.setTimeout(() => open(), MAX_MS);

            function open() {
                if (finished) return;
                finished = true;
                off();
                window.clearTimeout(timeout);
                reveal();
            }

            return () => {
                off();
                window.clearTimeout(timeout);
                html.style.overflow = '';
            };
        },
        { scope: root },
    );

    // 200, then the screen tears open band by band, alternating sides.
    const reveal = contextSafe(() => {
        const tl = gsap.timeline({
            onComplete: () => {
                document.documentElement.style.overflow = '';
                try {
                    sessionStorage.setItem(SEEN_KEY, '1');
                } catch {
                    // Private mode: the boot screen simply shows again next time.
                }
                setGone(true);
            },
        });
        tl.to(counter.current, { duration: 0.45, scrambleText: { text: '200', chars: SCRAMBLE_CHARS, speed: 1 } })
            .to('.intro-copy', { autoAlpha: 0, y: -12, duration: 0.25, ease: 'power2.in' }, '+=0.15')
            .add(() => markIntroDone(), '-=0.05')
            .to(
                '.intro-band',
                { xPercent: (i) => (i % 2 ? 101 : -101), duration: 0.7, ease: 'expo.inOut', stagger: { each: 0.035, from: 'center' } },
                '<',
            );
    });

    if (gone) return null;

    return (
        <div ref={root} className="fixed inset-0 z-50" aria-hidden="true">
            {Array.from({ length: BANDS }, (_, i) => (
                <div
                    key={i}
                    className="intro-band absolute inset-x-0 bg-[#050506]"
                    style={{
                        top: `${(i / BANDS) * 100}%`,
                        height: `${100 / BANDS + 0.2}%`,
                        boxShadow: i % 2 ? 'inset 2px 0 0 #22d3ee' : 'inset -2px 0 0 #ff3b30',
                    }}
                />
            ))}
            <div className="intro-copy absolute inset-0 flex flex-col justify-between p-5 sm:p-10 lg:p-12">
                <ol className="max-w-xl font-mono text-[12px] leading-[1.8] text-zinc-400">
                    {lines.map((text, i) => (
                        <li key={`${i}${text}`} className={i === lines.length - 1 ? 'text-zinc-200' : undefined}>
                            {text}
                        </li>
                    ))}
                </ol>
                <div>
                    <div className="flex items-end justify-between gap-6">
                        <span ref={counter} className="font-pixel text-[28vw] leading-[0.78] text-zinc-100 tabular-nums sm:text-[22vw]">
                            000
                        </span>
                        <span className="mb-[2vw] hidden max-w-[22ch] text-right font-mono text-[12px] text-zinc-400 sm:block">
                            This page is loading itself. Every line above is its own request.
                        </span>
                    </div>
                    <div className="mt-4 h-px w-full bg-white/10">
                        <div ref={bar} className="h-px bg-[#ff3b30]" style={{ transform: 'scaleX(0)', transformOrigin: 'left center' }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
