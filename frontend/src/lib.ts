export const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function hexLerp(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(",")})`;
}

/** lime -> amber -> ember along risk 0..1 */
export function riskColor(risk: number): string {
  const r = clamp(risk, 0, 1);
  return r < 0.5
    ? hexLerp("#d9ff3f", "#ffb62e", r * 2)
    : hexLerp("#ffb62e", "#ff5a3c", r * 2 - 1);
}

/** mono "scramble" text — settles left to right (utility for label changes). */
export function scramble(target: string, render: (s: string) => void, done?: () => void) {
  if (REDUCED) { render(target); done?.(); return; }
  const glyphs = "PDAPROVJECT0182·%Σσ";
  let frame = 0;
  const total = 14;
  const id = setInterval(() => {
    frame++;
    const settled = Math.floor((frame / total) * target.length);
    render(
      target.slice(0, settled) +
        target.slice(settled).replace(/./g, () => glyphs[Math.floor(Math.random() * glyphs.length)]),
    );
    if (frame >= total) { clearInterval(id); render(target); done?.(); }
  }, 34);
}

export const fmtMoney = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
