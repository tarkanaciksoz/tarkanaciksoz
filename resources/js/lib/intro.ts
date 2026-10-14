/**
 * The boot screen and the hero share one moment: the hero's entrance waits until
 * the boot screen has opened, or until it has been skipped.
 */
let resolve: () => void = () => undefined;

export const introDone: Promise<void> = new Promise<void>((r) => {
    resolve = r;
});

export function markIntroDone() {
    resolve();
}
