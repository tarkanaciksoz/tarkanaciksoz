import { useEffect, useState } from 'react';
import { useReducedMotion } from './use-reduced-motion';

type Props = {
    command: string;
    output: React.ReactNode;
    /** Delay before typing starts, in ms. */
    delay?: number;
};

/**
 * `~$ whoami`, typed, then its output, then a fresh prompt with a blinking
 * block cursor. The last line is where the interactive terminal will attach.
 */
export function Prompt({ command, output, delay = 250 }: Props) {
    const reduced = useReducedMotion();
    const [typed, setTyped] = useState(reduced ? command.length : 0);
    const done = typed >= command.length;

    useEffect(() => {
        if (reduced) {
            setTyped(command.length);
            return;
        }
        let i = 0;
        let timer = window.setTimeout(function tick() {
            i += 1;
            setTyped(i);
            if (i < command.length) timer = window.setTimeout(tick, 70 + Math.random() * 60);
        }, delay);
        return () => window.clearTimeout(timer);
    }, [command, delay, reduced]);

    return (
        <div className="font-mono text-[12.5px] leading-relaxed" aria-label={`${command}`}>
            <div className="text-zinc-400">
                <span className="text-[#ff3b30]">~$</span> {command.slice(0, typed)}
                {!done && <span className="blink ml-px inline-block h-[1.05em] w-[0.6em] translate-y-[0.18em] bg-zinc-200" />}
            </div>
            <div className={`transition-opacity duration-150 ${done ? 'opacity-100' : 'opacity-0'}`}>{output}</div>
            <div className={`text-zinc-400 ${done ? '' : 'invisible'}`} id="terminal-input">
                <span className="text-[#ff3b30]">~$</span>{' '}
                <span className="blink inline-block h-[1.05em] w-[0.6em] translate-y-[0.18em] bg-zinc-200" aria-hidden="true" />
            </div>
        </div>
    );
}
