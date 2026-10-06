"use client";

import { useCallback, useLayoutEffect, useState, useSyncExternalStore, type RefObject } from "react";

export type Side = "top" | "bottom" | "left" | "right";
export type Align = "start" | "center" | "end";

export interface FloatingPosition {
  top: number;
  left: number;
  side: Side;
}

const GAP = 6;
const VIEWPORT_PADDING = 8;

/** Compute a fixed position for `floating` next to `anchor`, flipping when there is not enough room. */
export function computePosition(
  anchor: DOMRect,
  floating: { width: number; height: number },
  side: Side,
  align: Align,
  gap = GAP,
): FloatingPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let resolved = side;

  if (side === "bottom" && anchor.bottom + gap + floating.height > vh - VIEWPORT_PADDING && anchor.top - gap - floating.height > VIEWPORT_PADDING) resolved = "top";
  else if (side === "top" && anchor.top - gap - floating.height < VIEWPORT_PADDING && anchor.bottom + gap + floating.height < vh - VIEWPORT_PADDING) resolved = "bottom";
  else if (side === "right" && anchor.right + gap + floating.width > vw - VIEWPORT_PADDING) resolved = "left";
  else if (side === "left" && anchor.left - gap - floating.width < VIEWPORT_PADDING) resolved = "right";

  let top = 0;
  let left = 0;
  if (resolved === "top" || resolved === "bottom") {
    top = resolved === "bottom" ? anchor.bottom + gap : anchor.top - gap - floating.height;
    if (align === "start") left = anchor.left;
    else if (align === "end") left = anchor.right - floating.width;
    else left = anchor.left + anchor.width / 2 - floating.width / 2;
  } else {
    left = resolved === "right" ? anchor.right + gap : anchor.left - gap - floating.width;
    if (align === "start") top = anchor.top;
    else if (align === "end") top = anchor.bottom - floating.height;
    else top = anchor.top + anchor.height / 2 - floating.height / 2;
  }

  left = Math.min(Math.max(VIEWPORT_PADDING, left), vw - floating.width - VIEWPORT_PADDING);
  top = Math.min(Math.max(VIEWPORT_PADDING, top), vh - floating.height - VIEWPORT_PADDING);
  return { top, left, side: resolved };
}

/**
 * Keeps a floating element positioned relative to an anchor while `open`.
 * Re-positions on scroll / resize.
 */
export function useFloating(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  floatingRef: RefObject<HTMLElement | null>,
  side: Side,
  align: Align,
  gap?: number,
) {
  const [pos, setPos] = useState<FloatingPosition | null>(null);

  const update = useCallback(() => {
    const a = anchorRef.current;
    const f = floatingRef.current;
    if (!a || !f) return;
    setPos(computePosition(a.getBoundingClientRect(), { width: f.offsetWidth, height: f.offsetHeight }, side, align, gap));
  }, [anchorRef, floatingRef, side, align, gap]);

  useLayoutEffect(() => {
    if (!open) return;
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  return { pos: open ? pos : null, update };
}

const noopSubscribe = () => () => {};
/** True on the client after hydration (safe for portals). */
export function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
