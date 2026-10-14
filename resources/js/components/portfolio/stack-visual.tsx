import type { LayerId } from './anatomy-steps';

export type VisualLayer = {
    id: LayerId;
    name: string;
    sub: string;
    shape: 'device' | 'node' | 'slab' | 'module' | 'cylinder';
    pattern?: 'grille' | 'code' | 'fork';
};

/** One drawing per layer, stacked, so a glance down the tower reads as different things. */
export const VISUAL_LAYERS: VisualLayer[] = [
    { id: 'browser', name: 'Browser', sub: 'fetch()', shape: 'device' },
    { id: 'dns', name: 'DNS', sub: 'name to address', shape: 'node' },
    { id: 'conn', name: 'Connection', sub: 'TCP · TLS', shape: 'node' },
    { id: 'wire', name: 'In flight', sub: 'on the wire', shape: 'node' },
    { id: 'edge', name: 'Server entry', sub: 'boot · middleware', shape: 'slab', pattern: 'grille' },
    { id: 'app', name: 'Application', sub: 'controller · resources', shape: 'slab', pattern: 'code' },
    { id: 'cache', name: 'Cache', sub: 'payload store', shape: 'module' },
    { id: 'db', name: 'Database', sub: 'SQL · query plan', shape: 'cylinder' },
];

const CX = 168;
const Y: Record<LayerId, number> = { browser: 38, dns: 96, conn: 140, wire: 184, edge: 258, app: 344, cache: 430, db: 520 };
export const layerY = (id: LayerId) => Y[id];
export const VIEW = { w: 560, h: 600 };

const W = 112;
const H = 54;
const T = 10;
const pts = (list: [number, number][]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
/** A point on the top face in isometric coordinates, a and b running 0..1 along its two edges. */
const face = (cy: number, a: number, b: number, w = W, h = H): [number, number] => [CX - w + (a + b) * w, cy + (b - a) * h];

function Pattern({ kind, cy, lit }: { kind: 'grille' | 'code' | 'fork'; cy: number; lit: boolean }) {
    const stroke = lit ? 'rgba(255,255,255,.34)' : 'rgba(255,255,255,.15)';

    if (kind === 'grille') {
        return (
            <>
                {[0.24, 0.42, 0.6, 0.78].map((b) => (
                    <polyline key={b} points={pts([face(cy, 0.14, b), face(cy, 0.86, b)])} fill="none" stroke={stroke} />
                ))}
            </>
        );
    }

    if (kind === 'code') {
        return (
            <>
                {(
                    [
                        [0.3, 0.5],
                        [0.46, 0.34],
                        [0.62, 0.58],
                    ] as [number, number][]
                ).map(([b, len]) => (
                    <polyline key={b} points={pts([face(cy, 0.2, b), face(cy, 0.2 + len, b)])} fill="none" stroke={stroke} />
                ))}
            </>
        );
    }

    return (
        <>
            <polyline points={pts([face(cy, 0.16, 0.5), face(cy, 0.46, 0.5)])} fill="none" stroke={stroke} />
            {[0.26, 0.5, 0.74].map((b) => (
                <polyline key={b} points={pts([face(cy, 0.46, 0.5), face(cy, 0.84, b)])} fill="none" stroke={stroke} />
            ))}
        </>
    );
}

function Slab({ cy, lit, corrupt = false, children }: { cy: number; lit: boolean; corrupt?: boolean; children?: React.ReactNode }) {
    const top = pts([
        [CX, cy - H],
        [CX + W, cy],
        [CX, cy + H],
        [CX - W, cy],
    ]);
    const rim = pts([
        [CX - W, cy],
        [CX, cy - H],
        [CX + W, cy],
    ]);

    return (
        <>
            <ellipse cx={CX} cy={cy + H + T + 14} rx={W * 0.82} ry={H * 0.28} fill="#000" opacity=".7" filter="url(#gbBlur)" />
            <polygon
                points={pts([
                    [CX - W, cy],
                    [CX, cy + H],
                    [CX, cy + H + T],
                    [CX - W, cy + T],
                ])}
                fill="#050506"
                stroke="rgba(255,255,255,.1)"
            />
            <polygon
                points={pts([
                    [CX, cy + H],
                    [CX + W, cy],
                    [CX + W, cy + T],
                    [CX, cy + H + T],
                ])}
                fill="#0b0b0d"
                stroke="rgba(255,255,255,.14)"
            />
            <polygon
                points={pts([
                    [CX, cy + H],
                    [CX + W, cy],
                    [CX + W, cy + T],
                    [CX, cy + H + T],
                ])}
                fill="url(#gbDitherSparse)"
            />
            <polygon points={top} fill="#0c0c0e" />
            <polygon
                points={top}
                fill={lit ? 'url(#gbDitherDense)' : 'url(#gbDitherSparse)'}
                stroke={lit ? '#fff' : 'rgba(255,255,255,.3)'}
                strokeWidth={lit ? 1.2 : 1}
            />
            <polyline points={rim} fill="none" stroke={lit ? '#fff' : 'rgba(255,255,255,.4)'} />
            {corrupt && lit && (
                <g className="tear" style={{ mixBlendMode: 'screen' }}>
                    <polygon points={top} fill="none" stroke="#ff3b30" strokeWidth="1.4" transform="translate(-4 1)" opacity=".9" />
                    <polygon points={top} fill="none" stroke="#22d3ee" strokeWidth="1.4" transform="translate(4 -1)" opacity=".9" />
                    <rect x={CX - W} y={cy - 6} width={W * 2} height="3" fill="#fff" opacity=".55" />
                    <rect x={CX - W * 0.6} y={cy + 14} width={W * 1.1} height="2" fill="#ff3b30" opacity=".7" />
                </g>
            )}
            {children}
        </>
    );
}

function Shape({ layer, lit, corrupt }: { layer: VisualLayer; lit: boolean; corrupt: boolean }) {
    const cy = Y[layer.id];

    if (layer.shape === 'device') {
        return (
            <>
                <rect
                    x={CX - 21}
                    y={cy - 26}
                    width="42"
                    height="52"
                    rx="7"
                    fill={lit ? '#1f2027' : '#101114'}
                    stroke={lit ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.22)'}
                />
                <rect x={CX - 16} y={cy - 21} width="32" height="36" rx="3" fill={lit ? '#32333c' : '#08080a'} stroke="rgba(255,255,255,.1)" />
                <line
                    x1={CX - 7}
                    y1={cy + 20}
                    x2={CX + 7}
                    y2={cy + 20}
                    stroke={lit ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.25)'}
                    strokeWidth="1.6"
                />
            </>
        );
    }

    if (layer.shape === 'node') {
        return (
            <>
                <circle cx={CX} cy={cy} r="11" fill={lit ? '#1f2027' : '#0d0d10'} stroke={lit ? '#fff' : 'rgba(255,255,255,.24)'} strokeWidth="1.2" />
                <circle cx={CX} cy={cy} r="3.4" fill={lit ? '#fff' : 'rgba(255,255,255,.3)'} />
            </>
        );
    }

    if (layer.shape === 'cylinder') {
        const rx = 92;
        const ry = 30;
        const hh = 24;
        return (
            <>
                <ellipse cx={CX} cy={cy + hh + ry - 4} rx={rx * 0.86} ry={ry * 0.4} fill="#000" opacity=".6" filter="url(#gbBlur)" />
                <path
                    d={`M ${CX - rx} ${cy - hh} L ${CX - rx} ${cy + hh} A ${rx} ${ry} 0 0 0 ${CX + rx} ${cy + hh} L ${CX + rx} ${cy - hh} Z`}
                    fill="url(#gbCyl)"
                    stroke="rgba(255,255,255,.14)"
                />
                <path d={`M ${CX - rx} ${cy - 8} A ${rx} ${ry} 0 0 0 ${CX + rx} ${cy - 8}`} fill="none" stroke="rgba(255,255,255,.07)" />
                <path d={`M ${CX - rx} ${cy + 6} A ${rx} ${ry} 0 0 0 ${CX + rx} ${cy + 6}`} fill="none" stroke="rgba(255,255,255,.07)" />
                <ellipse
                    cx={CX}
                    cy={cy - hh}
                    rx={rx}
                    ry={ry}
                    fill={lit ? 'url(#gbTopOn)' : 'url(#gbTop)'}
                    stroke={lit ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.2)'}
                />
            </>
        );
    }

    if (layer.shape === 'module') {
        const notches = [1, 2, 3, 4, 5, 6].map((k) => {
            const x = CX + W * (k / 7);
            const y = cy + H * (1 - k / 7);
            return <line key={k} x1={x} y1={y + 3} x2={x} y2={y + T - 2} stroke="rgba(255,255,255,.2)" strokeWidth="1.5" />;
        });
        return (
            <Slab cy={cy} lit={lit}>
                {notches}
            </Slab>
        );
    }

    return (
        <Slab cy={cy} lit={lit} corrupt={corrupt}>
            <Pattern kind={layer.pattern ?? 'code'} cy={cy} lit={lit} />
        </Slab>
    );
}

/** Delay between two layers landing while the tower assembles, in ms. */
export const DROP_STAGGER = 150;
export const DROP_DURATION = 740;
export const ASSEMBLY_MS = (VISUAL_LAYERS.length - 1) * DROP_STAGGER + DROP_DURATION;
/** Bottom-up: the database lands first, the browser last. */
export const dropOrder = (id: LayerId) => VISUAL_LAYERS.length - 1 - VISUAL_LAYERS.findIndex((l) => l.id === id);

type Props = {
    className?: string;
    active: LayerId | null;
    /** Play the assembly: layers fall into place from the bottom up. */
    building?: boolean;
    seen: Set<LayerId>;
    totals: Partial<Record<LayerId, number>>;
    orbY: number;
    flying: boolean;
    onPick: (id: LayerId) => void;
    format: (n: number) => string;
    /** The active step is the slowest one or had to do real work: show it. */
    corrupt?: boolean;
};

export function StackVisual({ className = 'w-full', active, building = false, seen, totals, orbY, flying, onPick, format, corrupt = false }: Props) {
    const deepest = Math.max(Y.browser, ...[...seen].map((id) => Y[id]));

    return (
        <svg
            viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
            className={className}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Where the request went"
        >
            <defs>
                <linearGradient id="gbTop" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#1e1f24" />
                    <stop offset="1" stopColor="#101114" />
                </linearGradient>
                <linearGradient id="gbTopOn" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#33343d" />
                    <stop offset="1" stopColor="#1b1c21" />
                </linearGradient>
                <linearGradient id="gbSideL" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#0a0a0b" />
                    <stop offset="1" stopColor="#060607" />
                </linearGradient>
                <linearGradient id="gbSideR" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#101012" />
                    <stop offset="1" stopColor="#17171b" />
                </linearGradient>
                <linearGradient id="gbCyl" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#0d0d10" />
                    <stop offset=".45" stopColor="#1d1e23" />
                    <stop offset="1" stopColor="#0b0b0d" />
                </linearGradient>
                <radialGradient id="gbPool">
                    <stop offset="0" stopColor="#fff" stopOpacity=".9" />
                    <stop offset=".55" stopColor="#fff" stopOpacity=".2" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
                <pattern id="gbDitherSparse" width="4" height="4" patternUnits="userSpaceOnUse">
                    <rect x="0" y="0" width="1" height="1" fill="rgba(255,255,255,.22)" />
                    <rect x="2" y="2" width="1" height="1" fill="rgba(255,255,255,.12)" />
                </pattern>
                <pattern id="gbDitherDense" width="3" height="3" patternUnits="userSpaceOnUse">
                    <rect x="0" y="0" width="1" height="1" fill="rgba(255,255,255,.6)" />
                    <rect x="1" y="2" width="1" height="1" fill="rgba(255,255,255,.35)" />
                    <rect x="2" y="1" width="1" height="1" fill="rgba(255,255,255,.2)" />
                </pattern>
                <filter id="gbBlur" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="6" />
                </filter>
            </defs>

            <line x1={CX - W} y1={Y.edge} x2={CX - W} y2={Y.cache + T} stroke="rgba(255,255,255,.12)" strokeDasharray="2 4" />
            <line x1={CX + W} y1={Y.edge} x2={CX + W} y2={Y.cache + T} stroke="rgba(255,255,255,.12)" strokeDasharray="2 4" />
            <line x1={CX} y1={Y.edge + H} x2={CX} y2={Y.cache + H + T} stroke="rgba(255,255,255,.08)" strokeDasharray="2 4" />
            <line x1={CX} y1={Y.browser} x2={CX} y2={Y.db} stroke="rgba(255,255,255,.08)" />
            <line x1={CX} y1={Y.browser} x2={CX} y2={deepest} stroke="rgba(255,255,255,.4)" />

            {[...VISUAL_LAYERS].reverse().map((layer) => {
                const lit = layer.id === active;
                const visited = seen.has(layer.id);
                const cy = Y[layer.id];
                const total = totals[layer.id];

                return (
                    <g
                        key={layer.id}
                        role="button"
                        tabIndex={0}
                        aria-label={layer.name}
                        onClick={() => onPick(layer.id)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onPick(layer.id);
                            }
                        }}
                        className="cursor-pointer outline-none"
                        opacity={visited ? 1 : 0.42}
                    >
                        <g
                            className={building ? 'layer-drop' : undefined}
                            style={building ? { animationDelay: `${dropOrder(layer.id) * DROP_STAGGER}ms` } : undefined}
                        >
                            <Shape layer={layer} lit={lit} corrupt={corrupt} />
                        </g>
                        {building && (
                            <g className="layer-impact" style={{ animationDelay: `${dropOrder(layer.id) * DROP_STAGGER}ms` }}>
                                <rect
                                    x={CX - (layer.shape === 'node' ? 26 : 128)}
                                    y={cy + (layer.shape === 'node' ? 12 : layer.shape === 'cylinder' ? 26 : H + T + 2)}
                                    width={layer.shape === 'node' ? 52 : 256}
                                    height="1.5"
                                    fill="#fff"
                                />
                                <rect
                                    x={CX - (layer.shape === 'node' ? 14 : 70)}
                                    y={cy + (layer.shape === 'node' ? 15 : layer.shape === 'cylinder' ? 30 : H + T + 6)}
                                    width={layer.shape === 'node' ? 28 : 140}
                                    height="1"
                                    fill="#ff3b30"
                                />
                            </g>
                        )}
                        {lit && layer.shape !== 'node' && layer.shape !== 'device' && (
                            <ellipse
                                cx={CX}
                                cy={layer.shape === 'cylinder' ? cy - 24 : cy}
                                rx={W * 0.5}
                                ry={H * 0.5}
                                fill="url(#gbPool)"
                                opacity=".5"
                            />
                        )}
                        <text x="300" y={cy - 3} style={{ fill: lit ? '#f4f4f5' : '#a1a1aa', fontSize: 14, fontWeight: 500 }}>
                            <tspan
                                style={{
                                    fill: lit ? '#ff3b30' : '#52525b',
                                    fontFamily: 'Geist Mono, ui-monospace, monospace',
                                    fontSize: 10.5,
                                }}
                            >
                                {`0x${(VISUAL_LAYERS.indexOf(layer) * 16).toString(16).toUpperCase().padStart(2, '0')} `}
                            </tspan>
                            {layer.name}
                        </text>
                        <text x="300" y={cy + 14} style={{ fill: '#6b6b74', fontSize: 11.5, fontFamily: 'Geist Mono, ui-monospace, monospace' }}>
                            {layer.sub}
                        </text>
                        {total !== undefined && (
                            <text
                                x={VIEW.w - 8}
                                y={cy - 3}
                                textAnchor="end"
                                style={{
                                    fill: lit ? '#f4f4f5' : '#8b8b94',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    fontFamily: 'Geist Mono, ui-monospace, monospace',
                                }}
                            >
                                {format(total)} ms
                            </text>
                        )}
                    </g>
                );
            })}

            <g style={{ transform: `translateY(${orbY}px)`, transition: flying ? 'none' : 'transform .5s cubic-bezier(.45,0,.2,1)' }}>
                <circle cx={CX} cy={0} r="13" fill="#fff" opacity=".13" filter="url(#gbBlur)" />
                <circle cx={CX} cy={0} r="4.5" fill="#fff" />
            </g>
        </svg>
    );
}
