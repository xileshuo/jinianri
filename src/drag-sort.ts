import type { AnniversaryEvent, EventGroup } from "./types";

export function normalizeGroupSortOrders(events: AnniversaryEvent[], group: EventGroup): void {
  events
    .filter((e) => e.group === group)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach((e, i) => {
      e.sortOrder = i;
    });
}

export function moveEventToGroup(
  events: AnniversaryEvent[],
  eventId: string,
  group: EventGroup,
  sortOrder?: number
): void {
  const event = events.find((e) => e.id === eventId);
  if (!event) return;
  const oldGroup = event.group;
  event.group = group;
  if (sortOrder !== undefined) {
    event.sortOrder = sortOrder;
  } else {
    const max = events
      .filter((e) => e.group === group && e.id !== eventId)
      .reduce((m, e) => Math.max(m, e.sortOrder), -1);
    event.sortOrder = max + 1;
  }
  normalizeGroupSortOrders(events, oldGroup);
  normalizeGroupSortOrders(events, group);
}

export function reorderEvent(
  events: AnniversaryEvent[],
  draggedId: string,
  targetId: string,
  before: boolean
): void {
  if (draggedId === targetId) return;
  const dragged = events.find((e) => e.id === draggedId);
  const target = events.find((e) => e.id === targetId);
  if (!dragged || !target) return;

  dragged.group = target.group;
  const groupEvents = events
    .filter((e) => e.group === target.group && e.id !== draggedId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const targetIdx = groupEvents.findIndex((e) => e.id === targetId);
  const insertIdx = before ? targetIdx : targetIdx + 1;
  groupEvents.splice(insertIdx, 0, dragged);
  groupEvents.forEach((e, i) => {
    e.sortOrder = i;
  });
}
