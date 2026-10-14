/** Dot layouts the chapters ask the bits to take. All return points normalised to 0..1 in their box. */

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);

/** Shuffles point pairs in place (x0,y0,x1,y1,...) so bits leave one shape for the next as a swarm, not a sweep. */
function shuffle(points: number[]): Float32Array {
    const n = points.length / 2;
    for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [points[i * 2], points[j * 2]] = [points[j * 2], points[i * 2]];
        [points[i * 2 + 1], points[j * 2 + 1]] = [points[j * 2 + 1], points[i * 2 + 1]];
    }
    return new Float32Array(points);
}

/** The lit cells of some text, drawn on a grid of `cols` columns. */
export function sampleText(text: string, font: string, cols: number, aspect: number): Float32Array {
    const w = cols;
    const h = Math.max(1, Math.round(cols / aspect));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // Fit the text to the grid.
    let size = h;
    g.font = font.replace('{size}', `${size}px`);
    const measured = g.measureText(text).width;
    if (measured > w * 0.96) size = Math.floor((size * w * 0.96) / measured);
    g.font = font.replace('{size}', `${size}px`);
    g.fillText(text, w / 2, h / 2 + size * 0.04);
    const data = g.getImageData(0, 0, w, h).data;
    const out: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 120) out.push((x + 0.5) / w, (y + 0.5) / h);
    return shuffle(out);
}

/**
 * An icon as dots, in two tones: its outline dense and bright, its duotone fill
 * a sparse dither. Returns triples (x, y, tone) normalised to the box, the icon
 * centred and as large as the box allows.
 */
export async function sampleIcon(svg: string, cols: number, aspect: number): Promise<Float32Array> {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
        const img = new Image();
        img.src = url;
        await img.decode();
        const w = cols;
        const h = Math.max(1, Math.round(cols / aspect));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d', { willReadFrequently: true })!;
        const size = Math.min(w, h) * 0.92;
        g.drawImage(img, (w - size) / 2, (h - size) / 2, size, size);
        const px = g.getImageData(0, 0, w, h).data;
        const out: number[] = [];
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const a = px[(y * w + x) * 4 + 3];
                if (a > 150) out.push((x + 0.5) / w, (y + 0.5) / h, 1);
                else if (a > 20 && BAYER4[(y % 4) * 4 + (x % 4)] < 0.4) out.push((x + 0.5) / w, (y + 0.5) / h, 0);
            }
        }
        // Shuffle whole triples, so bits leave one icon for the next as a swarm.
        const n = out.length / 3;
        for (let i = n - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            for (let k = 0; k < 3; k++) [out[i * 3 + k], out[j * 3 + k]] = [out[j * 3 + k], out[i * 3 + k]];
        }
        return new Float32Array(out);
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** A point on the quadratic curve from a to b that bows sideways by `bow` of its length. */
export function arc(ax: number, ay: number, bx: number, by: number, bow: number, t: number): [number, number] {
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const dx = bx - ax;
    const dy = by - ay;
    const cx = mx - dy * bow;
    const cy = my + dx * bow;
    const u = 1 - t;
    return [u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by];
}

export const smoothstep = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};
