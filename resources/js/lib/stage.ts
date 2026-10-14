import { useEffect, useState } from 'react';

/**
 * Wide and tall enough for the desktop compositions (the constellation, the
 * pinned photo-free systems stage), and the reader has not asked for less motion.
 */
export const STAGE_QUERY = '(min-width: 1024px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)';

/** Motion allowed at any size: phones get their own scroll-driven layouts. */
export const MOTION_QUERY = '(prefers-reduced-motion: no-preference)';

function useMedia(query: string): boolean {
    const [ok, setOk] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
    useEffect(() => {
        const mq = window.matchMedia(query);
        const on = () => setOk(mq.matches);
        on();
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, [query]);
    return ok;
}

export const useStage = () => useMedia(STAGE_QUERY);
export const useMotion = () => useMedia(MOTION_QUERY);
