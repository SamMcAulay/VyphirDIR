/*
 * Page-layouts spec 6.5: every yes/no bullet, from any point, moves into the
 * Will draw / Won't draw panels, so adding one to another point keeps working.
 */
export function splitTos(points) {
    const will = [];
    const wont = [];
    const rest = (points || []).map((point) => {
        const bullets = [];
        for (const bullet of point.bullets || []) {
            if (bullet.type === 'yesno') (bullet.value ? will : wont).push(bullet.text || '');
            else bullets.push(bullet);
        }
        return { ...point, bullets };
    });
    return { will, wont, points: rest };
}
