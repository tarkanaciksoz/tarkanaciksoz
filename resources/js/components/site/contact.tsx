import { gsap, prefersReducedMotion, SCRAMBLE_CHARS, ScrollTrigger, useGSAP } from '@/lib/gsap';
import type { Profile } from '@/types/portfolio';
import { useRef } from 'react';
import { SplitReveal } from '../motion/split-reveal';

/** The way out: one question, and every link as a full-width row. */
export function Contact({ profile }: { profile: Profile | null }) {
    const root = useRef<HTMLElement>(null);
    const links = profile?.links ?? [];

    const { contextSafe } = useGSAP(
        () => {
            if (!links.length || prefersReducedMotion()) return;
            ScrollTrigger.batch(gsap.utils.toArray<HTMLElement>('.contact-row', root.current), {
                start: 'top 92%',
                once: true,
                onEnter: (batch) => gsap.from(batch, { yPercent: 40, autoAlpha: 0, duration: 0.8, ease: 'power3.out', stagger: 0.07 }),
            });
        },
        { scope: root, dependencies: [links.length] },
    );

    const hover = contextSafe((e: React.MouseEvent<HTMLAnchorElement>) => {
        if (prefersReducedMotion()) return;
        const label = e.currentTarget.querySelector('[data-label]');
        if (label)
            gsap.to(label, {
                duration: 0.5,
                scrambleText: { text: label.getAttribute('data-label')!, chars: SCRAMBLE_CHARS, speed: 1 },
                overwrite: true,
            });
    });

    return (
        <section ref={root} id="contact" className="relative z-10 pt-24 sm:pt-32">
            <SplitReveal
                text="Want to see a different request?"
                className="max-w-[14ch] text-5xl leading-[0.95] font-semibold tracking-[-0.045em] text-zinc-50 sm:text-7xl xl:text-8xl"
            />
            <p className="mt-6 max-w-[52ch] text-lg text-zinc-400">
                Write with an endpoint or a problem. If it is interesting, it becomes the next thing traced here: a write under a lock, a rejected
                token, the request after the rate limit, a job that outlives its response.
            </p>

            <ul className="mt-14 border-t border-white/12">
                {links.map((link) => (
                    <li key={link.label} className="contact-row border-b border-white/12">
                        <a
                            href={link.href}
                            onMouseEnter={hover}
                            className="group relative flex items-baseline justify-between gap-6 py-6 sm:py-8"
                            {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                        >
                            <span
                                data-label={link.label}
                                className="text-3xl font-medium tracking-[-0.03em] text-zinc-300 transition-colors group-hover:text-zinc-50 sm:text-5xl"
                            >
                                {link.label}
                            </span>
                            <span className="font-mono text-[12px] text-zinc-600 transition-colors group-hover:text-[#ff3b30]">
                                {link.href
                                    .replace(/^mailto:/, '')
                                    .replace(/^https?:\/\//, '')
                                    .replace(/\/$/, '')}
                                <span className="ml-3 inline-block transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
                                    ↗
                                </span>
                            </span>
                            <span className="absolute inset-x-0 -bottom-px h-px origin-left scale-x-0 bg-[#ff3b30] transition-transform duration-500 group-hover:scale-x-100" />
                        </a>
                    </li>
                ))}
            </ul>

            <footer className="mt-20 flex flex-wrap justify-between gap-3 pb-4 font-mono text-[11.5px] text-zinc-600">
                <span>Every number on this page came from the API, live.</span>
                <span>{profile?.location}</span>
            </footer>
        </section>
    );
}
