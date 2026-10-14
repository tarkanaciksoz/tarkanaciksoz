import { prefersReducedMotion, ScrollSmoother } from '@/lib/gsap';
import { useLayoutEffect, useState, type ReactNode } from 'react';

/**
 * Inertial scrolling for the whole page, and parallax for anything marked with
 * data-speed. The smoother has to exist before any ScrollTrigger inside it, so
 * the content mounts only once it does. Fixed elements (nav, background, boot
 * screen) must live outside this shell: the content is moved with transforms.
 */
export function SmoothShell({ children }: { children: ReactNode }) {
    const [ready, setReady] = useState(false);

    useLayoutEffect(() => {
        const smoother = prefersReducedMotion()
            ? null
            : ScrollSmoother.create({ wrapper: '#smooth-wrapper', content: '#smooth-content', smooth: 1.15, effects: true, smoothTouch: false });
        setReady(true);
        return () => smoother?.kill();
    }, []);

    return (
        <div id="smooth-wrapper">
            <div id="smooth-content">{ready ? children : null}</div>
        </div>
    );
}
