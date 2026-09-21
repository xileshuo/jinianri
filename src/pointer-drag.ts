import type { EventGroup } from "./types";

const DESKTOP_MOVE_THRESHOLD = 6;
const TOUCH_MOVE_THRESHOLD = 22;
const GROUP_DESKTOP_MOVE_THRESHOLD = 10;
const GROUP_TOUCH_MOVE_THRESHOLD = 28;

function getMoveThreshold(kind: "event" | "group" = "event"): number {
  const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  if (kind === "group") {
    return coarse ? GROUP_TOUCH_MOVE_THRESHOLD : GROUP_DESKTOP_MOVE_THRESHOLD;
  }
  return coarse ? TOUCH_MOVE_THRESHOLD : DESKTOP_MOVE_THRESHOLD;
}

export interface PointerDragHandlers {
  onEventReorder: (draggedId: string, targetId: string, before: boolean) => void;
  onEventToGroup: (eventId: string, group: EventGroup) => void;
  onGroupReorder: (draggedGroup: EventGroup, targetGroup: EventGroup, before: boolean) => void;
}

interface ActiveDrag {
  kind: "event" | "group";
  id: string;
  el: HTMLElement;
  pointerTarget: HTMLElement;
  sectionEl: HTMLElement | null;
  ghost: HTMLElement | null;
  startX: number;
  startY: number;
  moved: boolean;
  startedOnTitle: boolean;
  moveThreshold: number;
  pointerId: number;
  gap: number;
  sourceContainer: HTMLElement | null;
  layoutContainer: HTMLElement | null;
  insertIndex: number;
}

const transformCache = new WeakMap<HTMLElement, string>();

function safeSetPointerCapture(el: HTMLElement, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // ignore
  }
}

function safeReleasePointerCapture(el: HTMLElement, pointerId: number): void {
  try {
    el.releasePointerCapture(pointerId);
  } catch {
    // ignore
  }
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("[data-drag-kind='group'], [data-drag-kind='event']")) return false;
  return !!target.closest("button, input, label, a, .jnr-no-drag");
}

function isGhost(el: Element): boolean {
  return el.classList.contains("jnr-drag-ghost");
}

function outerHeight(el: HTMLElement): number {
  const h = el.getBoundingClientRect().height;
  return h > 0 ? h : el.offsetHeight;
}

function eventItems(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("[data-drag-kind='event'][data-event-id]")];
}

function visibleEventItems(container: HTMLElement, excludeId: string): HTMLElement[] {
  return eventItems(container).filter((el) => el.dataset.eventId !== excludeId);
}

function groupSectionItems(container: HTMLElement, excludeGroup: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("[data-group-section]")].filter(
    (el) => el.dataset.groupSection !== excludeGroup
  );
}

function setTransform(el: HTMLElement, value: string): void {
  const prev = transformCache.get(el);
  if (prev === value) return;
  transformCache.set(el, value);
  el.style.transform = value;
}

function clearShiftStyles(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(".jnr-sort-shift").forEach((el) => {
    transformCache.delete(el);
    el.style.transform = "";
    el.style.opacity = "";
    el.removeClass("jnr-sort-shift");
  });
}

function markShift(el: HTMLElement, opacity?: string): void {
  if (!el.hasClass("jnr-sort-shift")) el.addClass("jnr-sort-shift");
  if (opacity !== undefined) el.style.opacity = opacity;
}

function createLightGhost(source: HTMLElement): HTMLElement {
  const rect = source.getBoundingClientRect();
  const ghost = document.createElement("div");
  ghost.addClass("jnr-drag-ghost", "jnr-drag-ghost-lite");
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;

  const label = source.querySelector(".jnr-card-name, .jnr-group-title")?.textContent?.trim();
  if (label) {
    ghost.createSpan({ text: label, cls: "jnr-drag-ghost-label" });
  }
  return ghost;
}

function findEventDropContainer(root: HTMLElement, x: number, y: number): HTMLElement | null {
  for (const node of document.elementsFromPoint(x, y)) {
    if (!(node instanceof HTMLElement) || isGhost(node)) continue;

    const body = node.closest<HTMLElement>("[data-group-body]");
    if (body && root.contains(body)) return body;

    const manageList = node.closest<HTMLElement>(".jnr-manage-list");
    if (manageList && root.contains(manageList)) return manageList;

    const soon = node.closest<HTMLElement>(".jnr-group-soon");
    if (soon && root.contains(soon)) return soon;

    const header = node.closest<HTMLElement>("[data-drag-kind='group'][data-group]");
    if (header && root.contains(header)) {
      const group = header.dataset.group;
      const targetBody = root.querySelector<HTMLElement>(`[data-group-body='${group}']`);
      if (targetBody) return targetBody;
    }
  }
  return null;
}

function findGroupListContainer(root: HTMLElement, x: number, y: number): HTMLElement | null {
  for (const node of document.elementsFromPoint(x, y)) {
    if (!(node instanceof HTMLElement) || isGhost(node)) continue;
    const list = node.closest<HTMLElement>(".jnr-card-list, .jnr-manage-panel");
    if (list && root.contains(list)) return list;
  }
  return root.querySelector<HTMLElement>(".jnr-card-list, .jnr-manage-panel");
}

function computeEventInsertIndex(container: HTMLElement, y: number, excludeId: string): number {
  const visible = visibleEventItems(container, excludeId);
  for (let i = 0; i < visible.length; i++) {
    const rect = visible[i].getBoundingClientRect();
    if (y < rect.top + rect.height / 2) return i;
  }
  return visible.length;
}

function computeGroupInsertIndex(container: HTMLElement, y: number, excludeGroup: string): number {
  const sections = groupSectionItems(container, excludeGroup);
  for (let i = 0; i < sections.length; i++) {
    const rect = sections[i].getBoundingClientRect();
    if (y < rect.top + rect.height / 2) return i;
  }
  return sections.length;
}

function applyEventShift(
  container: HTMLElement,
  draggedId: string,
  insertIndex: number,
  gap: number,
  sourceContainer: HTMLElement | null
): void {
  const items = eventItems(container);
  const fromIndex = sourceContainer === container ? items.findIndex((el) => el.dataset.eventId === draggedId) : -1;

  items.forEach((item, i) => {
    if (item.dataset.eventId === draggedId) {
      markShift(item, "0.15");
      setTransform(item, "");
      return;
    }

    markShift(item, "");

    if (fromIndex >= 0) {
      let ty = 0;
      const toIndex = insertIndex < fromIndex ? insertIndex : insertIndex + 1;
      if (fromIndex < toIndex) {
        if (i > fromIndex && i < toIndex) ty = -gap;
      } else if (fromIndex > toIndex) {
        if (i >= toIndex && i < fromIndex) ty = gap;
      }
      setTransform(item, ty ? `translate3d(0,${ty}px,0)` : "");
    } else {
      const visibleIndex = visibleEventItems(container, draggedId).indexOf(item);
      setTransform(item, visibleIndex >= insertIndex ? `translate3d(0,${gap}px,0)` : "");
    }
  });
}

function applyGroupShift(
  container: HTMLElement,
  draggedGroup: string,
  insertIndex: number,
  gap: number
): void {
  const sections = [...container.querySelectorAll<HTMLElement>("[data-group-section]")];
  const fromIndex = sections.findIndex((el) => el.dataset.groupSection === draggedGroup);

  sections.forEach((section, i) => {
    if (section.dataset.groupSection === draggedGroup) {
      markShift(section, "0.15");
      setTransform(section, "");
      return;
    }

    markShift(section, "");
    if (fromIndex < 0) return;

    let ty = 0;
    const toIndex = insertIndex < fromIndex ? insertIndex : insertIndex + 1;
    if (fromIndex < toIndex) {
      if (i > fromIndex && i < toIndex) ty = -gap;
    } else if (fromIndex > toIndex) {
      if (i >= toIndex && i < fromIndex) ty = gap;
    }
    setTransform(section, ty ? `translate3d(0,${ty}px,0)` : "");
  });
}

function resolveEventDrop(
  container: HTMLElement,
  draggedId: string,
  insertIndex: number
): { type: "reorder"; targetId: string; before: boolean } | { type: "togroup"; group: EventGroup } | null {
  const visible = visibleEventItems(container, draggedId);
  if (visible.length === 0 && container.matches("[data-group-body]") && container.dataset.groupBody) {
    return { type: "togroup", group: container.dataset.groupBody };
  }

  if (insertIndex < visible.length) {
    return { type: "reorder", targetId: visible[insertIndex].dataset.eventId!, before: true };
  }

  if (visible.length > 0) {
    return {
      type: "reorder",
      targetId: visible[visible.length - 1].dataset.eventId!,
      before: false,
    };
  }

  if (container.matches("[data-group-body]") && container.dataset.groupBody) {
    return { type: "togroup", group: container.dataset.groupBody };
  }

  return null;
}

function resolveGroupDrop(
  container: HTMLElement,
  draggedGroup: string,
  insertIndex: number
): { targetGroup: EventGroup; before: boolean } | null {
  const sections = groupSectionItems(container, draggedGroup);
  if (insertIndex < sections.length) {
    return { targetGroup: sections[insertIndex].dataset.groupSection!, before: true };
  }
  if (sections.length > 0) {
    return {
      targetGroup: sections[sections.length - 1].dataset.groupSection!,
      before: false,
    };
  }
  return null;
}

/** 指针拖拽：rAF 节流 + 轻量 ghost + transform 让位 */
export function attachPointerDrag(root: HTMLElement, handlers: PointerDragHandlers): () => void {
  let active: ActiveDrag | null = null;
  let rafId = 0;
  let pendingX = 0;
  let pendingY = 0;

  const cleanup = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (!active) return;
    active.ghost?.remove();
    active.el.removeClass("jnr-drag-source");
    clearShiftStyles(root);
    root.removeClass("jnr-is-dragging");
    active = null;
  };

  const processMove = () => {
    rafId = 0;
    if (!active?.moved || !active.ghost) return;

    const { ghost, id, kind } = active;
    ghost.style.left = `${pendingX - ghost.offsetWidth / 2}px`;
    ghost.style.top = `${pendingY - 18}px`;

    if (kind === "event") {
      const container = findEventDropContainer(root, pendingX, pendingY);
      if (!container) return;
      const insertIndex = computeEventInsertIndex(container, pendingY, id);
      if (active.layoutContainer !== container || active.insertIndex !== insertIndex) {
        if (active.layoutContainer && active.layoutContainer !== container) {
          clearShiftStyles(root);
        }
        active.layoutContainer = container;
        active.insertIndex = insertIndex;
        applyEventShift(container, id, insertIndex, active.gap, active.sourceContainer);
      }
    } else {
      const container = findGroupListContainer(root, pendingX, pendingY);
      if (!container) return;
      const insertIndex = computeGroupInsertIndex(container, pendingY, id);
      if (active.layoutContainer !== container || active.insertIndex !== insertIndex) {
        if (active.layoutContainer && active.layoutContainer !== container) {
          clearShiftStyles(root);
        }
        active.layoutContainer = container;
        active.insertIndex = insertIndex;
        applyGroupShift(container, id, insertIndex, active.gap);
      }
    }
  };

  const scheduleMove = (x: number, y: number) => {
    pendingX = x;
    pendingY = y;
    if (rafId) return;
    rafId = requestAnimationFrame(processMove);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || isInteractiveTarget(e.target)) return;

    const hit = e.target instanceof HTMLElement ? e.target : null;
    if (!hit) return;

    // 「N 天内」区块固定置顶，不参与任何拖动
    if (hit.closest(".jnr-group-soon")) return;

    const target = hit.closest<HTMLElement>("[data-drag-kind]");
    if (!target || !root.contains(target)) return;

    const kind = target.dataset.dragKind as "event" | "group" | undefined;
    const id =
      kind === "event" ? target.dataset.eventId : kind === "group" ? target.dataset.group : undefined;
    if (!kind || !id) return;

    const sectionEl = kind === "group" ? target.closest<HTMLElement>("[data-group-section]") : null;
    const dragEl = kind === "group" && sectionEl ? sectionEl : target;
    const gapEl = kind === "group" && sectionEl ? sectionEl : target;

    active = {
      kind,
      id,
      el: dragEl,
      pointerTarget: target,
      sectionEl,
      ghost: null,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      startedOnTitle: kind === "group" && !!hit.closest(".jnr-group-title-btn"),
      moveThreshold: getMoveThreshold(kind),
      pointerId: e.pointerId,
      gap: outerHeight(gapEl),
      sourceContainer: null,
      layoutContainer: null,
      insertIndex: -1,
    };

    safeSetPointerCapture(target, e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!active || e.pointerId !== active.pointerId) return;

    const dx = e.clientX - active.startX;
    const dy = e.clientY - active.startY;

    if (!active.moved) {
      if (Math.hypot(dx, dy) < active.moveThreshold) return;
      active.moved = true;
      e.preventDefault();
      active.ghost = createLightGhost(active.el);
      document.body.appendChild(active.ghost);
      root.addClass("jnr-is-dragging");

      if (active.kind === "event") {
        active.sourceContainer =
          active.el.closest<HTMLElement>("[data-group-body], .jnr-manage-list, .jnr-group-soon") ??
          active.el.parentElement;
      }
    } else {
      e.preventDefault();
    }

    scheduleMove(e.clientX, e.clientY);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!active || e.pointerId !== active.pointerId) return;

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      processMove();
    }

    const { kind, id, moved, el, pointerTarget, layoutContainer, insertIndex, startedOnTitle } =
      active;

    if (moved && layoutContainer && insertIndex >= 0) {
      if (kind === "event") {
        const drop = resolveEventDrop(layoutContainer, id, insertIndex);
        if (drop?.type === "reorder") {
          handlers.onEventReorder(id, drop.targetId, drop.before);
        } else if (drop?.type === "togroup") {
          handlers.onEventToGroup(id, drop.group);
        }
      } else if (kind === "group") {
        const drop = resolveGroupDrop(layoutContainer, id, insertIndex);
        if (drop) {
          handlers.onGroupReorder(id, drop.targetGroup, drop.before);
        }
      }
    } else if (!moved) {
      if (kind === "event") {
        el.dispatchEvent(new CustomEvent("jnr-card-click", { bubbles: true }));
      } else if (kind === "group" && startedOnTitle) {
        pointerTarget.dispatchEvent(new CustomEvent("jnr-group-click", { bubbles: true }));
      }
    }

    safeReleasePointerCapture(pointerTarget, e.pointerId);
    cleanup();
  };

  const onPointerCancel = (e: PointerEvent) => {
    if (!active || e.pointerId !== active.pointerId) return;
    safeReleasePointerCapture(active.pointerTarget, e.pointerId);
    cleanup();
  };

  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointermove", onPointerMove);
  root.addEventListener("pointerup", onPointerUp);
  root.addEventListener("pointercancel", onPointerCancel);

  return () => {
    root.removeEventListener("pointerdown", onPointerDown);
    root.removeEventListener("pointermove", onPointerMove);
    root.removeEventListener("pointerup", onPointerUp);
    root.removeEventListener("pointercancel", onPointerCancel);
    cleanup();
  };
}
