import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsap';
import { useRef } from 'react';

/** Section divider: a hairline that draws itself across as the next section arrives, with a corrupted segment running along it. */
export function TearDivider() {
    const line = useRef<HTMLDivElement>(null);

    useGSAP(() => {
        if (prefersReducedMotion()) return;
        gsap.fromTo(
            line.current,
            { scaleX: 0 },
            { scaleX: 1, ease: 'none', scrollTrigger: { trigger: line.current, start: 'top 95%', end: 'top 55%', scrub: 0.6 } },
        );
    });

    return <div ref={line} className="tear-line mt-16 origin-left sm:mt-32" aria-hidden="true" />;
}
