import { ms } from '@/lib/api';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsap';
import type { Profile } from '@/types/portfolio';
import { useRef } from 'react';
import { SplitReveal } from '../motion/split-reveal';
import { Terminal } from '../terminal/terminal';
import { GlassCanvas } from './glass-canvas';
import type { SceneLayer } from './glass-scene';

export type HeroRequest = { status: number; serverMs: number; cache: string | null };

/**
 * First screen: who, what, two ways in, and the request that drew the page,
 * standing in a glass box. The terminal answers in the voice of the site.
 */
export function Hero({ profile, layers, request }: { profile: Profile | null; layers: SceneLayer[] | null; request: HeroRequest | null }) {
    const root = useRef<HTMLElement>(null);

    useGSAP(
        () => {
            if (prefersReducedMotion()) return;
            gsap.timeline({ delay: 0.15, defaults: { ease: 'power3.out' } })
                .from('[data-hero="sub"]', { y: 18, autoAlpha: 0, duration: 0.9 }, 0.5)
                .from('[data-hero="cta"] > *', { y: 14, autoAlpha: 0, duration: 0.7, stagger: 0.08 }, 0.65)
                .from('[data-hero="term"]', { y: 24, autoAlpha: 0, duration: 1 }, 0.8)
                .from('[data-hero="caption"]', { autoAlpha: 0, duration: 1 }, 1.1);

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
            className="relative grid min-h-[calc(100dvh-3.5rem)] grid-cols-[minmax(0,1fr)] gap-8 pt-10 pb-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-4 lg:pt-4 lg:pb-10"
        >
            <div data-hero="copy" className="relative z-10 min-w-0">
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
                        href="#made"
                        className="jitter rounded-[2px] bg-white px-5 py-3 font-mono text-[12.5px] tracking-[0.08em] whitespace-nowrap text-black uppercase transition-colors hover:bg-[#ff3b30] active:translate-y-px"
                    >
                        Watch a request
                    </a>
                    <a
                        href="/docs/api"
                        className="jitter rounded-[2px] border border-white/25 px-5 py-3 font-mono text-[12.5px] tracking-[0.08em] whitespace-nowrap text-zinc-100 uppercase transition-colors hover:border-white active:translate-y-px"
                    >
                        Read the API
                    </a>
                </div>
                <div data-hero="term" className="mt-12 max-w-2xl">
                    <Terminal owner="tarkan" intro={`${profile?.role ?? 'Backend & infrastructure engineer'}, ${profile?.location ?? 'Istanbul'}`} />
                </div>
            </div>

            <div className="relative min-w-0">
                <GlassCanvas layers={layers} className="h-[48vh] min-h-[320px] w-full lg:h-[min(76vh,720px)]" />
                <div
                    data-hero="caption"
                    className="mt-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 font-mono text-[11.5px] text-zinc-500"
                >
                    <span className="flex flex-wrap gap-x-4">
                        <span className="text-zinc-200">GET /api/stack</span>
                        {request ? (
                            <>
                                <span>{request.status}</span>
                                <span>
                                    <span className="text-zinc-200">{ms(request.serverMs)} ms</span> at the server
                                </span>
                                <span>cache {request.cache ?? 'n/a'}</span>
                            </>
                        ) : (
                            <span>reading the trace</span>
                        )}
                    </span>
                    <span>The request that drew this page, layer by layer.</span>
                </div>
            </div>
        </section>
    );
}
