import type { StackItem, StackLayer } from '@/types/portfolio';

export type Selection = { layer: StackLayer; item: StackItem } | null;

export type ViewProps = {
    layers: StackLayer[];
    selected: Selection;
    onSelect: (layer: StackLayer, item: StackItem) => void;
};

export const hex = (n: number, width = 4) => `0x${n.toString(16).toUpperCase().padStart(width, '0')}`;

/** Largest counted value, so every view scales against the same ceiling. */
export const maxServices = (layers: StackLayer[]) => Math.max(1, ...layers.flatMap((l) => l.items.map((i) => i.services ?? 0)));

/** Weight used for sizing. Uncounted items get a neutral size and are drawn dashed, never guessed. */
export const weight = (item: StackItem, max: number) => (item.services === null ? 0.5 : item.services / max);

export const slug = (s: string) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

export const isSelected = (selected: Selection, item: StackItem) => selected?.item.id === item.id;
