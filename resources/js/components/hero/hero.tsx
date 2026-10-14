import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { introDone } from '@/lib/intro';
import { useMagnetic } from '@/lib/magnetic';
import type { Profile } from '@/types/portfolio';
import { ArrowDown, ArrowUpRight } from '@phosphor-icons/react';
import { useRef } from 'react';
import { smoothstep } from '../bits/shapes';
import { bitBudget, useBitChapter } from '../bits/stage';
import { CYAN, RED, WHITE, type Targets } from '../bits/types';
import { SplitReveal } from '../motion/split-reveal';
import { Terminal } from '../terminal/terminal';

/** The owner's name as a shell user: first name, lower case, plain ASCII. */
const shellUser = (name: string) =>
    name
        .split(' ')[0]
        .normalize('NFD')
        .replace(/[^a-zA-Z]/g, '')
        .toLowerCase() || 'owner';

/** At most this many bits form the sphere; the rest drift in the background. */
const SPHERE = 6500;

/**
 * The hero's formation: a sphere of 0/1 glyphs turning slowly, brighter on the
 * near side, torn by a short red/cyan band every few seconds. Scrolling the hero
 * away pours it downward into the next section; on a phone, where that column
 * would run over the text, it bursts outward and fades instead.
 */
function sphere(anchor: HTMLElement | null, progress: number, t: Targets, time: number) {
    if (!anchor) return t.rest(0, t.n);
    const box = anchor.getBoundingClientRect();
    const m = Math.min(t.n, SPHERE);
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const R = Math.min(box.width, box.height) * 0.4;
    const spin = time * 0.12 + (t.pointer.x > 0 ? (t.pointer.x / t.vw - 0.5) * 0.8 : 0);
    const tilt = 0.38;
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const pour = smoothstep(0.02, 0.8, progress);
    const narrow = t.vw < 1024;
    const tearing = time % 3.6 < 0.28;
    const tearY = cy + Math.sin(time * 1.9) * R * 0.6;

    for (let i = 0; i < m; i++) {
        const theta = t.seed[i] * Math.PI * 2 + spin;
        const phi = Math.acos(2 * t.seed2[i] - 1);
        const rad = R * (0.9 + 0.1 * ((t.seed[i] * 7.31) % 1));
        const x3 = rad * Math.sin(phi) * Math.cos(theta);
        const z0 = rad * Math.sin(phi) * Math.sin(theta);
        const y0 = rad * Math.cos(phi);
        const y3 = y0 * ct - z0 * st;
        const z3 = y0 * st + z0 * ct;
        const persp = 700 / (700 - z3);
        let sx = cx + x3 * persp;
        const sy = cy + y3 * persp;
        const depth = (z3 + R) / (2 * R);

        // Leaving: each bit goes at its own moment, down a swaying column of binary (wide screens)
        // or straight out from the centre (phones).
        const leave = smoothstep(0, 1, (pour - t.seed2[i] * 0.4) / 0.6);
        let streamX: number;
        let streamY: number;
        if (narrow) {
            streamX = cx + (sx - cx) * 2.6;
            streamY = cy + (sy - cy) * 2.6;
        } else {
            const fall = t.seed2[i] * t.vh * 2.4;
            streamX = cx + Math.sin(fall * 0.006 + time * 0.8) * 40 + (t.seed[i] - 0.5) * 120;
            streamY = box.bottom - R * 0.4 + fall;
        }

        let [r, g, b] = WHITE;
        if (tearing && Math.abs(sy - tearY) < 12) {
            sx += t.seed[i] < 0.5 ? 16 : -16;
            [r, g, b] = t.seed[i] < 0.5 ? RED : CYAN;
        } else if ((t.seed[i] * 13.7) % 1 < 0.03) [r, g, b] = RED;

        t.x[i] = sx + (streamX - sx) * leave;
        t.y[i] = sy + (streamY - sy) * leave;
        t.a[i] = (0.14 + 0.78 * depth) * (1 - (narrow ? 1 : 0.55) * leave);
        t.r[i] = r;
        t.g[i] = g;
        t.b[i] = b;
        t.s[i] = (7 + 4 * depth) * (1 - 0.25 * leave);
        t.sq[i] = 0;
    }
    t.rest(m, t.n);
}

/**
 * First screen: who, what, two ways in, and the bits of the request that drew
 * the page, gathered into a turning sphere. The terminal answers in the voice of the site.
 */
export function Hero({ profile, bytes }: { profile: Profile | null; bytes: number | null }) {
    const root = useRef<HTMLElement>(null);
    const anchor = useRef<HTMLDivElement>(null);
    const progress = useRef(0);
    const primary = useMagnetic<HTMLAnchorElement>(0.3);
    const secondary = useMagnetic<HTMLAnchorElement>(0.3);

    useBitChapter('hero', root, (t, time) => sphere(anchor.current, progress.current, t, time));

    useGSAP(() => {
        const st = ScrollTrigger.create({
            trigger: root.current,
            start: 'top top',
            end: 'bottom top',
            onUpdate: (self) => (progress.current = self.progress),
        });
        return () => st.kill();
    });

    useGSAP(
        () => {
            if (prefersReducedMotion()) return;
            // Everything below the headline waits for the boot screen to open, then follows it in.
            const entrance = gsap
                .timeline({ paused: true, delay: 0.15, defaults: { ease: 'power3.out' } })
                .from('[data-hero="sub"]', { y: 18, autoAlpha: 0, duration: 0.9 }, 0.5)
                .from('[data-hero="cta"] > *', { y: 14, autoAlpha: 0, duration: 0.7, stagger: 0.08 }, 0.65)
                .from('[data-hero="term"]', { y: 24, autoAlpha: 0, duration: 1 }, 0.8)
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
            // Phones: words, then the sphere, then the terminal. Wide screens: words and terminal left, sphere right.
            className="relative grid min-h-[calc(100svh-3.5rem)] grid-cols-[minmax(0,1fr)] content-start gap-6 pt-8 pb-12 lg:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:grid-rows-[auto_auto] lg:content-center lg:gap-x-0 lg:gap-y-12 lg:pt-4 lg:pb-10"
        >
            <div data-hero="copy" className="relative min-w-0 lg:col-start-1 lg:row-start-1 lg:self-end">
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
                <p data-hero="sub" className="mt-5 max-w-[42ch] text-[17px] leading-relaxed text-zinc-400 sm:mt-7 sm:text-xl">
                    {profile?.intro ?? ' '}
                </p>
                <div data-hero="cta" className="mt-7 grid grid-cols-2 gap-3 sm:mt-9 sm:flex sm:flex-wrap">
                    <a
                        ref={primary}
                        href="#made"
                        className="jitter group inline-flex items-center justify-center gap-2.5 rounded-[2px] bg-zinc-50 px-4 py-3 font-mono text-[12.5px] tracking-[0.08em] whitespace-nowrap text-black uppercase transition-colors hover:bg-[#ff3b30] active:translate-y-px sm:px-5"
                    >
                        Watch a request
                        <ArrowDown size={14} weight="bold" className="transition-transform duration-300 group-hover:translate-y-0.5" />
                    </a>
                    <a
                        ref={secondary}
                        href="/docs/api"
                        className="jitter group inline-flex items-center justify-center gap-2.5 rounded-[2px] border border-white/25 px-4 py-3 font-mono text-[12.5px] tracking-[0.08em] whitespace-nowrap text-zinc-100 uppercase transition-colors hover:border-white active:translate-y-px sm:px-5"
                    >
                        API docs
                        <ArrowUpRight
                            size={14}
                            weight="bold"
                            className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        />
                    </a>
                </div>
            </div>

            {/* The sphere is drawn by the page-wide bit field; this box only says where. */}
            <figure className="relative min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
                <div ref={anchor} className="h-[min(42svh,340px)] w-full lg:h-[min(70vh,680px)]" aria-hidden="true" />
                <figcaption
                    data-hero="caption"
                    className="mx-auto mt-1 max-w-[46ch] text-center font-mono text-[11.5px] text-zinc-400 lg:mt-2 lg:mr-0 lg:max-w-[52ch] lg:text-right lg:text-[12px]"
                >
                    {bytes ? (
                        <>
                            Every dot on this page is {bitBudget(bytes).perDot === 1 ? 'one byte' : `${bitBudget(bytes).perDot} bytes`} of{' '}
                            <span className="text-zinc-200">GET /api/stack</span>, the response that drew it:{' '}
                            <span className="text-zinc-200">{bytes.toLocaleString()} bytes</span>.
                        </>
                    ) : (
                        'Reading the response that draws this page.'
                    )}
                </figcaption>
            </figure>

            <div data-hero="term" className="max-w-xl min-w-0 lg:col-start-1 lg:row-start-2 lg:self-start">
                <Terminal owner={profile ? shellUser(profile.name) : 'owner'} profile={profile} />
            </div>
        </section>
    );
}
