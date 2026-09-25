import { useEffect, useRef } from 'react';
import { isSelected, slug, type ViewProps } from './shared';

/**
 * The stack as a filesystem: `tree` over /stack, one directory per layer. The
 * list is keyboard-driven — arrow keys move the selection, like a real pager.
 */
export function ShellTreeView({ layers, selected, onSelect }: ViewProps) {
    const flat = layers.flatMap((layer) => layer.items.map((item) => ({ layer, item })));
    const listRef = useRef<HTMLDivElement>(null);
    const counted = flat.filter((f) => f.item.services !== null).length;

    useEffect(() => {
        const el = listRef.current;
        if (!el) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            e.preventDefault();
            const at = flat.findIndex((f) => isSelected(selected, f.item));
            const next = Math.min(flat.length - 1, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)));
            onSelect(flat[next].layer, flat[next].item);
            el.querySelector<HTMLElement>(`[data-row="${flat[next].item.id}"]`)?.focus();
        };
        el.addEventListener('keydown', onKey);
        return () => el.removeEventListener('keydown', onKey);
    }, [flat, selected, onSelect]);

    return (
        <div
            ref={listRef}
            className="scanlines relative overflow-x-auto rounded-sm border border-white/12 bg-[#040405] p-4 font-mono text-[12.5px] leading-[1.7] sm:p-5"
        >
            <div className="text-zinc-500">
                <span className="text-[#ff3b30]">~$</span> tree -L 2 --du /stack
            </div>
            <div className="mt-1 text-zinc-300">
                /stack{' '}
                <span className="text-zinc-600">
                    · {flat.length} entries, {counted} counted · ↑↓ to move
                </span>
            </div>

            {layers.map((layer, li) => {
                const lastLayer = li === layers.length - 1;
                return (
                    <div key={layer.slug}>
                        <div className="flex gap-2 whitespace-pre text-zinc-100">
                            <span className="text-zinc-600">{lastLayer ? '└── ' : '├── '}</span>
                            <span className="font-medium">{layer.slug}/</span>
                            <span className="hidden text-zinc-600 sm:inline"> # {layer.tagline}</span>
                        </div>
                        {layer.items.map((item, ii) => {
                            const lastItem = ii === layer.items.length - 1;
                            const active = isSelected(selected, item);
                            const size = item.services !== null ? String(item.services).padStart(3, ' ') : '  -';

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    data-row={item.id}
                                    aria-pressed={active}
                                    onClick={() => onSelect(layer, item)}
                                    className={`flex w-full min-w-max gap-2 text-left whitespace-pre outline-none ${
                                        active ? 'bg-white text-black' : 'text-zinc-300 hover:bg-white/[0.06] focus-visible:bg-white/[0.06]'
                                    }`}
                                >
                                    <span className={active ? 'text-zinc-500' : 'text-zinc-600'}>
                                        {lastLayer ? '    ' : '│   '}
                                        {lastItem ? '└── ' : '├── '}
                                    </span>
                                    <span className={active ? 'text-black' : item.services === null ? 'text-zinc-600' : 'text-[#ff3b30]'}>
                                        [{size}]
                                    </span>
                                    <span className="font-medium">{slug(item.name)}</span>
                                    <span className={active ? 'text-zinc-600' : 'text-zinc-600'}>{item.usage ? `  ${item.usage}` : ''}</span>
                                </button>
                            );
                        })}
                    </div>
                );
            })}

            <div className="mt-2 text-zinc-500">
                {layers.length} directories, {flat.length} files
            </div>
        </div>
    );
}
