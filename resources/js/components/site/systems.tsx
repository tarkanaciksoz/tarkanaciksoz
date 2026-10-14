import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { useStage } from '@/lib/stage';
import type { System } from '@/types/portfolio';
import { useEffect, useMemo, useRef, useState } from 'react';
import { sampleImage } from '../bits/shapes';
import { useBitChapter } from '../bits/stage';
import { CYAN, RED, WHITE, type Targets } from '../bits/types';
import { DitherImage } from '../signal/dither-image';
import { SectionHead } from './section-head';
import { SectionState, type Loadable } from './section-state';

/** Scroll per system while pinned, as a share of the viewport height. */
const PER_SYSTEM = 0.7;
/** Dot grid across the photograph's box. */
const COLS = 168;

function Copy({ system }: { system: System }) {
    return (
        <>
            <h3 className="max-w-[20ch] text-3xl leading-[1.02] font-semibold tracking-[-0.03em] text-zinc-50 sm:text-4xl">{system.title}</h3>
            <p className="mt-4 max-w-[52ch] text-lg leading-snug text-zinc-300">{system.summary}</p>
            <dl className="mt-6 grid gap-x-6 gap-y-3 text-[14.5px] leading-relaxed sm:grid-cols-[84px_minmax(0,1fr)]">
                <dt className="font-mono text-[12px] text-zinc-400">problem</dt>
                <dd className="text-zinc-400">{system.problem}</dd>
                <dt className="font-mono text-[12px] text-zinc-400">how</dt>
                <dd className="text-zinc-200">{system.approach}</dd>
                {system.lesson && (
                    <>
                        <dt className="font-mono text-[12px] text-[#ff3b30]">learned</dt>
                        <dd className="text-zinc-400">{system.lesson}</dd>
                    </>
                )}
            </dl>
            <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
                <ul className="flex flex-wrap gap-1.5">
                    {system.tags.map((tag) => (
                        <li key={tag} className="rounded-[2px] border border-white/12 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                            {tag}
                        </li>
                    ))}
                </ul>
                {system.scale && <p className="font-mono text-[12px] text-zinc-200">{system.scale}</p>}
            </div>
        </>
    );
}

/**
 * What I have built. Pinned, the page's bits assemble each project's photograph,
 * hold it while its story is read, then scatter and assemble the next. On phones,
 * short screens and under reduced motion the projects stack, each with its
 * photograph dithered in place.
 */
export function Systems({ state }: { state: Loadable<System[]> }) {
    const stage = useStage();
    const root = useRef<HTMLElement>(null);
    const pinned = useRef<HTMLDivElement>(null);
    const photo = useRef<HTMLDivElement>(null);
    const bar = useRef<HTMLDivElement>(null);
    const dots = useRef<(Float32Array | null)[]>([]);
    const index = useRef(0);
    const systems = useMemo(() => state.data ?? [], [state.data]);
    const [at, setAt] = useState(0);

    // Each photograph is read into dots once, when the section is near.
    useEffect(() => {
        const box = photo.current;
        if (!stage || !box || !systems.length) return;
        const aspect = box.clientWidth / Math.max(1, box.clientHeight);
        let alive = true;
        systems.forEach((s, k) => {
            if (!s.image || dots.current[k]) return;
            sampleImage(s.image, COLS, aspect)
                .then((d) => alive && (dots.current[k] = d))
                .catch(() => undefined);
        });
        return () => {
            alive = false;
        };
    }, [stage, systems]);

    useBitChapter('systems', root, (t: Targets, time: number) => {
        const box = photo.current;
        if (!stage || !box) return t.rest(0, t.n);
        const r = box.getBoundingClientRect();
        // The photograph on screen, or the nearest one already read.
        let d = dots.current[index.current];
        for (let k = index.current; !d && k >= 0; k--) d = dots.current[k];
        if (!d) return t.rest(0, t.n);
        const cell = r.width / COLS;
        const m = Math.min(t.n, d.length / 2);
        const tearing = time % 4.2 < 0.22;
        const tearY = r.top + ((time * 0.37) % 1) * r.height;
        for (let i = 0; i < m; i++) {
            let x = r.left + d[i * 2] * r.width;
            const y = r.top + d[i * 2 + 1] * r.height;
            let [cr, cg, cb] = WHITE;
            if (tearing && Math.abs(y - tearY) < 9) {
                x += t.seed[i] < 0.5 ? 10 : -10;
                [cr, cg, cb] = t.seed[i] < 0.5 ? RED : CYAN;
            }
            t.x[i] = x;
            t.y[i] = y;
            t.a[i] = 0.92;
            t.r[i] = cr;
            t.g[i] = cg;
            t.b[i] = cb;
            t.s[i] = cell * 0.9;
            t.sq[i] = 1;
        }
        t.rest(m, t.n);
    });

    useGSAP(
        () => {
            if (!systems.length) return;
            if (!stage) {
                if (prefersReducedMotion()) return;
                ScrollTrigger.batch(gsap.utils.toArray<HTMLElement>('.sys-panel', root.current), {
                    start: 'top 85%',
                    once: true,
                    onEnter: (batch) => gsap.from(batch, { y: 40, autoAlpha: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1 }),
                });
                return;
            }
            const n = systems.length;
            ScrollTrigger.create({
                trigger: pinned.current,
                pin: true,
                start: 'top top',
                end: () => `+=${(n - 1) * window.innerHeight * PER_SYSTEM}`,
                anticipatePin: 1,
                invalidateOnRefresh: true,
                onUpdate: (self) => {
                    gsap.set(bar.current, { scaleX: self.progress });
                    const k = Math.min(n - 1, Math.round(self.progress * (n - 1)));
                    if (k !== index.current) {
                        index.current = k;
                        setAt(k);
                    }
                },
            });
        },
        { scope: root, dependencies: [systems.length, stage], revertOnUpdate: true },
    );

    // The words change with the picture: out, then in.
    useGSAP(
        () => {
            if (!stage || prefersReducedMotion()) return;
            gsap.fromTo('.sys-copy', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out', overwrite: 'auto' });
        },
        { scope: root, dependencies: [at, stage] },
    );

    const current = systems[at];

    return (
        <section ref={root} id="systems" className="relative pt-10">
            <SectionHead title="What I have built">
                {systems.length ? `${systems.length} systems` : 'Systems'} and the problem each one answers, from{' '}
                <span className="font-mono text-[13px] text-zinc-200">GET /api/systems</span>.
            </SectionHead>

            <SectionState
                state={state}
                endpoint="/api/systems"
                skeleton={
                    <div className="mt-10 grid gap-6 lg:grid-cols-[5fr_6fr]">
                        <div className="aspect-[3/2] animate-pulse bg-white/[0.03]" />
                        <div className="space-y-3">
                            <div className="h-9 w-2/3 animate-pulse bg-white/[0.04]" />
                            <div className="h-4 w-full animate-pulse bg-white/[0.03]" />
                        </div>
                    </div>
                }
            >
                {stage && current ? (
                    <div ref={pinned} className="flex h-[100dvh] flex-col justify-center pt-16 pb-6">
                        <div className="flex items-center gap-6 font-mono text-[12px] text-zinc-400">
                            <div className="h-px flex-1 bg-white/10">
                                <div ref={bar} className="h-px bg-[#ff3b30]" style={{ transform: 'scaleX(0)', transformOrigin: 'left center' }} />
                            </div>
                            <span className="tabular-nums" aria-live="polite">
                                {at + 1} of {systems.length}
                            </span>
                            <a href="#rules" className="text-zinc-300 underline decoration-white/25 underline-offset-4 hover:text-zinc-50">
                                Skip to rules
                            </a>
                        </div>
                        <div className="mt-8 grid min-h-0 grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-center gap-14">
                            {/* The photograph is drawn by the page's bits; this box only says where. */}
                            <div ref={photo} role="img" aria-label={current.title} className="h-[min(62vh,600px)] w-full" />
                            <div className="sys-copy min-w-0">
                                <Copy system={current} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="mt-8">
                        {systems.map((system) => (
                            <article
                                key={system.slug}
                                className="sys-panel grid gap-6 border-t border-white/10 py-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12"
                            >
                                {system.image && (
                                    <DitherImage src={system.image} alt={system.title} className="aspect-[4/3] w-full bg-white/[0.015]" />
                                )}
                                <div className="min-w-0">
                                    <Copy system={system} />
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </SectionState>
        </section>
    );
}
