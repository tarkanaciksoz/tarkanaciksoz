import { gsap, prefersReducedMotion, SCRAMBLE_CHARS, SplitText, useGSAP } from '@/lib/gsap';
import { useMagnetic } from '@/lib/magnetic';
import type { Profile } from '@/types/portfolio';
import { ArrowUpRight } from '@phosphor-icons/react';
import { useRef } from 'react';
import { SplitReveal } from '../motion/split-reveal';

const external = (href: string) => (href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {});

/**
 * The way out: one question, one address set as large as the headline, and the
 * rest of the links small underneath. Hovering the address decodes it again.
 */
export function Contact({ profile }: { profile: Profile | null }) {
    const root = useRef<HTMLElement>(null);
    const links = profile?.links ?? [];
    const primary = links.find((l) => l.href.startsWith('mailto:')) ?? links[0];
    const rest = links.filter((l) => l !== primary);
    const address = primary?.href.replace(/^mailto:/, '') ?? '';

    const arrow = useMagnetic<HTMLSpanElement>(0.5);

    const { contextSafe } = useGSAP(
        () => {
            if (prefersReducedMotion()) return;
            // The paragraph lights up word by word at reading pace, tied to the scroll.
            SplitText.create('.contact-read', {
                type: 'words',
                onSplit: (self) =>
                    gsap.fromTo(
                        self.words,
                        { color: '#3f3f46' },
                        {
                            color: '#d4d4d8',
                            stagger: 0.08,
                            ease: 'none',
                            scrollTrigger: { trigger: '.contact-read', start: 'top 85%', end: 'bottom 45%', scrub: true },
                        },
                    ),
            });
            if (!primary) return;
            gsap.from('.contact-line', {
                y: 30,
                autoAlpha: 0,
                duration: 0.9,
                ease: 'power3.out',
                stagger: 0.12,
                scrollTrigger: { trigger: '.contact-line', start: 'top 90%', once: true },
            });
        },
        { scope: root, dependencies: [address], revertOnUpdate: true },
    );

    const decode = contextSafe((e: React.MouseEvent<HTMLAnchorElement>) => {
        const label = e.currentTarget.querySelector('[data-label]');
        if (!label || prefersReducedMotion()) return;
        gsap.to(label, {
            duration: 0.6,
            scrambleText: { text: label.getAttribute('data-label')!, chars: SCRAMBLE_CHARS, speed: 1 },
            overwrite: true,
        });
    });

    return (
        <section ref={root} id="contact" className="relative pt-10">
            <SplitReveal
                text="Want to see a different request?"
                className="max-w-[14ch] text-5xl leading-[0.95] font-semibold tracking-[-0.045em] text-zinc-50 sm:text-7xl xl:text-8xl"
            />
            <p className="contact-read mt-6 max-w-[52ch] text-xl leading-relaxed text-zinc-300">
                Write with an endpoint or a problem. If it is interesting, it becomes the next thing traced here: a write under a lock, a rejected
                token, the request after the rate limit, a job that outlives its response.
            </p>

            {primary && (
                <a
                    href={primary.href}
                    onMouseEnter={decode}
                    className="contact-line group mt-14 inline-flex max-w-full items-baseline gap-3 sm:gap-5"
                    {...external(primary.href)}
                >
                    <span className="relative min-w-0 font-mono text-[clamp(22px,4.6vw,64px)] leading-tight tracking-[-0.04em] break-all text-zinc-100 transition-colors group-hover:text-zinc-50">
                        {/* ScrambleText rewrites this node only; the underline lives beside it. */}
                        <span data-label={address}>{address}</span>
                        <span className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-[#ff3b30] transition-transform duration-500 group-hover:scale-x-100" />
                    </span>
                    <span ref={arrow} className="inline-flex shrink-0">
                        <ArrowUpRight
                            aria-hidden="true"
                            weight="light"
                            className="size-6 text-zinc-500 transition-colors duration-300 group-hover:text-[#ff3b30] sm:size-10"
                        />
                    </span>
                </a>
            )}

            {rest.length > 0 && (
                <ul className="contact-line mt-10 flex flex-wrap gap-x-10 gap-y-3">
                    {rest.map((link) => (
                        <li key={link.label}>
                            <a
                                href={link.href}
                                className="group inline-flex items-center gap-2 text-lg text-zinc-400 transition-colors hover:text-zinc-50"
                                {...external(link.href)}
                            >
                                {link.label}
                                <ArrowUpRight
                                    aria-hidden="true"
                                    size={16}
                                    weight="light"
                                    className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                                />
                            </a>
                        </li>
                    ))}
                </ul>
            )}

            <footer className="mt-24 flex flex-wrap justify-between gap-3 border-t border-white/8 pt-5 pb-4 font-mono text-[12px] text-zinc-600">
                <span>{profile?.name}</span>
                <span>Every number on this page came from the API, live.</span>
            </footer>
        </section>
    );
}
