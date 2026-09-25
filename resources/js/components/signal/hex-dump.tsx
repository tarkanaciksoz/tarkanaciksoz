import { useMemo } from 'react';

type Props = {
    /** The real bytes to show, usually the JSON body the page just received. */
    source: string;
    rows?: number;
    offset?: number;
    className?: string;
    /** Byte range to mark as corrupted (for the slow step, a cache miss…). */
    hot?: [number, number] | null;
};

const hex = (n: number, width = 2) => n.toString(16).toUpperCase().padStart(width, '0');

/** xxd-style view of the actual response body: offset, sixteen bytes, their ASCII. */
export function HexDump({ source, rows = 8, offset = 0, className, hot = null }: Props) {
    const bytes = useMemo(() => new TextEncoder().encode(source), [source]);

    const lines = useMemo(() => {
        const out: { addr: string; cells: { v: string; hot: boolean }[]; ascii: string }[] = [];
        for (let r = 0; r < rows; r++) {
            const base = offset + r * 16;
            if (base >= bytes.length) break;
            const cells: { v: string; hot: boolean }[] = [];
            let ascii = '';
            for (let c = 0; c < 16; c++) {
                const i = base + c;
                if (i >= bytes.length) {
                    cells.push({ v: '  ', hot: false });
                    ascii += ' ';
                    continue;
                }
                const b = bytes[i];
                cells.push({ v: hex(b), hot: !!hot && i >= hot[0] && i < hot[1] });
                ascii += b >= 32 && b < 127 ? String.fromCharCode(b) : '.';
            }
            out.push({ addr: hex(base, 8), cells, ascii });
        }
        return out;
    }, [bytes, rows, offset, hot]);

    return (
        <pre
            className={`overflow-x-auto font-mono text-[10.5px] leading-[1.55] text-zinc-500 ${className ?? ''}`}
            aria-label="Hex dump of the response body"
        >
            {lines.map((line) => (
                <div key={line.addr} className="flex gap-3 whitespace-pre">
                    <span className="text-zinc-700">{line.addr}</span>
                    <span>
                        {line.cells.map((cell, i) => (
                            <span key={i} className={cell.hot ? 'bg-[#ff3b30] text-black' : i % 2 ? 'text-zinc-400' : 'text-zinc-500'}>
                                {cell.v}
                                {i === 7 ? '  ' : ' '}
                            </span>
                        ))}
                    </span>
                    <span className="text-zinc-300">{line.ascii}</span>
                </div>
            ))}
        </pre>
    );
}

/** CRC-32 of the body, the same number a client could compute to know nothing was lost. */
export function crc32(input: string): string {
    const bytes = new TextEncoder().encode(input);
    let crc = 0xffffffff;
    for (const b of bytes) {
        crc ^= b;
        for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    return ((crc ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8, '0');
}
