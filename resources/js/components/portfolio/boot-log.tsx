export type LogLine = { t: number; text: string; tone?: 'ok' | 'hot' | 'dim' | 'plain'; tail?: string };

const stamp = (t: number) => `[${t.toFixed(3).padStart(8, ' ')}]`;

/** dmesg-style record of what the page is doing: mounting layers, sending, reading the trace. */
export function BootLog({ lines, live }: { lines: LogLine[]; live: boolean }) {
    return (
        <div className="scanlines relative overflow-hidden rounded-sm border border-white/12 bg-[#040405] px-4 py-3 font-mono text-[11.5px] leading-[1.75]">
            <div className="mb-1 flex items-baseline justify-between text-[10.5px] tracking-[0.14em] text-zinc-600 uppercase">
                <span>
                    <span className="text-[#ff3b30]">▌</span> boot log
                </span>
                <span>{live ? 'running' : `${lines.length} lines`}</span>
            </div>
            <div className="min-h-[204px]">
                {lines.map((line, i) => (
                    <div key={i} className="line-in flex gap-3 whitespace-pre">
                        <span className="text-zinc-700">{stamp(line.t)}</span>
                        <span
                            className={`min-w-0 truncate ${
                                line.tone === 'hot'
                                    ? 'text-[#ff3b30]'
                                    : line.tone === 'dim'
                                      ? 'text-zinc-600'
                                      : line.tone === 'ok'
                                        ? 'text-zinc-300'
                                        : 'text-zinc-200'
                            }`}
                        >
                            {line.text}
                        </span>
                        {line.tail && (
                            <span className={`ml-auto shrink-0 ${line.tone === 'hot' ? 'text-[#ff3b30]' : 'text-zinc-500'}`}>{line.tail}</span>
                        )}
                    </div>
                ))}
                {live && <span className="blink inline-block h-[1.05em] w-[0.6em] translate-y-[0.2em] bg-zinc-300" />}
            </div>
        </div>
    );
}
