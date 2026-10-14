import type { ReactNode } from 'react';

export type Loadable<T> = { data: T | null; loading: boolean; error: boolean; reload: () => void };

/**
 * What a section shows while its endpoint is answering, or after it failed:
 * a skeleton in the shape of the real thing, or the failed call and a retry.
 */
export function SectionState<T>({
    state,
    endpoint,
    skeleton,
    children,
}: {
    state: Loadable<T>;
    endpoint: string;
    skeleton: ReactNode;
    children: ReactNode;
}) {
    if (state.loading) return <div aria-busy="true">{skeleton}</div>;

    if (state.error || !state.data) {
        return (
            <div
                className="mt-10 flex flex-wrap items-center gap-4 border-l-2 border-[#ff3b30] py-2 pl-4 font-mono text-[13px] text-zinc-400"
                role="alert"
            >
                <span>
                    GET <span className="text-zinc-100">{endpoint}</span> did not answer.
                </span>
                <button type="button" onClick={state.reload} className="jitter text-zinc-100 underline decoration-white/30 underline-offset-4">
                    Try again
                </button>
            </div>
        );
    }

    return <>{children}</>;
}
