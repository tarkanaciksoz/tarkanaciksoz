import { gsap, prefersReducedMotion, SCRAMBLE_CHARS, useGSAP } from '@/lib/gsap';
import { useRef } from 'react';

type Props = {
    text: string;
    className?: string;
    /** 'view': decode the first time it scrolls in. 'change': decode every time the text changes. */
    on?: 'view' | 'change';
    duration?: number;
};

/** Text that arrives as noise and resolves left to right, like a value decoding off the wire. */
export function Scramble({ text, className, on = 'change', duration = 0.7 }: Props) {
    const ref = useRef<HTMLSpanElement>(null);

    useGSAP(
        () => {
            const el = ref.current;
            if (!el || prefersReducedMotion()) return;
            // Same text in and out: the unrevealed tail is noise of the right length, so nothing reflows.
            gsap.to(el, {
                duration,
                ease: 'none',
                scrambleText: { text, chars: SCRAMBLE_CHARS, revealDelay: duration * 0.25, speed: 0.8 },
                scrollTrigger: on === 'view' ? { trigger: el, start: 'top 92%', once: true } : undefined,
            });
        },
        { scope: ref, dependencies: [text], revertOnUpdate: true },
    );

    // Keyed by text: GSAP owns the node's contents while it decodes, React owns the node.
    return (
        <span key={text} ref={ref} className={className} aria-label={text}>
            {text}
        </span>
    );
}
