/** Section divider: a hairline with a corrupted segment running along it, and the section's address. */
export function TearDivider({ address, label }: { address: string; label: string }) {
    return (
        <div className="mt-24 sm:mt-32">
            <div className="tear-line" />
            <div className="mt-3 flex items-baseline justify-between font-mono text-[10.5px] tracking-[0.14em] text-zinc-600 uppercase">
                <span>
                    <span className="text-[#ff3b30]">{address}</span> {label}
                </span>
                <span className="hidden sm:inline">{`seg ${address}`}</span>
            </div>
        </div>
    );
}
