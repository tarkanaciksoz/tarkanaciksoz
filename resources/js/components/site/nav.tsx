import { gsap, prefersReducedMotion, SCRAMBLE_CHARS, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { useRef, useState } from 'react';
import { useGlitchBurst } from '../signal/glitch-burst';

const LINKS: [string, string][] = [
    ['#stack', 'Stack'],
    ['#made', 'Machine'],
    ['#systems', 'Systems'],
    ['#rules', 'Rules'],
    ['/docs/api', 'API docs'],
    ['#contact', 'Contact'],
];

/** Gets out of the way while reading down, comes back on the way up, and knows which section is on screen. */
export function Nav({ name, ready }: { name: string | null; ready: boolean }) {
    const bar = useRef<HTMLElement>(null);
    const nameRef = useRef<HTMLSpanElement>(null);
    const [active, setActive] = useState<string | null>(null);
    useGlitchBurst(nameRef, [10, 22]);

    const { contextSafe } = useGSAP(
        () => {
            const header = bar.current!;
            const reduced = prefersReducedMotion();

            ScrollTrigger.create({
                start: 0,
                end: 'max',
                onUpdate: (self) => {
                    // Hidden only while reading down past the first screenful; anywhere near the top it stays.
                    const hide = self.direction === 1 && self.scroll() > 140;
                    gsap.to(header, { yPercent: hide ? -100 : 0, duration: reduced ? 0 : 0.35, ease: 'power2.out', overwrite: 'auto' });
                },
            });

            LINKS.filter(([href]) => href.startsWith('#')).forEach(([href]) => {
                const section = document.querySelector(href);
                if (!section) return;
                ScrollTrigger.create({
                    trigger: section,
                    start: 'top 45%',
                    end: 'bottom 45%',
                    onToggle: (self) => self.isActive && setActive(href),
                    onLeaveBack: () => href === '#stack' && setActive(null),
                });
            });
        },
        // Sections that wait for their data are found once they exist.
        { scope: bar, dependencies: [ready], revertOnUpdate: true },
    );

    const scramble = contextSafe((e: React.MouseEvent<HTMLAnchorElement>) => {
        if (prefersReducedMotion()) return;
        const label = e.currentTarget.querySelector('[data-label]');
        if (!label) return;
        gsap.to(label, {
            duration: 0.45,
            scrambleText: { text: label.getAttribute('data-label')!, chars: SCRAMBLE_CHARS, speed: 1 },
            overwrite: true,
        });
    });

    return (
        <header ref={bar} className="fixed inset-x-0 top-0 z-40 border-b border-white/8 bg-[#050506]/80 backdrop-blur-md">
            <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-12">
                <a href="#top" className="text-[15px] font-semibold tracking-tight whitespace-nowrap">
                    <span ref={nameRef} className="inline-block">
                        {name ?? ' '}
                    </span>
                </a>
                <nav className="flex items-center gap-4 text-[13px] text-zinc-400 sm:gap-7">
                    {LINKS.map(([href, label]) => (
                        <a
                            key={href}
                            href={href}
                            onMouseEnter={scramble}
                            className={`relative py-1 font-mono text-[12px] tracking-[0.06em] uppercase transition-colors hover:text-zinc-50 ${
                                active === href ? 'text-zinc-50' : ''
                            } whitespace-nowrap ${href === '#rules' || href === '#contact' ? 'hidden md:inline' : href === '/docs/api' ? 'hidden sm:inline' : ''}`}
                        >
                            <span data-label={label}>{label}</span>
                            <span
                                className={`absolute inset-x-0 -bottom-0.5 h-px origin-left bg-[#ff3b30] transition-transform duration-300 ${
                                    active === href ? 'scale-x-100' : 'scale-x-0'
                                }`}
                            />
                        </a>
                    ))}
                </nav>
            </div>
        </header>
    );
}
