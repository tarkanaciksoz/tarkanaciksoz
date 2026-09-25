import { Glyph } from '../portfolio/glyph';
import { isSelected, type ViewProps } from './shared';

/** The original rows: one glyph per layer, its tools as chips. */
export function BoardView({ layers, selected, onSelect }: ViewProps) {
    return (
        <div className="border-t border-white/8">
            {layers.map((layer) => {
                const on = selected?.layer.slug === layer.slug;
                return (
                    <div
                        key={layer.slug}
                        className="grid grid-cols-[56px_minmax(0,1fr)] items-start gap-x-4 gap-y-3 border-b border-white/8 py-4 sm:grid-cols-[96px_170px_minmax(0,1fr)] sm:items-center sm:gap-6"
                    >
                        <Glyph kind={layer.glyph} active={on} className="w-14 sm:w-24" />
                        <div className="min-w-0">
                            <div className="text-sm leading-tight font-medium text-zinc-100">{layer.name}</div>
                            <div className="mt-0.5 font-mono text-[10.5px] leading-snug text-zinc-500">{layer.tagline}</div>
                            <div className="mt-0.5 font-mono text-[10.5px] text-zinc-600">{layer.items.length} rows</div>
                        </div>
                        <div className="col-span-2 flex min-w-0 flex-wrap gap-1.5 sm:col-span-1">
                            {layer.items.map((item) => {
                                const active = isSelected(selected, item);
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => onSelect(layer, item)}
                                        className={`rounded-sm border px-2 py-1 text-left text-[11.5px] leading-tight font-medium transition-colors ${
                                            active
                                                ? 'border-white bg-white text-black'
                                                : 'border-white/15 text-zinc-200 hover:border-[#ff3b30] hover:text-white'
                                        }`}
                                    >
                                        {item.name}
                                        {item.usage && (
                                            <span className={`ml-1.5 font-mono text-[10px] ${active ? 'text-zinc-600' : 'text-zinc-500'}`}>
                                                {item.usage}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
