import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { JUMP_EVENT } from '@/lib/smooth-scroll';
import { useEffect, useRef } from 'react';

/** How far down the page the reader is: a red hairline along the top edge. */
export function ScrollProgress() {
    const bar = useRef<HTMLDivElement>(null);

    useGSAP(() => {
        const st = ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => gsap.set(bar.current, { scaleX: self.progress }) });
        return () => st.kill();
    });

    return (
        <div
            ref={bar}
            className="pointer-events-none fixed inset-x-0 top-0 z-[45] h-[2px] bg-[#ff3b30]"
            style={{ transform: 'scaleX(0)', transformOrigin: 'left center' }}
            aria-hidden="true"
        />
    );
}

/**
 * A channel change: when the nav jumps across the page, the screen tears for a
 * third of a second in the page's red and cyan, so the jump reads as a cut.
 */
export function JumpGlitch() {
    const root = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = root.current;
        if (!el) return;
        const bands = Array.from(el.children) as HTMLElement[];

        const play = () => {
            if (prefersReducedMotion()) return;
            bands.forEach((band) => {
                gsap.set(band, { top: `${Math.random() * 92}%`, height: `${2 + Math.random() * 9}%` });
            });
            gsap.timeline()
                .set(el, { autoAlpha: 1 })
                .to(bands, { x: () => gsap.utils.random(-60, 60), duration: 0.06, ease: 'steps(1)', stagger: 0.02, repeat: 3, yoyo: true })
                .to(el, { autoAlpha: 0, duration: 0.12, ease: 'steps(2)' });
        };

        window.addEventListener(JUMP_EVENT, play);
        return () => window.removeEventListener(JUMP_EVENT, play);
    }, []);

    return (
        <div ref={root} className="pointer-events-none invisible fixed inset-0 z-50 opacity-0 mix-blend-screen" aria-hidden="true">
            {['#ff3b30', '#22d3ee', '#ffffff', '#ff3b30', '#22d3ee', '#ffffff', '#ff3b30'].map((color, i) => (
                <div key={i} className="absolute inset-x-0" style={{ background: color, opacity: color === '#ffffff' ? 0.08 : 0.16 }} />
            ))}
        </div>
    );
}
