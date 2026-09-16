/** Click feedback only; never invokes, replaces or delays business handlers. */
export function installButtonParticles(doc: Document, win: Window) {
  const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
  const bursts = new Set<() => void>();
  const clear = () => { for (const dispose of [...bursts]) dispose(); };
  const click = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element) || doc.hidden || reduced.matches || event.button !== 0) return;
    const button = target.closest<HTMLButtonElement>("button");
    if (!button || !button.closest(".ui-polish") || button.matches(":disabled") || button.closest('[aria-disabled="true"], [aria-busy="true"], [data-particles="off"]')) return;
    if (typeof Element.prototype.animate !== "function") return;
    // Bound rapid clicking to three bursts (24 short-lived decorative nodes).
    if (bursts.size >= 3) bursts.values().next().value?.();
    const rect = button.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = event.detail === 0 ? rect.left + rect.width / 2 : Math.max(rect.left, Math.min(rect.right, event.clientX));
    const y = event.detail === 0 ? rect.top + rect.height / 2 : Math.max(rect.top, Math.min(rect.bottom, event.clientY));
    const nodes: HTMLElement[] = [];
    const animations: Animation[] = [];
    let timer = 0;
    const dispose = () => {
      win.clearTimeout(timer);
      animations.forEach((animation) => animation.cancel());
      nodes.forEach((node) => node.remove());
      bursts.delete(dispose);
    };
    bursts.add(dispose);
    try {
      for (let i = 0; i < 8; i++) {
        const node = doc.createElement("span");
        node.setAttribute("aria-hidden", "true");
        node.className = "button-click-particle";
        Object.assign(node.style, { position: "fixed", left: `${x}px`, top: `${y}px`, width: i % 2 ? "5px" : "6px", height: i % 2 ? "5px" : "6px", borderRadius: "50%", pointerEvents: "none", zIndex: "2147483647", backgroundColor: i % 2 ? "#20b0b0" : "#e0a020" });
        nodes.push(node);
        doc.body.appendChild(node);
        const angle = (i / 8) * Math.PI * 2;
        const distance = i % 2 ? 40 : 48;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance - 12;
        animations.push(node.animate([
          { transform: "translate(-50%, -50%) scale(0.35)", opacity: 0.95 },
          { transform: `translate(calc(-50% + ${dx * 0.22}px), calc(-50% + ${dy * 0.22}px)) scale(1.15)`, opacity: 0.95, offset: 0.14 },
          { transform: `translate(calc(-50% + ${dx * 0.72}px), calc(-50% + ${dy * 0.72}px)) scale(0.82)`, opacity: 0.6, offset: 0.58 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.1)`, opacity: 0 },
        ], { duration: 1000, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" }));
      }
      timer = win.setTimeout(dispose, 1050);
    } catch { dispose(); } // Decorative failure must never break the click.
  };
  // Capture observes the enabled state before React's handler starts a request.
  doc.addEventListener("click", click, { capture: true, passive: true });
  doc.addEventListener("visibilitychange", clear);
  win.addEventListener("scroll", clear, true);
  reduced.addEventListener("change", clear);
  return () => {
    clear();
    doc.removeEventListener("click", click, true);
    doc.removeEventListener("visibilitychange", clear);
    win.removeEventListener("scroll", clear, true);
    reduced.removeEventListener("change", clear);
  };
}
