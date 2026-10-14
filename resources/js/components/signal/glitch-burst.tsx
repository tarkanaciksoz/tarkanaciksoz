import { useEffect, type RefObject } from 'react';
import { useReducedMotion } from './use-reduced-motion';

/**
 * Tears an element for a quarter of a second, at random, a few times a minute.
 * Rare on purpose: a signal that glitches constantly reads as broken, not alive.
 */
export function useGlitchBurst(ref: RefObject<HTMLElement | null>, every: [number, number] | null = [6, 14]) {
    const reduced = useReducedMotion();
    const [min, max] = every ?? [0, 0];

    useEffect(() => {
        if (reduced || !every) return;
        let timer = 0;
        const el = ref.current;
        const clear = () => el?.classList.remove('burst');
        el?.addEventListener('animationend', clear);

        const schedule = () => {
            const wait = (min + Math.random() * (max - min)) * 1000;
            timer = window.setTimeout(() => {
                if (el && !document.hidden) {
                    el.classList.remove('burst');
                    void el.offsetWidth;
                    el.classList.add('burst');
                }
                schedule();
            }, wait);
        };

        schedule();
        return () => {
            window.clearTimeout(timer);
            el?.removeEventListener('animationend', clear);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [min, max, reduced, !every]);
}
