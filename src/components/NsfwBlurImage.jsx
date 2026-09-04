import { useState } from 'react';
import EnlargeableImage from './EnlargeableImage.jsx';

export default function NsfwBlurImage({ src, alt = '', nsfw = false }) {
    const [revealed, setRevealed] = useState(false);

    if (!nsfw) return <EnlargeableImage src={src} alt={alt} />;

    return (
        <div className={`char-image-wrap nsfw-blur ${revealed ? 'revealed' : ''}`.trim()} data-nsfw="true">
            <EnlargeableImage src={src} alt={alt} wrap={false} />
            {!revealed && (
                <div className="nsfw-warning" onClick={() => setRevealed(true)}>
                    NSFW (click to reveal)
                </div>
            )}
        </div>
    );
}
