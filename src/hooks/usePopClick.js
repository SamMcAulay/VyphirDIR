import { useCallback, useEffect, useRef, useState } from 'react';

export function usePopClick(durationMs = 260) {
    const [popping, setPopping] = useState(false);
    const timeoutRef = useRef(null);

    useEffect(() => () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }, []);

    const onPointerUp = useCallback(() => {
        setPopping(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setPopping(false), durationMs);
    }, [durationMs]);

    return { className: popping ? 'pop-active' : '', onPointerUp };
}
