import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from '@/lib/gsap';
import type { System } from '@/types/portfolio';
import { useRef } from 'react';
import { SplitReveal } from '../motion/split-reveal';

function Panel({ system, index, total }: { system: System; index: number; total: number }) {
    return (
        <article className="sys-panel pan:h-full pan:w-[min(80vw,1040px)] pan:border-t-0 pan:border-l pan:px-12 pan:py-2 relative flex w-full shrink-0 flex-col border-t border-white/12 py-10">
            <div className="flex items-start justify-between gap-6">
                <span className="sys-index font-pixel text-[72px] leading-none text-[#ff3b30] sm:text-[96px]">
                    {String(index + 1).padStart(2, '0')}
                </span>
                <span className="mt-2 font-mono text-[11px] text-zinc-600">
                    {index + 1} / {total}
                </span>
            </div>
            <h3 className="mt-5 max-w-[22ch] text-3xl leading-[1.02] font-semibold tracking-[-0.03em] text-zinc-50 sm:text-4xl">{system.title}</h3>
            <p className="mt-4 max-w-[58ch] text-lg text-zinc-300">{system.summary}</p>

            <dl className="sys-body mt-7 grid gap-6 border-t border-white/10 pt-6 text-[14.5px] leading-relaxed md:grid-cols-[1fr_1.35fr_1fr] md:gap-8">
                <div>
                    <dt className="font-mono text-[11px] tracking-[0.12em] text-zinc-500 uppercase">Problem</dt>
                    <dd className="mt-2 text-zinc-400">{system.problem}</dd>
                </div>
                <div>
                    <dt className="font-mono text-[11px] tracking-[0.12em] text-zinc-500 uppercase">How</dt>
                    <dd className="mt-2 text-zinc-200">{system.approach}</dd>
                </div>
                {system.lesson && (
                    <div>
                        <dt className="font-mono text-[11px] tracking-[0.12em] text-zinc-500 uppercase">Learned</dt>
                        <dd className="mt-2 text-zinc-400">{system.lesson}</dd>
                    </div>
                )}
            </dl>

            <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-8">
                <div className="flex flex-wrap gap-1.5">
                    {system.tags.map((tag) => (
                        <span key={tag} className="rounded-[2px] border border-white/12 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                            {tag}
                        </span>
                    ))}
                </div>
                {system.scale && <p className="font-mono text-[12px] text-zinc-200">{system.scale}</p>}
            </div>
        </article>
    );
}

/**
 * What I have built, as a track that pans sideways while the page scrolls
 * down. On phones the panels simply stack.
 */
export function Systems({ systems }: { systems: System[] }) {
    const root = useRef<HTMLElement>(null);
    const track = useRef<HTMLDivElement>(null);
    const bar = useRef<HTMLDivElement>(null);

    useGSAP(
        () => {
            if (!systems.length || prefersReducedMotion()) return;
            const mm = gsap.matchMedia();

            mm.add('(min-width: 1024px) and (min-height: 760px)', () => {
                const el = track.current!;
                const distance = () => Math.max(0, el.scrollWidth - el.clientWidth);

                const pan = gsap.to(el, {
                    x: () => -distance(),
                    ease: 'none',
                    scrollTrigger: {
                        trigger: root.current,
                        pin: true,
                        start: 'top top',
                        end: () => `+=${distance()}`,
                        scrub: 0.6,
                        invalidateOnRefresh: true,
                        onUpdate: (self) => gsap.set(bar.current, { scaleX: self.progress }),
                    },
                });

                // Inside the moving track: each number slides against the panel, the body follows it in.
                gsap.utils.toArray<HTMLElement>('.sys-panel', el).forEach((panel, i) => {
                    gsap.fromTo(
                        panel.querySelector('.sys-index'),
                        { xPercent: 60 },
                        {
                            xPercent: -10,
                            ease: 'none',
                            scrollTrigger: { containerAnimation: pan, trigger: panel, start: 'left right', end: 'right left', scrub: true },
                        },
                    );
                    // The first panel is already in place when the pin starts; only the ones that pan in are revealed.
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
        <section ref={root} id="systems" className="pan:h-[100dvh] pan:pt-20 pan:pb-10 relative z-10 flex flex-col pt-24 sm:pt-32">
            <div className="flex flex-wrap items-end justify-between gap-6">
                <SplitReveal text="What I have built" className="text-4xl leading-[0.98] font-semibold tracking-[-0.04em] text-zinc-50 sm:text-6xl" />
                <p className="max-w-[40ch] text-zinc-400">
                    {systems.length} systems, and the problem each one answers. Read from{' '}
                    <span className="font-mono text-[13px] text-zinc-200">GET /api/systems</span>.
                </p>
            </div>
            <div className="pan:block mt-6 hidden h-px w-full bg-white/10">
                <div ref={bar} className="h-px origin-left scale-x-0 bg-[#ff3b30]" />
            </div>
            <div className="pan:-mx-12 pan:overflow-hidden pan:pl-12 pan:motion-reduce:overflow-x-auto mt-6 min-h-0 flex-1">
                <div ref={track} className="pan:h-full pan:flex-row flex flex-col">
                    {systems.map((system, i) => (
                        <Panel key={system.slug} system={system} index={i} total={systems.length} />
                    ))}
                    <div className="pan:block hidden w-[10vw] shrink-0" aria-hidden="true" />
                </div>
            </div>
        </section>
    );
}
