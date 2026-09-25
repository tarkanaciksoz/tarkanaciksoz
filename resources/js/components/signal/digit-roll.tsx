import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './use-reduced-motion';

type Props = {
    value: number;
    format?: (n: number) => string;
    /** How long the digits keep rolling before they settle. */
    duration?: number;
    className?: string;
};

/**
 * A measured number settles instead of appearing: the digits roll through
 * wrong answers for a moment, then land on the one the tracer recorded.
 */
export function DigitRoll({ value, format = (n) => n.toFixed(1), duration = 520, className }: Props) {
    const reduced = useReducedMotion();
    const [text, setText] = useState(() => format(value));
    const frame = useRef(0);

    useEffect(() => {
        const target = format(value);
        if (reduced) {
            setText(target);
            return;
        }

        const start = performance.now();
        const tick = (now: number) => {
            const t = (now - start) / duration;
            if (t >= 1) {
                setText(target);
                return;
            }

            const settled = Math.floor(t * target.length);
            let next = '';
            for (let i = 0; i < target.length; i++) {
                const ch = target[i];
                next += i < settled || !/\d/.test(ch) ? ch : String((Math.random() * 10) | 0);
            }
            setText(next);
            frame.current = requestAnimationFrame(tick);
        };

        frame.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame.current);
    }, [value, format, duration, reduced]);

    return <span className={`tabular-nums ${className ?? ''}`}>{text}</span>;
}
