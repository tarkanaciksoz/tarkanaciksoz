import { useEffect, useState } from 'react';

/**
 * Wide and tall enough to pin a section and let scrolling drive it, and the reader
 * has not asked for less motion. Below this, sections fall back to plain lists.
 */
export const STAGE_QUERY = '(min-width: 1024px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)';

export function useStage(): boolean {
    const [ok, setOk] = useState(() => typeof window !== 'undefined' && window.matchMedia(STAGE_QUERY).matches);
    useEffect(() => {
        const mq = window.matchMedia(STAGE_QUERY);
        const on = () => setOk(mq.matches);
        on();
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);
    return ok;
}
