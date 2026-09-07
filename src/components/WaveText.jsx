export default function WaveText({ text, as: Tag = 'span', className = '' }) {
    const letters = Array.from(text);
    return (
        <Tag className={`wave-text ${className}`.trim()} aria-label={text}>
            {letters.map((ch, i) => (
                <span className="wave-text-letter" style={{ '--i': i }} key={i} aria-hidden="true">
                    {ch === ' ' ? ' ' : ch}
                </span>
            ))}
        </Tag>
    );
}
