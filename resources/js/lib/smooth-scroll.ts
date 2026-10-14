import { gsap, prefersReducedMotion, ScrollSmoother } from './gsap';

const HEADER_OFFSET = 64;

/** Fired when the nav jumps across the page; the glitch overlay listens for it. */
export const JUMP_EVENT = 'glassbox:jump';

/**
 * Scrolls to an element; under ScrollSmoother it glides, otherwise GSAP eases the native scroll.
 * Focus follows, so keyboard and screen-reader users land where the eye does.
 */
export function smoothScrollTo(target: HTMLElement, offset = HEADER_OFFSET): void {
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus({ preventScroll: true });
    const smoother = ScrollSmoother.get();
    if (smoother && !prefersReducedMotion()) {
        smoother.scrollTo(target, true, `top ${offset}px`);
        return;
    }
    const distance = Math.abs(target.getBoundingClientRect().top - offset);
    gsap.to(window, {
        duration: prefersReducedMotion() ? 0 : Math.min(1.2, Math.max(0.45, distance / 2600)),
        ease: 'power3.inOut',
        overwrite: 'auto',
        scrollTo: { y: target, offsetY: offset, autoKill: true },
    });
}

/** Delegated handler: every in-page link (#id) scrolls smoothly instead of jumping, and the jump reads as a cut. */
export function enableSmoothAnchors(): () => void {
    const onClick = (e: MouseEvent) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const link = (e.target as Element | null)?.closest('a[href^="#"]') as HTMLAnchorElement | null;
        if (!link) return;
        const id = link.getAttribute('href')!.slice(1);
        const target = id ? document.getElementById(id) : document.body;
        if (!target) return;
        e.preventDefault();
        window.dispatchEvent(new Event(JUMP_EVENT));
        // Going down the nav hides itself, so the section can sit at the very top; going up, leave room for it.
        const down = target.getBoundingClientRect().top > 0;
        smoothScrollTo(target, id === 'top' || down ? 0 : HEADER_OFFSET);
        // Keep Inertia's page state in history; only the hash changes.
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${id}`);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
}
