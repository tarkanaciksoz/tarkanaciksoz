// Copies the brand marks named in database/seeders/data/stack.json out of the
// simple-icons package (CC0) into public/icons/stack, one light-grey SVG each.
// Run after changing an "icon" slug: node scripts/stack-icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as icons from 'simple-icons';

const layers = JSON.parse(readFileSync('database/seeders/data/stack.json', 'utf8'));
const bySlug = new Map(Object.values(icons).filter((i) => i?.slug).map((i) => [i.slug, i]));
const out = 'public/icons/stack';
mkdirSync(out, { recursive: true });

let written = 0;
for (const item of layers.flatMap((l) => l.items)) {
    if (!item.icon) continue;
    const icon = bySlug.get(item.icon);
    if (!icon) throw new Error(`simple-icons has no "${item.icon}" (for ${item.name})`);
    writeFileSync(`${out}/${icon.slug}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>${icon.title}</title><path fill="#e4e4e7" d="${icon.path}"/></svg>\n`);
    written++;
}
console.log(`${written} icons written to ${out}`);
