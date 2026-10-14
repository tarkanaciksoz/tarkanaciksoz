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
 * A photograph as 1-bit dots: brightness, a low black point and lifted mid-tones
 * (these photographs are mostly shadow), then an ordered dither, like the rest of the page.
 */
export async function sampleImage(src: string, cols: number, aspect: number): Promise<Float32Array> {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    await img.decode();
    const w = cols;
    const h = Math.max(1, Math.round(cols / aspect));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    g.drawImage(img, (w - img.naturalWidth * scale) / 2, (h - img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale);
    const px = g.getImageData(0, 0, w, h).data;
    const out: number[] = [];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4;
            const v = (0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]) / 255;
            const lum = Math.min(1, Math.pow(Math.max(0, (v - 0.05) / 0.95), 0.55) * 1.35);
            if (lum > BAYER4[(y % 4) * 4 + (x % 4)]) out.push((x + 0.5) / w, (y + 0.5) / h);
        }
    }
    return shuffle(out);
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
