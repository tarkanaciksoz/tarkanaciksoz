import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

// Registered once, here, so every component imports GSAP from one place.
gsap.registerPlugin(useGSAP, ScrollTrigger, ScrollToPlugin, SplitText, ScrambleTextPlugin);

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Characters a scramble cycles through: the same alphabet as the bytes in the background. */
export const SCRAMBLE_CHARS = '0123456789ABCDEF';

export { gsap, ScrambleTextPlugin, ScrollToPlugin, ScrollTrigger, SplitText, useGSAP };
