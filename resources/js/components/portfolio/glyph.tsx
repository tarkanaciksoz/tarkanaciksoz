type Props = { kind: string; active?: boolean; className?: string };

/**
 * One drawing per layer, so a glance down the map reads as a stack of different
 * things rather than seven copies of the same slab.
 */
export function Glyph({ kind, active = false, className = '' }: Props) {
    const stroke = active ? 'rgba(255,255,255,.62)' : 'rgba(255,255,255,.26)';
    const faint = active ? 'rgba(255,255,255,.26)' : 'rgba(255,255,255,.14)';
    const fill = active ? '#1f2027' : '#131418';
    const side = active ? '#101115' : '#0b0b0e';

    const slab = (pattern: React.ReactNode) => (
        <>
            <polygon points="60,54 96,68 60,82 24,68" fill="#000" opacity=".55" />
            <polygon points="24,44 60,58 60,64 24,50" fill={side} stroke={faint} />
            <polygon points="60,58 96,44 96,50 60,64" fill={side} stroke={faint} />
            <polygon points="60,30 96,44 60,58 24,44" fill={fill} stroke={stroke} />
            {pattern}
        </>
    );

    const line = (x1: number, y1: number, x2: number, y2: number) => <line key={`${x1}${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={faint} />;

    return (
        <svg viewBox="0 0 120 92" className={className} aria-hidden="true">
            {kind === 'devices' && (
                <>
                    <rect x="34" y="28" width="26" height="44" rx="5" fill={fill} stroke={stroke} />
                    <rect x="37" y="32" width="20" height="31" rx="2" fill={active ? '#2b2c34' : '#08080a'} stroke={faint} />
                    <line x1="43" y1="68" x2="51" y2="68" stroke={stroke} strokeWidth="1.5" />
                    <rect x="66" y="36" width="34" height="23" rx="3" fill={fill} stroke={stroke} />
                    <rect x="69" y="39" width="28" height="17" rx="1.5" fill={active ? '#2b2c34' : '#08080a'} stroke={faint} />
                    <line x1="76" y1="64" x2="90" y2="64" stroke={stroke} strokeWidth="1.5" />
                </>
            )}
            {kind === 'grille' &&
                slab(
                    <>
                        {[0.3, 0.45, 0.6, 0.75].map((t) =>
                            line(24 + 36 * t, 44 + 14 * t, 96 - 36 * (1 - t) + 36 * (1 - t) - 36 * (1 - t), 44 + 14 * t),
                        )}
                        <polyline points="34,48 70,62" stroke={faint} fill="none" />
                        <polyline points="44,44 80,58" stroke={faint} fill="none" />
                        <polyline points="54,40 90,54" stroke={faint} fill="none" />
                    </>,
                )}
            {kind === 'code' &&
                slab(
                    <>
                        <polyline points="40,45 62,54" stroke={faint} fill="none" />
                        <polyline points="48,41 64,47" stroke={faint} fill="none" />
                        <polyline points="52,50 74,59" stroke={faint} fill="none" />
                    </>,
                )}
            {kind === 'fork' &&
                slab(
                    <>
                        <polyline points="38,46 56,53" stroke={faint} fill="none" />
                        <polyline points="56,53 78,44" stroke={faint} fill="none" />
                        <polyline points="56,53 78,53" stroke={faint} fill="none" />
                        <polyline points="56,53 74,62" stroke={faint} fill="none" />
                        <circle cx="78" cy="44" r="2" fill={faint} />
                        <circle cx="78" cy="53" r="2" fill={faint} />
                        <circle cx="74" cy="62" r="2" fill={faint} />
                    </>,
                )}
            {kind === 'stages' &&
                slab(
                    <>
                        <polygon points="44,46 50,43 56,46 50,49" fill="rgba(255,255,255,.08)" stroke={faint} />
                        <polygon points="58,52 64,49 70,52 64,55" fill="rgba(255,255,255,.08)" stroke={faint} />
                        <polygon points="72,58 78,55 84,58 78,61" fill="rgba(255,255,255,.08)" stroke={faint} />
                    </>,
                )}
            {kind === 'cylinder' && (
                <>
                    <ellipse cx="60" cy="76" rx="30" ry="6" fill="#000" opacity=".55" />
                    <path d="M 30 40 L 30 62 A 30 10 0 0 0 90 62 L 90 40 Z" fill={side} stroke={stroke} />
                    <path d="M 30 47 A 30 10 0 0 0 90 47" fill="none" stroke={faint} />
                    <path d="M 30 55 A 30 10 0 0 0 90 55" fill="none" stroke={faint} />
                    <ellipse cx="60" cy="40" rx="30" ry="10" fill={fill} stroke={stroke} />
                </>
            )}
            {kind === 'radar' && (
                <>
                    <circle cx="60" cy="50" r="21" fill={fill} stroke={stroke} />
                    <circle cx="60" cy="50" r="13" fill="none" stroke={faint} />
                    <circle cx="60" cy="50" r="6" fill="none" stroke={faint} />
                    <line x1="60" y1="50" x2="75" y2="39" stroke={stroke} strokeWidth="1.4" />
                    <circle cx="60" cy="50" r="2.4" fill={active ? '#fff' : 'rgba(255,255,255,.4)'} />
                </>
            )}
        </svg>
    );
}
