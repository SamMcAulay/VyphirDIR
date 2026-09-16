export function firstVisible(ids, visible) {
    return ids.find((id) => visible.has(id)) ?? null;
}
