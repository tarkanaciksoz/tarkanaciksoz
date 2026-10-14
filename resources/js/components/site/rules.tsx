import { gsap, prefersReducedMotion, SCRAMBLE_CHARS, ScrollTrigger, useGSAP } from '@/lib/gsap';
import type { Decision } from '@/types/portfolio';
import { useRef, useState } from 'react';
import { SplitReveal } from '../motion/split-reveal';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * How I run servers, as an index: one rule open at a time, its number large on
 * the left. Opening a rule folds the last one away; nothing else moves.
 */
export function Rules({ decisions }: { decisions: Decision[] }) {
    const root = useRef<HTMLElement>(null);
    const counter = useRef<HTMLSpanElement>(null);
    const [open, setOpen] = useState(0);

    const { contextSafe } = useGSAP(
        () => {
            const rows = gsap.utils.toArray<HTMLElement>('.rule-row', root.current);
            if (!rows.length) return;
            gsap.set('.rule-body', { height: 0 });
            gsap.set(rows[open]?.querySelector('.rule-body') ?? [], { height: 'auto' });
            if (prefersReducedMotion()) return;
            ScrollTrigger.batch(rows, {
                start: 'top 90%',
                once: true,
                onEnter: (batch) => gsap.from(batch, { y: 24, autoAlpha: 0, duration: 0.7, ease: 'power3.out', stagger: 0.05 }),
            });
        },
        // Re-run only when the list itself changes; opening is handled below.
        { scope: root, dependencies: [decisions.length] },
    );

    const choose = contextSafe((index: number) => {
        if (index === open) return;
        const rows = gsap.utils.toArray<HTMLElement>('.rule-row', root.current);
        const instant = prefersReducedMotion();
        const from = rows[open]?.querySelector('.rule-body');
        const to = rows[index]?.querySelector('.rule-body');
        gsap.to(from ?? [], { height: 0, duration: instant ? 0 : 0.45, ease: 'power3.inOut', overwrite: true });
        gsap.to(to ?? [], {
            height: 'auto',
            duration: instant ? 0 : 0.55,
            ease: 'power3.inOut',
            overwrite: true,
            onComplete: () => ScrollTrigger.refresh(),
        });
        // The counter's text belongs to GSAP, not React, so the two never fight over the node.
        if (counter.current) {
            if (instant) counter.current.textContent = pad(index + 1);
            else
                gsap.to(counter.current, { duration: 0.5, scrambleText: { text: pad(index + 1), chars: SCRAMBLE_CHARS, speed: 1 }, overwrite: true });
        }
        setOpen(index);
    });

    const current = decisions[open];

    return (
        <section ref={root} id="rules" className="relative z-10 pt-24 sm:pt-32">
            <SplitReveal text="How I run servers" className="text-4xl leading-[0.98] font-semibold tracking-[-0.04em] text-zinc-50 sm:text-6xl" />
            <p className="mt-4 max-w-[64ch] text-zinc-400">
                {decisions.length} rules, each one learned the expensive way. Read from{' '}
                <span className="font-mono text-[13px] text-zinc-200">GET /api/decisions</span>.
            </p>

            <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
                <div className="hidden lg:block">
                    <div className="sticky top-24">
                        <span ref={counter} className="font-pixel block text-[200px] leading-[0.8] text-[#ff3b30] xl:text-[260px]">
                            01
                        </span>
                        <div className="mt-6 flex items-center gap-3 font-mono text-[12px] text-zinc-500">
                            <span className="h-px w-10 bg-white/25" />
                            <span>
                                rule {open + 1} of {decisions.length}
                            </span>
                        </div>
                        {current && <p className="mt-3 max-w-[30ch] text-lg leading-snug text-zinc-200">{current.title}</p>}
                    </div>
                </div>

                <ol className="border-t border-white/12">
                    {decisions.map((d, i) => {
                        const isOpen = i === open;
                        return (
                            <li key={d.id} className="rule-row border-b border-white/12">
                                <button
                                    type="button"
                                    onClick={() => choose(i)}
                                    aria-expanded={isOpen}
                                    aria-controls={`rule-${d.id}`}
                                    className="group flex w-full items-baseline gap-5 py-5 text-left"
                                >
                                    <span className={`w-7 shrink-0 font-mono text-[12px] ${isOpen ? 'text-[#ff3b30]' : 'text-zinc-600'}`}>
                                        {pad(i + 1)}
                                    </span>
                                    <span
                                        className={`min-w-0 flex-1 text-xl leading-tight font-medium tracking-[-0.02em] transition-colors sm:text-2xl ${
                                            isOpen ? 'text-zinc-50' : 'text-zinc-400 group-hover:text-zinc-100'
                                        }`}
                                    >
                                        {d.title}
                                    </span>
                                    <span
                                        aria-hidden="true"
                                        className={`shrink-0 font-mono text-[14px] transition-transform duration-300 ${isOpen ? 'rotate-45 text-[#ff3b30]' : 'text-zinc-600'}`}
                                    >
                                        +
                                    </span>
                                </button>
                                <div id={`rule-${d.id}`} className="rule-body overflow-hidden" style={{ height: i === 0 ? 'auto' : 0 }}>
                                    <p className="max-w-[60ch] pb-6 pl-12 text-[15.5px] leading-relaxed text-zinc-400">{d.body}</p>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </section>
    );
}
