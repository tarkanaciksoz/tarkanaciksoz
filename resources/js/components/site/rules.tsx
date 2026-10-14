import { gsap, prefersReducedMotion, SCRAMBLE_CHARS, ScrollTrigger, useGSAP } from '@/lib/gsap';
import type { Decision } from '@/types/portfolio';
import { Plus } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { contentRight, useTextFormation } from '../bits/text';
import { SectionHead } from './section-head';
import { SectionState, type Loadable } from './section-state';

/**
 * How I run servers, as an index set in large type: the rule is the headline,
 * the reason opens under it. One open at a time; the open rule carries the
 * red split, the same mark the page uses for whatever is under attention.
 */
export function Rules({ state }: { state: Loadable<Decision[]> }) {
    const root = useRef<HTMLElement>(null);
    const decisions = state.data ?? [];
    const [open, setOpen] = useState(0);

    // While the rules are on screen, the page's bits spell the open rule's number: in the
    // right-hand third on wide screens, stopping short of the open/close marks; on narrow ones,
    // in a strip at the top of the open rule's text, so they follow it down the list.
    useTextFormation('rules', root, open >= 0 ? String(open + 1).padStart(2, '0') : null, (vw, vh) => {
        if (vw >= 1024) {
            const w = Math.min(vw * 0.24, 420);
            return { x: contentRight(vw) - 64 - w, y: vh * 0.3, w, h: vh * 0.36 };
        }
        const r = root.current?.querySelectorAll<HTMLElement>('.rule-row')[open]?.querySelector('[data-rule-number]')?.getBoundingClientRect();
        if (!r || r.height < 8 || r.bottom < 0 || r.top > vh) return null;
        return { x: r.left, y: r.top, w: r.width, h: r.height };
    });

    const { contextSafe } = useGSAP(
        () => {
            const rows = gsap.utils.toArray<HTMLElement>('.rule-row', root.current);
            if (!rows.length || prefersReducedMotion()) return;
            ScrollTrigger.batch(rows, {
                start: 'top 92%',
                once: true,
                onEnter: (batch) => gsap.from(batch, { yPercent: 60, autoAlpha: 0, duration: 0.8, ease: 'power3.out', stagger: 0.05 }),
            });
        },
        { scope: root, dependencies: [decisions.length] },
    );

    const decode = contextSafe((e: React.PointerEvent<HTMLButtonElement>) => {
        const n = e.currentTarget.querySelector('[data-n]');
        if (!n || prefersReducedMotion()) return;
        gsap.to(n, { duration: 0.4, scrambleText: { text: n.getAttribute('data-n')!, chars: SCRAMBLE_CHARS, speed: 1 }, overwrite: true });
    });

    const choose = contextSafe((index: number) => {
        const next = index === open ? -1 : index;
        const rows = gsap.utils.toArray<HTMLElement>('.rule-row', root.current);
        const pace = prefersReducedMotion() ? 0 : 1;
        const closing = rows[open]?.querySelector('.rule-body');
        const opening = next >= 0 ? rows[next]?.querySelector('.rule-body') : null;
        if (closing) gsap.to(closing, { height: 0, duration: 0.4 * pace, ease: 'power3.inOut', overwrite: true });
        if (opening) {
            gsap.to(opening, {
                height: 'auto',
                duration: 0.55 * pace,
                ease: 'power3.inOut',
                overwrite: true,
                onComplete: () => ScrollTrigger.refresh(),
            });
            gsap.fromTo(opening.firstElementChild, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5 * pace, delay: 0.12 * pace });
        }
        setOpen(next);
    });

    return (
        <section ref={root} id="rules" className="relative pt-10">
            <SectionHead title="How I run servers">
                {decisions.length ? `${decisions.length} rules` : 'Rules'}, each one learned the expensive way, from{' '}
                <span className="font-mono text-[13px] text-zinc-200">GET /api/decisions</span>.
            </SectionHead>

            <SectionState
                state={state}
                endpoint="/api/decisions"
                skeleton={
                    <div className="mt-12 space-y-5">
                        {[72, 58, 80, 64].map((w) => (
                            <div key={w} className="h-10 animate-pulse bg-white/[0.04]" style={{ width: `${w}%` }} />
                        ))}
                    </div>
                }
            >
                <ol className="mt-12">
                    {decisions.map((d, i) => {
                        const isOpen = i === open;
                        return (
                            <li key={d.id} className="rule-row">
                                <button
                                    type="button"
                                    onClick={() => choose(i)}
                                    onPointerEnter={decode}
                                    aria-expanded={isOpen}
                                    aria-controls={`rule-${d.id}`}
                                    className="group grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-3 py-2.5 text-left sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:gap-4"
                                >
                                    <span
                                        data-n={String(i + 1).padStart(2, '0')}
                                        className={`font-pixel text-lg transition-colors sm:text-2xl ${isOpen ? 'text-[#ff3b30]' : 'text-zinc-400 group-hover:text-zinc-300'}`}
                                    >
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <span
                                        data-text={d.title}
                                        className={`text-[26px] leading-[1.08] font-semibold tracking-[-0.035em] transition-[color,translate] duration-300 sm:text-4xl lg:text-5xl ${
                                            isOpen ? 'split text-zinc-50' : 'text-zinc-500 group-hover:translate-x-2 group-hover:text-zinc-200'
                                        }`}
                                    >
                                        {d.title}
                                    </span>
                                    <Plus
                                        aria-hidden="true"
                                        size={20}
                                        weight="light"
                                        className={`self-center transition-transform duration-300 ${isOpen ? 'rotate-45 text-[#ff3b30]' : 'text-zinc-400 group-hover:text-zinc-300'}`}
                                    />
                                </button>
                                <div
                                    id={`rule-${d.id}`}
                                    className="rule-body overflow-hidden"
                                    style={{ height: i === 0 ? 'auto' : 0 }}
                                    // A folded rule is out of the reading order too, not only out of sight.
                                    inert={!isOpen}
                                    aria-hidden={!isOpen}
                                >
                                    <div className="pt-1 pb-8 pl-[3.25rem] sm:pl-[5.5rem]">
                                        {/* Narrow screens: the bits draw this rule's number here. */}
                                        <div
                                            data-rule-number
                                            aria-hidden="true"
                                            className="mb-3 h-[26vw] max-h-[150px] w-[min(66vw,300px)] motion-reduce:hidden lg:hidden"
                                        />
                                        <p className="max-w-[58ch] text-lg leading-relaxed text-zinc-400">{d.body}</p>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </SectionState>
        </section>
    );
}
