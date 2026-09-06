export default function Panel({ children, wide = false, xwide = false, className = '' }) {
    const sizeClass = xwide ? 'panel--xwide' : wide ? 'panel--wide' : '';
    return (
        <div className={`panel-wrapper ${sizeClass}`.trim()}>
            <div className={`panel ${className}`.trim()}>{children}</div>
        </div>
    );
}
