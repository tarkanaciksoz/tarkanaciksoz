import { isSelected, maxServices, weight, type ViewProps } from './shared';

const LANE = 74;
const HIGH = 30;
const LEFT = 140;
const SWEEP_SECONDS = 7;

/**
 * The stack on a logic analyser: a channel per layer, a pulse per tool, pulse width
 * by how many services use it. A trigger cursor sweeps the capture and each pulse
 * fires as it passes.
 */
export function LogicAnalyzerView({ layers, selected, onSelect }: ViewProps) {
    const max = maxServices(layers);
    const textW = (s: string) => s.length * 6.4 + 16;

    const lanes = layers.map((layer) => {
        let x = LEFT + 14;
        const pulses = layer.items.map((item) => {
            const w = Math.round(textW(item.name) + weight(item, max) * 56);
            const pulse = { item, x, w };
            x += w + 10;
            return pulse;
        });
        return { layer, pulses, end: x };
    });

    const width = Math.max(900, ...lanes.map((l) => l.end + 24));
    const height = lanes.length * LANE + 40;

    return (
        <div className="scanlines relative overflow-x-auto rounded-sm border border-white/12 bg-[#040405]">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="block h-auto min-w-[880px]"
                style={{ width: '100%' }}
                role="img"
                aria-label="Stack as a logic analyser capture"
            >
                <defs>
                    <pattern id="laGrid" width="40" height={LANE} patternUnits="userSpaceOnUse">
                        <path d={`M 40 0 L 0 0 0 ${LANE}`} fill="none" stroke="rgba(255,255,255,.04)" />
                    </pattern>
                    <pattern id="laDither" width="3" height="3" patternUnits="userSpaceOnUse">
                        <rect width="1" height="1" fill="rgba(255,255,255,.35)" />
                    </pattern>
                </defs>

                <rect x={LEFT} y="0" width={width - LEFT} height={height - 40} fill="url(#laGrid)" />

                {lanes.map(({ layer, pulses }, li) => {
                    const top = li * LANE + 12;
                    const base = top + LANE - 22;
                    const hi = base - HIGH;

                    // One continuous square wave per channel.
                    let d = `M ${LEFT} ${base}`;
                    pulses.forEach((p) => {
                        d += ` L ${p.x} ${base} L ${p.x} ${hi} L ${p.x + p.w} ${hi} L ${p.x + p.w} ${base}`;
                    });
                    d += ` L ${width - 10} ${base}`;

                    return (
                        <g key={layer.slug}>
                            <text x="14" y={base - 14} style={{ fill: '#ff3b30', fontSize: 10.5, fontFamily: 'ui-monospace, monospace' }}>
                                {`CH${li}`}
                            </text>
                            <text x="46" y={base - 14} style={{ fill: '#e4e4e7', fontSize: 13, fontWeight: 500 }}>
                                {layer.name}
                            </text>
                            <text x="46" y={base} style={{ fill: '#52525b', fontSize: 10, fontFamily: 'ui-monospace, monospace' }}>
                                {layer.items.length} pulses
                            </text>

                            <path d={d} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.2" />

                            {pulses.map((p) => {
                                const active = isSelected(selected, p.item);
                                const counted = p.item.services !== null;
                                const delay = ((p.x - LEFT) / (width - LEFT)) * SWEEP_SECONDS;

                                return (
                                    <g
                                        key={p.item.id}
                                        role="button"
                                        tabIndex={0}
                                        aria-label={p.item.name}
                                        className="cursor-pointer outline-none"
                                        onClick={() => onSelect(layer, p.item)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                onSelect(layer, p.item);
                                            }
                                        }}
                                    >
                                        <rect
                                            x={p.x}
                                            y={hi}
                                            width={p.w}
                                            height={HIGH}
                                            fill={active ? '#fff' : counted ? 'url(#laDither)' : 'transparent'}
                                            stroke={active ? '#fff' : counted ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.25)'}
                                            strokeDasharray={counted ? undefined : '3 3'}
                                        />
                                        {!active && (
                                            <rect
                                                x={p.x}
                                                y={hi}
                                                width={p.w}
                                                height={HIGH}
                                                fill="#ff3b30"
                                                className="la-fire"
                                                style={{ animationDelay: `${delay}s` }}
                                            />
                                        )}
                                        <text
                                            x={p.x + 8}
                                            y={hi + 19}
                                            style={{ fill: active ? '#000' : '#f4f4f5', fontSize: 11.5, fontWeight: 500, pointerEvents: 'none' }}
                                        >
                                            {p.item.name}
                                        </text>
                                        <text
                                            x={p.x + p.w}
                                            y={hi - 5}
                                            textAnchor="end"
                                            style={{
                                                fill: active ? '#fff' : '#71717a',
                                                fontSize: 9.5,
                                                fontFamily: 'ui-monospace, monospace',
                                                pointerEvents: 'none',
                                            }}
                                        >
                                            {counted ? `${p.item.services}` : '—'}
                                        </text>
                                    </g>
                                );
                            })}
                        </g>
                    );
                })}

                <g className="la-sweep" style={{ animationDuration: `${SWEEP_SECONDS}s`, ['--la-travel' as string]: `${width - LEFT - 10}px` }}>
                    <line x1={LEFT} y1="0" x2={LEFT} y2={height - 40} stroke="#ff3b30" strokeWidth="1" />
                    <rect x={LEFT - 20} y="0" width="20" height={height - 40} fill="url(#laDither)" opacity=".25" />
                </g>

                <line x1={LEFT} y1={height - 34} x2={width - 10} y2={height - 34} stroke="rgba(255,255,255,.15)" />
                <text x={LEFT} y={height - 16} style={{ fill: '#52525b', fontSize: 10, fontFamily: 'ui-monospace, monospace' }}>
                    trigger: sweep · pulse width = services using it · dashed = not counted
                </text>
            </svg>
        </div>
    );
}
