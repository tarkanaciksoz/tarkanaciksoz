import { useEffect, useRef } from 'react';
import { useReducedMotion } from './use-reduced-motion';

type Props = {
    children: React.ReactNode;
    className?: string;
    /** Seconds between bursts, picked at random inside this range. */
    every?: [number, number];
    as?: 'div' | 'span' | 'h1' | 'h2';
};

/**
 * Tears its content for a quarter of a second, at random, a few times a minute.
 * Rare on purpose: a signal that glitches constantly reads as broken, not alive.
 */
export function GlitchBurst({ children, className, every = [6, 14], as: Tag = 'div' }: Props) {
    const ref = useRef<HTMLElement | null>(null);
    const reduced = useReducedMotion();

    useEffect(() => {
        if (reduced) return;
        let timer = 0;

        const schedule = () => {
            const wait = (every[0] + Math.random() * (every[1] - every[0])) * 1000;
            timer = window.setTimeout(() => {
                const el = ref.current;
                if (el && !document.hidden) {
                    el.classList.remove('burst');
                    void el.offsetWidth;
                    el.classList.add('burst');
                }
                schedule();
            }, wait);
        };

        schedule();
        return () => window.clearTimeout(timer);
    }, [every, reduced]);

    return (
        <Tag ref={ref as never} className={className} onAnimationEnd={() => ref.current?.classList.remove('burst')}>
            {children}
        </Tag>
    );
}
