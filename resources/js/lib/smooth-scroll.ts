const HEADER_OFFSET = 64;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Scrolls to an element with an ease-in-out curve; the duration grows with the distance, within limits. */
export function smoothScrollTo(target: Element, offset = HEADER_OFFSET): void {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = window.scrollY;
    const end = Math.max(0, target.getBoundingClientRect().top + start - offset);
    const distance = end - start;

    if (reduced || Math.abs(distance) < 4) {
        window.scrollTo(0, end);
        return;
    }

    const duration = Math.min(1100, Math.max(450, Math.abs(distance) * 0.35));
    const began = performance.now();
    let cancelled = false;

    // A wheel or touch from the reader takes over immediately.
    const stop = () => {
        cancelled = true;
    };
    window.addEventListener('wheel', stop, { passive: true, once: true });
    window.addEventListener('touchstart', stop, { passive: true, once: true });

    const step = (now: number) => {
        if (cancelled) return;
        const t = Math.min(1, (now - began) / duration);
        window.scrollTo(0, start + distance * ease(t));
        if (t < 1) requestAnimationFrame(step);
        else {
            window.removeEventListener('wheel', stop);
            window.removeEventListener('touchstart', stop);
        }
    };
    requestAnimationFrame(step);
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
