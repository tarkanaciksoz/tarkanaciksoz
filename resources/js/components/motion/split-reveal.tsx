import { gsap, prefersReducedMotion, SplitText, useGSAP } from '@/lib/gsap';
import { introDone } from '@/lib/intro';
import { useRef } from 'react';
import { useGlitchBurst } from '../signal/glitch-burst';

type Props = {
    text: string;
    as?: 'h1' | 'h2' | 'h3' | 'p';
    className?: string;
    /** Start on mount after this many seconds, instead of when scrolled into view. */
    delay?: number | null;
    /** Seconds between rare glitch bursts, or null for none. */
    glitch?: [number, number] | null;
};

/**
 * A heading whose lines rise out of their own baseline, each one masked, the
 * first time it is seen. SplitText re-splits on resize and font load, so the
 * lines always match what the reader sees.
 */
export function SplitReveal({ text, as: Tag = 'h2', className, delay = null, glitch = [8, 16] }: Props) {
    const ref = useRef<HTMLHeadingElement>(null);
    useGlitchBurst(ref, glitch);

    useGSAP(
        () => {
            const el = ref.current;
            if (!el || prefersReducedMotion()) return;
            // The lines rise out of their baselines, then the heading takes one hit of static as it lands.
            const land = () => {
                el.classList.remove('burst');
                void el.offsetWidth;
                el.classList.add('burst');
            };
            SplitText.create(el, {
                type: 'lines',
                mask: 'lines',
                autoSplit: true,
                onSplit(self) {
                    const rise = gsap.from(self.lines, {
                        yPercent: 110,
                        duration: 1.05,
                        ease: 'expo.out',
                        stagger: 0.09,
                        delay: delay ?? 0,
                        paused: delay !== null,
                        onComplete: land,
                        scrollTrigger: delay === null ? { trigger: el, start: 'top 88%', once: true } : undefined,
                    });
                    // A heading timed from page load waits for the boot screen to open first.
                    if (delay !== null) introDone.then(() => rise.play());
                    return rise;
                },
            });
        },
        { scope: ref, dependencies: [text], revertOnUpdate: true },
    );

    return (
        <Tag key={text} ref={ref} className={className}>
            {text}
        </Tag>
    );
}
