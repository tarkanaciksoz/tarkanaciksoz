import { ms } from '@/lib/api';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsap';
import { introDone } from '@/lib/intro';
import { useMagnetic } from '@/lib/magnetic';
import type { Profile } from '@/types/portfolio';
import { ArrowDown, ArrowUpRight } from '@phosphor-icons/react';
import { useRef } from 'react';
import { SplitReveal } from '../motion/split-reveal';
import { Terminal } from '../terminal/terminal';
import { GlassCanvas } from './glass-canvas';
import type { SceneLayer } from './glass-scene';

export type HeroRequest = { status: number; serverMs: number; cache: string | null } | 'failed';

/**
 * First screen: who, what, two ways in, and the request that drew the page,
 * standing in a glass box. The terminal answers in the voice of the site.
 */
export function Hero({ profile, layers, request }: { profile: Profile | null; layers: SceneLayer[] | null; request: HeroRequest | null }) {
    const root = useRef<HTMLElement>(null);
    const primary = useMagnetic<HTMLAnchorElement>(0.3);
    const secondary = useMagnetic<HTMLAnchorElement>(0.3);

    useGSAP(
        () => {
            if (prefersReducedMotion()) return;
            // Everything below the headline waits for the boot screen to open, then follows it in.
            const entrance = gsap
                .timeline({ paused: true, delay: 0.15, defaults: { ease: 'power3.out' } })
                .from('[data-hero="sub"]', { y: 18, autoAlpha: 0, duration: 0.9 }, 0.5)
                .from('[data-hero="cta"] > *', { y: 14, autoAlpha: 0, duration: 0.7, stagger: 0.08 }, 0.65)
                .from('[data-hero="term"]', { y: 24, autoAlpha: 0, duration: 1 }, 0.8)
                .from('[data-hero="figure"]', { autoAlpha: 0, scale: 0.94, duration: 1.4, ease: 'expo.out' }, 0.2)
                .from('[data-hero="caption"]', { autoAlpha: 0, duration: 1 }, 1.1);
            introDone.then(() => entrance.play());

            // The words leave a little faster than the page, so the box is the last thing to go.
            gsap.to('[data-hero="copy"]', {
                yPercent: -10,
                autoAlpha: 0.25,
                ease: 'none',
                scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true },
            });
        },
        { scope: root },
    );

    return (
        <section
            ref={root}
            id="top"
            className="relative grid min-h-[calc(100dvh-3.5rem)] grid-cols-[minmax(0,1fr)] gap-8 pt-10 pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-0 lg:pt-4 lg:pb-10"
        >
            <div data-hero="copy" className="relative min-w-0">
                {profile ? (
                    <SplitReveal
                        as="h1"
                        text={profile.headline}
                        delay={0.15}
                        glitch={[5, 11]}
                        className="max-w-[15ch] text-[clamp(46px,5.4vw,86px)] leading-[0.94] font-semibold tracking-[-0.05em] text-zinc-50"
                    />
                ) : (
                    <h1 aria-hidden="true" className="invisible text-[clamp(46px,5.4vw,86px)] leading-[0.94]">
                        &nbsp;
                        <br />
                        &nbsp;
                    </h1>
                )}
                <p data-hero="sub" className="mt-7 max-w-[42ch] text-lg leading-relaxed text-zinc-400 sm:text-xl">
                    {profile?.intro ?? ' '}
                </p>
                <div data-hero="cta" className="mt-9 flex flex-wrap gap-3">
                    <a
                        ref={primary}
                        href="#made"
                        className="jitter group inline-flex items-center gap-2.5 rounded-[2px] bg-zinc-50 px-5 py-3 font-mono text-[12.5px] tracking-[0.08em] whitespace-nowrap text-black uppercase transition-colors hover:bg-[#ff3b30] active:translate-y-px"
                    >
                        Watch a request
                        <ArrowDown size={14} weight="bold" className="transition-transform duration-300 group-hover:translate-y-0.5" />
                    </a>
                    <a
                        ref={secondary}
                        href="/docs/api"
                        className="jitter group inline-flex items-center gap-2.5 rounded-[2px] border border-white/25 px-5 py-3 font-mono text-[12.5px] tracking-[0.08em] whitespace-nowrap text-zinc-100 uppercase transition-colors hover:border-white active:translate-y-px"
                    >
                        API docs
                        <ArrowUpRight
                            size={14}
                            weight="bold"
                            className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        />
                    </a>
                </div>
                <div data-hero="term" className="mt-12 max-w-xl">
                    <Terminal owner="tarkan" intro={`${profile?.role ?? 'Backend & infrastructure engineer'}, ${profile?.location ?? 'Istanbul'}`} />
                </div>
            </div>

            {/* The box bleeds to the right edge of the window; the copy keeps the grid. */}
            <figure data-hero="figure" data-speed="0.85" className="relative min-w-0 lg:-mr-12">
                <GlassCanvas layers={layers} className="h-[48vh] min-h-[320px] w-full lg:h-[min(72vh,700px)]" />
                <figcaption data-hero="caption" className="mt-2 font-mono text-[12px] text-zinc-500">
                    {request === 'failed' ? (
                        'The trace for this page could not be read.'
                    ) : request ? (
                        <>
                            The request that drew this page: <span className="text-zinc-200">GET /api/stack</span>,{' '}
                            <span className="text-zinc-200">{ms(request.serverMs)} ms</span> at the server, cache {request.cache ?? 'n/a'}.
                        </>
                    ) : (
                        'Reading the trace of the request that drew this page.'
                    )}
                </figcaption>
            </figure>
        </section>
    );
}
