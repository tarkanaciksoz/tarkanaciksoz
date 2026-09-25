import { useState } from 'react';
import { isSelected, maxServices, weight, type ViewProps } from './shared';

const W = 120;
const H = 40;
const T = 9;
const CX = 150;
const CY = 56;

const pts = (list: [number, number][]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const face = (a: number, b: number): [number, number] => [CX - W + (a + b) * W, CY + (b - a) * H];

/**
 * An exploded stack: each layer is a slab, each tool a column standing on it,
 * as tall as the number of services that use it. Hovering a name lights its column.
 */
export function ExplodedView({ layers, selected, onSelect }: ViewProps) {
    const max = maxServices(layers);
    const [hover, setHover] = useState<number | null>(null);

    return (
        <div className="relative">
            <span className="absolute top-8 bottom-8 left-[75px] w-px bg-white/10 sm:left-[150px]" aria-hidden="true" />

            {layers.map((layer, li) => {
                const onLayer = selected?.layer.slug === layer.slug;
                const n = layer.items.length;

                return (
                    <div
                        key={layer.slug}
                        className="relative grid grid-cols-[150px_minmax(0,1fr)] items-center gap-4 py-1 sm:grid-cols-[300px_minmax(0,1fr)] sm:gap-8"
                    >
                        <svg viewBox="0 0 300 120" className="w-[150px] sm:w-[300px]" aria-hidden="true">
                            <defs>
                                <pattern id={`exD${li}`} width="3" height="3" patternUnits="userSpaceOnUse">
                                    <rect width="1" height="1" fill={onLayer ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.2)'} />
                                </pattern>
                            </defs>
                            <ellipse cx={CX} cy={CY + H + T + 12} rx={W * 0.8} ry={H * 0.3} fill="#000" opacity=".7" />
                            <polygon
                                points={pts([
                                    [CX - W, CY],
                                    [CX, CY + H],
                                    [CX, CY + H + T],
                                    [CX - W, CY + T],
                                ])}
                                fill="#050506"
                                stroke="rgba(255,255,255,.1)"
                            />
                            <polygon
                                points={pts([
                                    [CX, CY + H],
                                    [CX + W, CY],
                                    [CX + W, CY + T],
                                    [CX, CY + H + T],
                                ])}
                                fill="#0b0b0d"
                                stroke="rgba(255,255,255,.14)"
                            />
                            <polygon
                                points={pts([
                                    [CX, CY - H],
                                    [CX + W, CY],
                                    [CX, CY + H],
                                    [CX - W, CY],
                                ])}
                                fill="#0c0c0e"
                            />
                            <polygon
                                points={pts([
                                    [CX, CY - H],
                                    [CX + W, CY],
                                    [CX, CY + H],
                                    [CX - W, CY],
                                ])}
                                fill={`url(#exD${li})`}
                                stroke={onLayer ? '#fff' : 'rgba(255,255,255,.3)'}
                            />

                            {layer.items.map((item, ii) => {
                                const a = 0.18 + (ii / Math.max(1, n - 1)) * 0.64;
                                const [bx, by] = face(a, 0.5);
                                const tall = item.services === null ? 6 : 8 + weight(item, max) * 46;
                                const lit = isSelected(selected, item) || hover === item.id;
                                const w = 7;
                                const d = 4;
                                const counted = item.services !== null;

                                return (
                                    <g key={item.id}>
                                        <polygon
                                            points={pts([
                                                [bx - w, by],
                                                [bx, by + d],
                                                [bx, by + d - tall],
                                                [bx - w, by - tall],
                                            ])}
                                            fill={lit ? '#d4d4d8' : '#0f0f12'}
                                            stroke={lit ? '#fff' : 'rgba(255,255,255,.35)'}
                                            strokeDasharray={counted ? undefined : '2 2'}
                                        />
                                        <polygon
                                            points={pts([
                                                [bx, by + d],
                                                [bx + w, by],
                                                [bx + w, by - tall],
                                                [bx, by + d - tall],
                                            ])}
                                            fill={lit ? '#fff' : '#18181c'}
                                            stroke={lit ? '#fff' : 'rgba(255,255,255,.35)'}
                                            strokeDasharray={counted ? undefined : '2 2'}
                                        />
                                        <polygon
                                            points={pts([
                                                [bx - w, by - tall],
                                                [bx, by + d - tall],
                                                [bx + w, by - tall],
                                                [bx, by - d - tall],
                                            ])}
                                            fill={lit ? '#ff3b30' : '#26262b'}
                                            stroke={lit ? '#ff3b30' : 'rgba(255,255,255,.4)'}
                                        />
                                    </g>
                                );
                            })}
                        </svg>

                        <div className="min-w-0 py-2">
                            <div className="flex items-baseline gap-2">
                                <span className="font-mono text-[10.5px] text-[#ff3b30]">{`L${li}`}</span>
                                <span className="text-[15px] leading-tight font-medium text-zinc-100">{layer.name}</span>
                                <span className="hidden font-mono text-[10.5px] text-zinc-600 sm:inline">{layer.tagline}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                                {layer.items.map((item) => {
                                    const active = isSelected(selected, item);
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            aria-pressed={active}
                                            onMouseEnter={() => setHover(item.id)}
                                            onMouseLeave={() => setHover(null)}
                                            onFocus={() => setHover(item.id)}
                                            onBlur={() => setHover(null)}
                                            onClick={() => onSelect(layer, item)}
                                            className={`text-left text-[13px] transition-colors ${
                                                active
                                                    ? 'text-white underline decoration-[#ff3b30] decoration-2 underline-offset-4'
                                                    : 'text-zinc-400 hover:text-white'
                                            }`}
                                        >
                                            {item.name}
                                            <span className="ml-1 font-mono text-[10px] text-zinc-600">{item.services ?? '—'}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
