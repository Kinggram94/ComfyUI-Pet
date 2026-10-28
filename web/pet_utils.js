export function clampPercent(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

export function usageLevel(value) {
  const p = clampPercent(value);
  if (p === null) return "";
  if (p >= 95) return "crit";
  if (p >= 85) return "high";
  return "";
}

export function formatGB(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "0.0";
  return (n / 1024 ** 3).toFixed(1);
}

export function placePopover(anchor, size, viewport, gap = 10, margin = 8) {
  const aw = Number(anchor.width) || 0;
  const ah = Number(anchor.height) || 0;
  const ax = Number(anchor.left) || 0;
  const ay = Number(anchor.top) || 0;
  const cx = ax + aw / 2;

  const maxLeft = Math.max(margin, viewport.width - size.width - margin);
  const left = Math.min(Math.max(cx - size.width / 2, margin), maxLeft);

  let top = ay - size.height - gap;
  let below = false;
  if (top < margin) {
    below = true;
    top = ay + ah + gap;
    top = Math.max(margin, Math.min(top, viewport.height - size.height - margin));
  } else if (top + size.height > viewport.height - margin) {
    top = Math.max(margin, viewport.height - size.height - margin);
  }

  const arrowMax = Math.max(16, size.width - 16);
  const arrowX = Math.min(Math.max(cx - left, 16), arrowMax);

  return { left, top, below, arrowX };
}
