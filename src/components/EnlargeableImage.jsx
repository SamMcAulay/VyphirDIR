import { extractImageId } from '../../shared/image-id.js';

export default function EnlargeableImage({ src, alt = '', className = '', wrap = true }) {
    const id = extractImageId(src);
    const img = <img src={src} alt={alt} loading="lazy" />;
    const link = id ? (
        <a className="enlarge-link" href={`/i/${id}`} target="_blank" rel="noopener" aria-label={alt ? `Enlarge ${alt}` : 'Enlarge image'}>
            {img}
        </a>
    ) : (
        img
    );

    if (!wrap) return link;
    return <div className={`char-image-wrap ${className}`.trim()}>{link}</div>;
}
