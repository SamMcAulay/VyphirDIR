import { usePopClick } from '../hooks/usePopClick.js';

export default function LinkButton({ href, icon, children }) {
    const pop = usePopClick();
    return (
        <a href={href} className={`link-btn pop-clickable ${pop.className}`.trim()} onPointerUp={pop.onPointerUp}>
            <i className={icon} /> {children}
        </a>
    );
}
