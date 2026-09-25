import { DecodeText } from '../signal/decode-text';
import { slug, type Selection } from './shared';

type Props = { selected: Selection; index: number; total: number; variant?: 'card' | 'terminal' };

export function ToolDetail({ selected, index, total, variant = 'card' }: Props) {
    if (!selected) return null;
    const { layer, item } = selected;

    if (variant === 'terminal') {
        return (
            <aside className="scanlines relative overflow-hidden rounded-sm border border-white/15 bg-[#050506] p-4 font-mono text-[12.5px] leading-relaxed lg:sticky lg:top-20">
                <div className="text-zinc-500">
                    <span className="text-[#ff3b30]">~$</span> cat /stack/{layer.slug}/{slug(item.name)}
                </div>
                <div className="mt-3 text-lg font-medium text-zinc-50">
                    <DecodeText key={item.id} text={item.name} duration={380} />
                </div>
                <dl className="mt-3 grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2">
                    <dt className="text-zinc-600">layer</dt>
                    <dd className="text-zinc-300">{layer.name}</dd>
                    <dt className="text-zinc-600">used in</dt>
                    <dd className="text-zinc-300">{item.usage ?? '—'}</dd>
                    <dt className="text-zinc-600">services</dt>
                    <dd className={item.services === null ? 'text-zinc-500' : 'text-zinc-100'}>{item.services ?? 'not counted'}</dd>
                    <dt className="text-zinc-600">why</dt>
                    <dd className="font-sans text-[14px] text-zinc-200">{item.why}</dd>
                    {item.instead_of && (
                        <>
                            <dt className="text-zinc-600">instead_of</dt>
                            <dd className="font-sans text-[14px] text-zinc-400">{item.instead_of}</dd>
                        </>
                    )}
                </dl>
                <div className="mt-4 text-zinc-600">
                    -- row {index} of {total} · GET /api/stack <span className="inline-block h-3.5 w-2 translate-y-0.5 animate-pulse bg-zinc-300" />
                </div>
            </aside>
        );
    }

    return (
        <aside className="scanlines relative overflow-hidden rounded-sm border border-white/15 bg-[#050506] p-5 lg:sticky lg:top-20">
            <div className="font-mono text-[10.5px] tracking-[0.14em] text-zinc-500 uppercase">
                <span className="text-[#ff3b30]">▌</span> Layer · {layer.name}
            </div>
            <h3 className="mt-2 text-2xl leading-tight font-medium tracking-[-0.02em] text-zinc-50">
                <DecodeText key={item.id} text={item.name} duration={420} />
            </h3>
            <div className="mt-1 flex items-baseline gap-2 font-mono text-xs text-zinc-400">
                {item.usage && <span>in {item.usage}</span>}
                {item.services !== null && (
                    <span className="rounded-sm border border-white/20 px-1 text-[10.5px] text-zinc-200">{item.services} svc</span>
                )}
            </div>
            <p className="mt-3 text-sm text-zinc-200">{item.why}</p>
            {item.instead_of && (
                <p className="mt-3 border-t border-white/8 pt-3 text-[13px] text-zinc-400">
                    <span className="font-medium text-zinc-200">Instead of:</span> {item.instead_of}
                </p>
            )}
            <div className="mt-4 font-mono text-[11px] text-zinc-600">
                row {index} of {total} · GET /api/stack
            </div>
        </aside>
    );
}
