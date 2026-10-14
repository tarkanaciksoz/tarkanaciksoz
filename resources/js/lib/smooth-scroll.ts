import { gsap, prefersReducedMotion } from './gsap';

const HEADER_OFFSET = 64;

/** Scrolls to an element; the duration grows with the distance, within limits. A wheel or touch takes over at once. */
export function smoothScrollTo(target: Element, offset = HEADER_OFFSET): void {
    const distance = Math.abs(target.getBoundingClientRect().top - offset);
    gsap.to(window, {
        duration: prefersReducedMotion() ? 0 : Math.min(1.2, Math.max(0.45, distance / 2600)),
        ease: 'power3.inOut',
        overwrite: 'auto',
        scrollTo: { y: target, offsetY: offset, autoKill: true },
    });
}

/** Delegated handler: every in-page link (#id) scrolls smoothly instead of jumping. */
export function enableSmoothAnchors(): () => void {
    const onClick = (e: MouseEvent) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const link = (e.target as Element | null)?.closest('a[href^="#"]') as HTMLAnchorElement | null;
        if (!link) return;
        const id = link.getAttribute('href')!.slice(1);
        const target = id ? document.getElementById(id) : document.body;
        if (!target) return;
        e.preventDefault();
        smoothScrollTo(target, id === 'top' ? 0 : HEADER_OFFSET);
        // Keep Inertia's page state in history; only the hash changes.
        window.history.replaceState(window.history.state, '', `#${id}`);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
}
