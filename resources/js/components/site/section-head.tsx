import type { ReactNode } from 'react';
import { SplitReveal } from '../motion/split-reveal';

/** One message per section: the headline, and under it, at reading width, what the section is made of. */
export function SectionHead({ title, children }: { title: string; children?: ReactNode }) {
    return (
        <header className="max-w-4xl">
            <SplitReveal text={title} className="text-4xl leading-[0.98] font-semibold tracking-[-0.04em] text-zinc-50 sm:text-6xl" />
            {children && <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-zinc-400">{children}</p>}
        </header>
    );
}
