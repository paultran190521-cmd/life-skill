"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Presentation only. One delegated pointer listener per grid; no React state. */
export function SpotlightGrid({ children, className }: { children: ReactNode; className: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const grid = root.current;
    if (!grid) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let card: HTMLElement | null = null;
    let rect: DOMRect | null = null;
    let frame = 0;
    let x = 0;
    let y = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      card?.style.removeProperty("--spot-x");
      card?.style.removeProperty("--spot-y");
      card = null;
      rect = null;
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !fine.matches || reduced.matches || document.hidden) { reset(); return; }
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-stat-card]") : null;
      if (!target || !grid.contains(target)) { reset(); return; }
      if (card !== target) {
        reset();
        card = target;
        rect = target.getBoundingClientRect();
      }
      x = event.clientX;
      y = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!card || !rect || !rect.width || !rect.height) return;
        const nx = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
        const ny = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
        card.style.setProperty("--spot-x", `${((0.5 - ny) * 4).toFixed(2)}deg`);
        card.style.setProperty("--spot-y", `${((nx - 0.5) * 4).toFixed(2)}deg`);
      });
    };
    grid.addEventListener("pointermove", move, { passive: true });
    grid.addEventListener("pointerleave", reset);
    grid.addEventListener("pointercancel", reset);
    window.addEventListener("scroll", reset, true);
    window.addEventListener("resize", reset);
    document.addEventListener("visibilitychange", reset);
    fine.addEventListener("change", reset);
    reduced.addEventListener("change", reset);
    return () => {
      reset();
      grid.removeEventListener("pointermove", move);
      grid.removeEventListener("pointerleave", reset);
      grid.removeEventListener("pointercancel", reset);
      window.removeEventListener("scroll", reset, true);
      window.removeEventListener("resize", reset);
      document.removeEventListener("visibilitychange", reset);
      fine.removeEventListener("change", reset);
      reduced.removeEventListener("change", reset);
    };
  }, []);
  return <div ref={root} className={`spotlight-grid ${className}`}>{children}</div>;
}
