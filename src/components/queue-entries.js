/*
 * Queue grouping (page-layouts spec 6.4). The admin panel's enabled columns
 * are the stages, in their order. The queue data has no "done" flag, so the
 * last stage stands in for it, but only when there is more than one stage.
 */
export function queueEntries(data) {
    const stages = ((data && data.columns) || []).filter((column) => column.enabled);
    const indexById = new Map(stages.map((stage, i) => [stage.id, i]));
    const hasFinishedStage = stages.length >= 2;
    const active = [];
    const finished = [];

    for (const card of (data && data.cards) || []) {
        if (!indexById.has(card.columnId)) continue;
        const stageIndex = indexById.get(card.columnId);
        const entry = { ...card, stageIndex, stageCount: stages.length, stageName: stages[stageIndex].name };
        if (hasFinishedStage && stageIndex === stages.length - 1) finished.push(entry);
        else active.push(entry);
    }

    // Array.prototype.sort is stable, so cards in the same stage keep data order.
    active.sort((a, b) => b.stageIndex - a.stageIndex);
    return { stages, active, finished };
}
