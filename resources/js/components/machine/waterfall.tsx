import { ms } from '@/lib/api';
import { Fragment } from 'react';
import type { Row, Timeline } from './timeline';

const COLS = 'grid-cols-[minmax(0,104px)_minmax(0,1fr)_48px] sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)_64px]';

/** The lens between two clocks: the server's slice of the browser's wait, opened to full width (or closed again). */
function Wedge({ from, to, label, lit }: { from: [number, number]; to: [number, number]; label: string; lit: boolean }) {
    const p = (n: number) => (n * 100).toFixed(3);
    return (
        <div className={`grid ${COLS} h-7 grid-rows-[28px] items-center gap-3 sm:gap-4`} aria-hidden="true">
            <span className={`truncate font-mono text-[11px] transition-colors ${lit ? 'text-[#ff3b30]' : 'text-zinc-600'}`}>{label}</span>
            {/* A fixed height: left to its viewBox, the SVG would take its height from its width. */}
            <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="block h-7 w-full overflow-visible">
                <polygon
                    points={`${p(from[0])},0 ${p(from[1])},0 ${p(to[1])},10 ${p(to[0])},10`}
                    className={`transition-colors duration-500 ${lit ? 'fill-[#ff3b30]/12' : 'fill-white/[0.035]'}`}
                />
                {[0, 1].map((k) => (
                    <line
                        key={k}
                        x1={p(from[k])}
                        y1="0"
                        x2={p(to[k])}
                        y2="10"
                        vectorEffect="non-scaling-stroke"
                        strokeDasharray="2 3"
                        className={`transition-colors duration-500 ${lit ? 'stroke-[#ff3b30]/70' : 'stroke-white/20'}`}
                    />
                ))}
            </svg>
            <span />
        </div>
    );
}

function place(row: Row, t: Timeline) {
    const total = row.clock === 'browser' ? t.browserMs : t.serverMs;
    return { left: `${(row.start / total) * 100}%`, width: `${(Math.max(0, row.end - row.start) / total) * 100}%` };
}

/**
 * One request as a waterfall. Every step is a row on its own clock; the
 * server's rows sit between two lenses that zoom its slice of the browser's
 * wait to full width and back. Fills and the draw-in are driven from outside
 * (GSAP), so React never re-renders on scroll.
 */
export function Waterfall({ timeline, active, onPick }: { timeline: Timeline; active: number; onPick: (index: number) => void }) {
    const { rows, browserMs, window: win } = timeline;
    const firstServer = rows.findIndex((r) => r.clock === 'server');
    const back = rows.findIndex((r) => r.step.key === 'back');
    const lens: [number, number] = [win[0] / browserMs, win[1] / browserMs];
    const zoom = browserMs / Math.max(win[1] - win[0], 0.001);
    const onServer = rows[active]?.clock === 'server';

    return (
        <div className="font-mono text-[11.5px] sm:text-[12px]">
            {rows.map((row, i) => {
                const state = i === active ? 'now' : i < active ? 'past' : 'next';
                return (
                    <Fragment key={row.step.key}>
                        {i === firstServer && firstServer > 0 && (
                            <Wedge from={lens} to={[0, 1]} label={`server, ${zoom.toFixed(1)}x`} lit={onServer} />
                        )}
                        {i === back && firstServer >= 0 && <Wedge from={[0, 1]} to={lens} label="browser again" lit={false} />}
                        <button
                            type="button"
                            data-row={i}
                            onClick={() => onPick(i)}
                            aria-current={state === 'now' ? 'step' : undefined}
                            aria-label={`${row.step.title}, ${ms(row.step.ms)} milliseconds`}
                            className={`wf-row group grid ${COLS} h-[22px] w-full items-center gap-3 text-left sm:gap-4`}
                        >
                            <span
                                className={`truncate transition-colors ${
                                    state === 'now' ? 'text-zinc-50' : state === 'past' ? 'text-zinc-400' : 'text-zinc-600'
                                } group-hover:text-zinc-200`}
                                style={{ paddingLeft: `${Math.min(row.step.depth, 4) * 10}px` }}
                            >
                                {row.step.title}
                            </span>
                            <span className="relative h-full">
                                <span className="absolute inset-x-0 top-1/2 h-px bg-white/[0.06]" />
                                <span
                                    className={`wf-bar absolute top-1/2 -mt-[4px] h-[8px] min-w-[2px] ${
                                        state === 'now' ? 'bg-white/30 shadow-[-1px_0_0_#ff3b30,1px_0_0_#22d3ee]' : 'bg-white/12'
                                    }`}
                                    style={{ ...place(row, timeline), transformOrigin: 'left center' }}
                                >
                                    <span
                                        className={`wf-fill absolute inset-0 ${row.step.slow ? 'bg-[#ff3b30]' : 'bg-zinc-100'}`}
                                        style={{ transform: 'scaleX(0)', transformOrigin: 'left center' }}
                                    />
                                </span>
                            </span>
                            <span
                                className={`text-right tabular-nums transition-colors ${
                                    row.step.slow ? 'text-[#ff3b30]' : state === 'now' ? 'text-zinc-50' : 'text-zinc-500'
                                }`}
                            >
                                {ms(row.step.ms)}
                            </span>
                        </button>
                    </Fragment>
                );
            })}
        </div>
    );
}
