import { requestLog, type LogEntry } from '@/lib/api';
import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { Fragment, useEffect, useRef, useState } from 'react';

const BASE = 55; // px per second when the page is still

function Item({ entry }: { entry: LogEntry }) {
    return (
        <span className="inline-flex items-baseline gap-[0.35em] whitespace-nowrap">
            <span className={entry.method === 'POST' ? 'text-zinc-400' : 'text-[#ff3b30]'}>{entry.method}</span>
            <span className="text-zinc-200">{entry.path}</span>
            <span className={entry.status >= 400 ? 'text-[#ff3b30]' : 'text-zinc-600'}>{entry.status}</span>
            <span className="text-zinc-500">{entry.ms.toFixed(1)}ms</span>
            {entry.cache && <span className={entry.cache === 'miss' ? 'text-[#ff3b30]' : 'text-zinc-600'}>{entry.cache}</span>}
        </span>
    );
}

/**
 * The page's own traffic, as a ticker: every call it has made to its API so far.
 * It drifts on its own, runs with the scroll, turns with it, and leans into speed.
 */
export function LiveMarquee() {
    const [entries, setEntries] = useState<LogEntry[]>(() => [...requestLog.entries()]);
    const root = useRef<HTMLDivElement>(null);
    const track = useRef<HTMLDivElement>(null);
    // Kept across re-renders, so a new entry joining the ticker does not make it jump.
    const motion = useRef({ x: 0, direction: -1, boost: 0 });

    useEffect(() => requestLog.subscribe(() => setEntries([...requestLog.entries()].slice(-14))), []);

    useGSAP(
        () => {
            const el = track.current;
            if (!el || !entries.length || prefersReducedMotion()) return;
            const m = motion.current;
            const skew = gsap.quickTo(el, 'skewX', { duration: 0.4, ease: 'power3.out' });

            const st = ScrollTrigger.create({
                start: 0,
                end: 'max',
                onUpdate: (self) => {
                    m.direction = self.direction === 1 ? -1 : 1;
                    const v = self.getVelocity();
                    m.boost = Math.min(900, Math.abs(v) / 3);
                    skew(gsap.utils.clamp(-8, 8, v / -300));
                },
            });

            const tick = (_time: number, delta: number) => {
                const half = el.scrollWidth / 2;
                if (!half) return;
                m.boost *= 0.92;
                if (m.boost < 1) skew(0);
                m.x = gsap.utils.wrap(-half, 0, m.x + (m.direction * (BASE + m.boost) * delta) / 1000);
                gsap.set(el, { x: m.x });
            };
            gsap.ticker.add(tick);

            return () => {
                gsap.ticker.remove(tick);
                st.kill();
            };
        },
        { scope: root, dependencies: [entries.length], revertOnUpdate: true },
    );

    if (!entries.length) return <div className="h-24 sm:h-32" aria-hidden="true" />;

    // Two copies side by side: when the first has scrolled out, the second is exactly where it started.
    const run = (copy: number) => (
        <div className="flex shrink-0 items-baseline gap-[0.9em] pr-[0.9em]" aria-hidden={copy > 0}>
            {entries.map((entry, i) => (
                <Fragment key={`${copy}-${i}`}>
                    <Item entry={entry} />
                    <span className="text-zinc-800">/</span>
                </Fragment>
            ))}
        </div>
    );

    return (
        <div
            ref={root}
            className="relative -mx-4 overflow-hidden border-y border-white/8 py-5 sm:-mx-8 sm:py-7 lg:-mx-12"
            role="marquee"
            aria-label="Requests this page has made to its own API"
        >
            <div ref={track} className="font-pixel flex w-max text-[clamp(36px,6.4vw,96px)] leading-none will-change-transform">
                {run(0)}
                {run(1)}
            </div>
        </div>
    );
}
