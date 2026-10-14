import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
    /** The real bytes to show, usually the JSON body the page just received. */
    source: string;
    /** Fixed number of rows; leave out to fill the height of the box. */
    rows?: number;
    offset?: number;
    className?: string;
    /** Byte range to mark as corrupted (for the slow step, a cache miss…). */
    hot?: [number, number] | null;
};

const hex = (n: number, width = 2) => n.toString(16).toUpperCase().padStart(width, '0');

/** Characters in one row of `perRow` bytes: address, gap, "XX " per byte plus a gap per 8, gap, ASCII. */
const rowChars = (perRow: number) => 8 + 3 + perRow * 3 + perRow / 8 + 3 + perRow;

/**
 * xxd-style view of the actual response body: offset, bytes, their ASCII. It
 * fits its box: as many bytes per row as the width allows (in groups of eight),
 * and as many rows as the height allows.
 */
export function HexDump({ source, rows, offset = 0, className, hot = null }: Props) {
    const bytes = useMemo(() => new TextEncoder().encode(source), [source]);
    const box = useRef<HTMLPreElement>(null);
    const probe = useRef<HTMLSpanElement>(null);
    const [fit, setFit] = useState({ perRow: 16, rows: rows ?? 8, size: 12 });

    useEffect(() => {
        const el = box.current;
        const ch = probe.current;
        if (!el || !ch) return;
        const measure = () => {
            // Character width as a share of the font size, so any size can be planned for.
            const em = ch.getBoundingClientRect().width / (parseFloat(getComputedStyle(el).fontSize) || 12) || 0.6;
            const width = el.clientWidth;
            let perRow = 8;
            while (perRow < 64 && rowChars(perRow + 8) * em * 12 <= width) perRow += 8;
            // Then grow (or shrink) the type so that row runs edge to edge.
            const size = Math.min(15, Math.max(9, Math.floor((width / (rowChars(perRow) * em)) * 10) / 10));
            // Rows: as many whole lines as the parent's content box holds. When that box has no
            // height of its own it wraps the current rows exactly, so the count holds steady.
            const parent = el.parentElement ?? el;
            const pad = getComputedStyle(parent);
            const height = parent.clientHeight - parseFloat(pad.paddingTop) - parseFloat(pad.paddingBottom);
            setFit({ perRow, size, rows: rows ?? Math.max(4, Math.floor(height / (size * 1.7) + 0.02)) });
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        if (el.parentElement) ro.observe(el.parentElement);
        return () => ro.disconnect();
    }, [rows]);

    const lines = useMemo(() => {
        const out: { addr: string; cells: { v: string; hot: boolean }[]; ascii: string }[] = [];
        for (let r = 0; r < fit.rows; r++) {
            const base = offset + r * fit.perRow;
            if (base >= bytes.length) break;
            const cells: { v: string; hot: boolean }[] = [];
            let ascii = '';
            for (let c = 0; c < fit.perRow; c++) {
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
    }, [bytes, fit, offset, hot]);

    return (
        <pre
            ref={box}
            style={{ fontSize: fit.size }}
            className={`relative overflow-hidden font-mono leading-[1.7] text-zinc-400 ${className ?? ''}`}
            aria-label="Hex dump of the response body"
        >
            {/* One character, measured, so the row length matches the font actually rendered. */}
            <span ref={probe} aria-hidden="true" className="invisible absolute">
                0
            </span>
            {lines.map((line) => (
                <div key={line.addr} className="whitespace-pre">
                    <span className="text-zinc-400">{line.addr}</span>
                    {'   '}
                    {line.cells.map((cell, i) => (
                        <span key={i} className={cell.hot ? 'bg-[#ff3b30] text-black' : i % 2 ? 'text-zinc-300' : 'text-zinc-400'}>
                            {cell.v}
                            {(i + 1) % 8 === 0 ? '  ' : ' '}
                        </span>
                    ))}
                    {'  '}
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
