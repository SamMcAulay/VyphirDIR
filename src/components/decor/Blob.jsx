import { BLOB_PATHS } from './blob-paths.js';

export default function Blob({ variant = 1, color = 'var(--slime-pink-light)', size = 200, rotate = 0, className = '' }) {
    const path = BLOB_PATHS[variant] || BLOB_PATHS[1];
    return (
        <svg
            className={`decor-blob ${className}`.trim()}
            width={size}
            height={size}
            viewBox="0 0 200 200"
            style={{ transform: `rotate(${rotate}deg)` }}
            aria-hidden="true"
        >
            <path d={path} fill={color} />
        </svg>
    );
}
