import { useEffect, useMemo, useState } from 'react';
import { crc32, HexDump } from './hex-dump';
import { NoiseField } from './noise-field';
import { useReducedMotion } from './use-reduced-motion';

type Props = {
    raw: string;
    cache: string | null;
    serverMs: number | null;
    path: string;
};

/**
 * The hero's right-hand panel: the bytes this page was built from, streaming
 * past sixteen at a time, with the checksum a client would verify them against.
 */
export function SignalPanel({ raw, cache, serverMs, path }: Props) {
    const reduced = useReducedMotion();
    const size = useMemo(() => new TextEncoder().encode(raw).length, [raw]);
    const checksum = useMemo(() => (raw ? crc32(raw) : '--------'), [raw]);
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        if (reduced || !size) return;
        const id = window.setInterval(() => setOffset((o) => (o + 16 >= size - 16 * 9 ? 0 : o + 16)), 420);
        return () => window.clearInterval(id);
    }, [reduced, size]);

    return (
        <div className="scanlines relative overflow-hidden rounded-md border border-white/12 bg-[#050506]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2 font-mono text-[10.5px] tracking-[0.12em] text-zinc-500 uppercase">
                <span className="flicker flex items-center gap-2">
                    <span className="h-1.5 w-1.5 bg-[#ff3b30]" /> live · GET {path}
                </span>
                <span>{size ? `${size.toLocaleString()} B` : 'waiting'}</span>
            </div>
            <div className="px-3 py-3">{raw ? <HexDump source={raw} rows={9} offset={offset} /> : <div className="h-[150px]" />}</div>
            <div className="relative h-7 border-t border-white/10">
                <NoiseField
                    className="absolute inset-0 h-full w-full opacity-60"
                    density={cache === 'miss' ? 0.32 : 0.1}
                    tone={cache === 'miss' ? '255,59,48' : '255,255,255'}
                />
            </div>
            <div className="grid grid-cols-3 gap-px border-t border-white/10 bg-white/10 font-mono text-[10.5px] tracking-[0.1em] uppercase">
                <div className="bg-[#050506] px-3 py-2 text-zinc-500">
                    crc32
                    <div className="mt-0.5 text-[12px] tracking-normal text-zinc-100">{checksum}</div>
                </div>
                <div className="bg-[#050506] px-3 py-2 text-zinc-500">
                    server
                    <div className="mt-0.5 text-[12px] tracking-normal text-zinc-100">{serverMs !== null ? `${serverMs.toFixed(1)} ms` : '—'}</div>
                </div>
                <div className="bg-[#050506] px-3 py-2 text-zinc-500">
                    cache
                    <div className={`mt-0.5 text-[12px] tracking-normal ${cache === 'miss' ? 'text-[#ff3b30]' : 'text-zinc-100'}`}>
                        {cache ?? '—'}
                    </div>
                </div>
            </div>
        </div>
    );
}
