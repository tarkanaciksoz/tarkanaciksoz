import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

// Registered once, here, so every component imports GSAP from one place.
gsap.registerPlugin(useGSAP, ScrollTrigger, ScrollSmoother, ScrollToPlugin, SplitText, ScrambleTextPlugin);

// A phone's address bar shows and hides as you scroll; that is not a layout change worth
// re-measuring every trigger for, and doing so mid-scroll makes the page jump.
ScrollTrigger.config({ ignoreMobileResize: true });

/** Touch-only devices scroll natively: transform-driven scrolling trembles under momentum scrolling. */
export const touchOnly = () => typeof window !== 'undefined' && ScrollTrigger.isTouch === 1;

/**
 * anticipatePin for a pin: it helps native scrolling, where the pin lands a frame late,
 * and only makes the pin twitch on entry when ScrollSmoother is moving the page.
 */
export const anticipatePin = () => (ScrollSmoother.get() ? 0 : 1);

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Characters a scramble cycles through: the same alphabet as the bytes in the background. */
export const SCRAMBLE_CHARS = '0123456789ABCDEF';

/**
 * Where the content is drawn right now. Under ScrollSmoother the content trails the
 * native scroll position, and anything painted to match it (the background) has to
 * follow the content, not the scrollbar.
 */
export const contentScrollY = () => ScrollSmoother.get()?.scrollTop() ?? window.scrollY;

/**
 * Re-measures every trigger in page order. Pins arrive late (after their data),
 * and a trigger further down that was measured before a pin above it existed
 * would otherwise keep a start that ignores the pin's scroll distance.
 */
export function remeasure() {
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
}

/** Scrolls the page to a position, smoothly when the smoother is running. */
export function scrollToY(y: number, duration = 0.6) {
    const smoother = ScrollSmoother.get();
    if (smoother && !prefersReducedMotion()) {
        smoother.scrollTo(y, true);
        return;
    }
    gsap.to(window, { scrollTo: y, duration: prefersReducedMotion() ? 0 : duration, ease: 'power2.inOut' });
}

export { gsap, ScrambleTextPlugin, ScrollSmoother, ScrollToPlugin, ScrollTrigger, SplitText, useGSAP };
