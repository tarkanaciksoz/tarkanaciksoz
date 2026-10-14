import { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from './gsap';

/**
 * Pulls an element a little toward the pointer while the pointer is over it, and
 * lets it settle back when it leaves: the button answers before it is pressed.
 * Off on touch screens and under reduced motion.
 */
export function useMagnetic<T extends HTMLElement>(strength = 0.3) {
    const ref = useRef<T>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el || prefersReducedMotion() || window.matchMedia('(hover: none)').matches) return;
        const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
        const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });

        const move = (e: PointerEvent) => {
            const r = el.getBoundingClientRect();
            x((e.clientX - (r.left + r.width / 2)) * strength);
            y((e.clientY - (r.top + r.height / 2)) * strength);
        };
        const leave = () => {
            x(0);
            y(0);
        };

        el.addEventListener('pointermove', move);
        el.addEventListener('pointerleave', leave);
        return () => {
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerleave', leave);
            gsap.killTweensOf(el);
            gsap.set(el, { x: 0, y: 0 });
        };
    }, [strength]);

    return ref;
}
