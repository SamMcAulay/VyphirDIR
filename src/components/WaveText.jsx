export default function WaveText({ text, as: Tag = 'span', className = '' }) {
    const letters = Array.from(text);
    return (
        <Tag className={`wave-text ${className}`.trim()}>
            {letters.map((ch, i) => (
                <span className="wave-text-letter" style={{ '--i': i }} key={i}>
                    {ch === ' ' ? ' ' : ch}
                </span>
            ))}
        </Tag>
    );
}
