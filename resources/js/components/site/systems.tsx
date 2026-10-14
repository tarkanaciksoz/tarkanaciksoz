import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from '@/lib/gsap';
import type { System } from '@/types/portfolio';
import { useRef } from 'react';
import { DitherImage } from '../signal/dither-image';
import { SectionHead } from './section-head';
import { SectionState, type Loadable } from './section-state';

function Panel({ system }: { system: System }) {
    return (
        <article className="sys-panel pan:h-full pan:w-[min(86vw,1240px)] pan:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] pan:gap-12 pan:py-0 pan:pr-16 grid w-full shrink-0 grid-cols-[minmax(0,1fr)] gap-6 py-10">
            {system.image ? (
                <DitherImage src={system.image} alt={system.title} className="pan:aspect-auto pan:h-full aspect-[3/2] w-full bg-white/[0.015]" />
            ) : (
                <div className="pan:block hidden" />
            )}
            <div className="flex min-h-0 flex-col">
                <h3 className="max-w-[20ch] text-3xl leading-[1.02] font-semibold tracking-[-0.03em] text-zinc-50 sm:text-4xl">{system.title}</h3>
                <p className="mt-4 max-w-[52ch] text-lg leading-snug text-zinc-300">{system.summary}</p>

                <dl className="sys-body mt-7 grid gap-x-6 gap-y-4 text-[14.5px] leading-relaxed sm:grid-cols-[84px_minmax(0,1fr)]">
                    <dt className="font-mono text-[12px] text-zinc-500">problem</dt>
                    <dd className="text-zinc-400">{system.problem}</dd>
                    <dt className="font-mono text-[12px] text-zinc-500">how</dt>
                    <dd className="text-zinc-200">{system.approach}</dd>
                    {system.lesson && (
                        <>
                            <dt className="font-mono text-[12px] text-[#ff3b30]">learned</dt>
                            <dd className="text-zinc-400">{system.lesson}</dd>
                        </>
                    )}
                </dl>

                <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-7">
                    <ul className="flex flex-wrap gap-1.5">
                        {system.tags.map((tag) => (
                            <li key={tag} className="rounded-[2px] border border-white/12 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                                {tag}
                            </li>
                        ))}
                    </ul>
                    {system.scale && <p className="font-mono text-[12px] text-zinc-200">{system.scale}</p>}
                </div>
            </div>
        </article>
    );
}

/**
 * What I have built, as a track that pans sideways while the page scrolls
 * down: one photograph and one problem at a time. On phones, short screens and
 * under reduced motion the panels simply stack or scroll.
 */
export function Systems({ state }: { state: Loadable<System[]> }) {
    const root = useRef<HTMLElement>(null);
    const track = useRef<HTMLDivElement>(null);
    const bar = useRef<HTMLDivElement>(null);
    const systems = state.data ?? [];

    useGSAP(
        () => {
            if (!systems.length || prefersReducedMotion()) return;
            const mm = gsap.matchMedia();

            mm.add('(min-width: 1024px) and (min-height: 760px)', () => {
                const el = track.current!;
                const distance = () => Math.max(0, el.scrollWidth - el.parentElement!.clientWidth);

                const pan = gsap.to(el, {
                    x: () => -distance(),
                    ease: 'none',
                    scrollTrigger: {
                        trigger: root.current,
                        pin: true,
                        start: 'top top',
                        end: () => `+=${distance()}`,
                        scrub: 1,
                        anticipatePin: 1,
                        invalidateOnRefresh: true,
                        onUpdate: (self) => gsap.set(bar.current, { scaleX: self.progress }),
                    },
                });

                // Text follows each photograph in as its panel slides into view.
                gsap.utils.toArray<HTMLElement>('.sys-panel', el).forEach((panel, i) => {
                    if (i === 0) return;
                    gsap.from(panel.querySelector('.sys-body'), {
                        y: 30,
                        autoAlpha: 0,
                        duration: 0.8,
                        ease: 'power3.out',
                        scrollTrigger: { containerAnimation: pan, trigger: panel, start: 'left 70%', toggleActions: 'play none none reverse' },
                    });
                });
            });

            mm.add('not all and (min-width: 1024px) and (min-height: 760px)', () => {
                ScrollTrigger.batch(gsap.utils.toArray<HTMLElement>('.sys-panel', track.current), {
                    start: 'top 85%',
                    once: true,
                    onEnter: (batch) => gsap.from(batch, { y: 40, autoAlpha: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1 }),
                });
            });
        },
        { scope: root, dependencies: [systems.length] },
    );

    return (
        <section ref={root} id="systems" className="pan:h-[100dvh] pan:pt-20 pan:pb-12 relative flex flex-col pt-10">
            <SectionHead title="What I have built">
                {systems.length ? `${systems.length} systems` : 'Systems'} and the problem each one answers, from{' '}
                <span className="font-mono text-[13px] text-zinc-200">GET /api/systems</span>.
            </SectionHead>

            <SectionState
                state={state}
                endpoint="/api/systems"
                skeleton={
                    <div className="pan:grid-cols-[5fr_6fr] mt-10 grid gap-6">
                        <div className="aspect-[3/2] animate-pulse bg-white/[0.03]" />
                        <div className="space-y-3">
                            <div className="h-9 w-2/3 animate-pulse bg-white/[0.04]" />
                            <div className="h-4 w-full animate-pulse bg-white/[0.03]" />
                            <div className="h-4 w-5/6 animate-pulse bg-white/[0.03]" />
                        </div>
                    </div>
                }
            >
                <div className="pan:block mt-8 hidden h-px w-full bg-white/10">
                    <div ref={bar} className="h-px origin-left scale-x-0 bg-[#ff3b30]" />
                </div>
                <div className="pan:-mr-12 pan:overflow-hidden pan:motion-reduce:overflow-x-auto mt-8 min-h-0 flex-1">
                    <div ref={track} className="pan:h-full pan:w-max pan:flex-row flex flex-col">
                        {systems.map((system) => (
                            <Panel key={system.slug} system={system} />
                        ))}
                    </div>
                </div>
            </SectionState>
        </section>
    );
}
