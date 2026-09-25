import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './use-reduced-motion';

const NOISE = '0123456789ABCDEF!<>-_\\/[]{}=+*^?#%&$@';

type Props = {
    text: string;
    /** Milliseconds for the whole string to lock in. */
    duration?: number;
    delay?: number;
    className?: string;
    as?: 'span' | 'h1' | 'h2' | 'h3' | 'p' | 'div';
};

/**
 * Text arrives as noise and locks in left to right, the way a payload is only
 * readable once the last byte of it has arrived.
 */
export function DecodeText({ text, duration = 900, delay = 0, className, as: Tag = 'span' }: Props) {
    const reduced = useReducedMotion();
    const [out, setOut] = useState(text);
    const [visible, setVisible] = useState(false);
    const frame = useRef(0);
    const host = useRef<HTMLElement | null>(null);

    // Decode when the text scrolls into view, not on mount, so it is actually seen.
    useEffect(() => {
        const el = host.current;
        if (!el) return;
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    setVisible(true);
                    io.disconnect();
                }
            },
            { rootMargin: '0px 0px -10% 0px' },
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    useEffect(() => {
        if (reduced) {
            setOut(text);
            return;
        }
        if (!visible) return;

        let start: number | null = null;
        const tick = (now: number) => {
            if (start === null) start = now + delay;
            const t = Math.max(0, now - start) / duration;
            const locked = Math.floor(Math.min(1, t) * text.length);

            let next = '';
            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                if (i < locked || ch === ' ') next += ch;
                else next += NOISE[(Math.random() * NOISE.length) | 0];
            }
            setOut(next);

            if (t < 1) frame.current = requestAnimationFrame(tick);
            else setOut(text);
        };

        frame.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame.current);
    }, [text, duration, delay, reduced, visible]);

    // The real text reserves the space; the noise is drawn over it, so the line
    // breaks never move while the characters are still wrong.
    return (
        <Tag ref={host as never} className={`relative inline-block ${className ?? ''}`} aria-label={text}>
            <span aria-hidden="true" className="invisible">
                {text}
            </span>
            <span aria-hidden="true" className="absolute inset-0">
                {out}
            </span>
        </Tag>
    );
}
