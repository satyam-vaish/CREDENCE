import { useEffect, useRef, useState } from "react";
import Blob, { DEFAULT_VALUES } from "../components/Blob";
import GlyphField from "../components/GlyphField";

export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const [values, setValues] = useState<number[]>(DEFAULT_VALUES);

  // entrance choreography: masked headline lines, then staggered fades
  useEffect(() => {
    const el = root.current!;
    const lines = el.querySelectorAll<HTMLElement>(".mask-line > span");
    lines.forEach((l, i) => {
      l.style.transition = "transform 0.9s cubic-bezier(0.16,1,0.3,1)";
      setTimeout(() => { l.style.transform = "translateY(0)"; }, 250 + i * 120);
    });
    const fades = el.querySelectorAll<HTMLElement>("[data-hero-fade]");
    fades.forEach((f, i) => {
      f.style.opacity = "0";
      f.style.transform = "translateY(14px)";
      f.style.transition = "opacity 0.8s ease, transform 0.8s ease";
      setTimeout(() => { f.style.opacity = "1"; f.style.transform = "none"; }, 550 + i * 110);
    });
  }, []);

  return (
    <section id="top" ref={root} className="relative mx-auto max-w-7xl px-6 pt-36 pb-24 lg:pt-44">
      <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <div data-hero-fade
            className="inline-flex items-center gap-2.5 rounded-full border border-line px-4 py-2">
            <span className="pulse-dot h-2 w-2 rounded-full bg-lime" />
            <span className="mono-label text-paper/80">LIVE · INTERACTIVE · CREDIT RISK</span>
          </div>

          <h1 className="headline mt-7 text-paper" style={{ fontSize: "clamp(56px, 8vw, 128px)" }}>
            <span className="mask-line"><span>Credit risk,</span></span>
            <span className="mask-line"><span className="shimmer-once font-serifit italic pr-2">made tangible.</span></span>
          </h1>

          <p data-hero-fade className="mt-8 max-w-[560px] text-[19px] leading-relaxed text-muted">
            Pull a vertex. Bend the curve. Watch the default probability answer back
            in real time. CREDENCE is a handcrafted field guide to the features,
            models, and drift that quietly decide who gets a loan.
          </p>

          <div data-hero-fade className="mt-9 flex flex-wrap gap-4">
            <a href="#playground" data-cursor="OPEN"
              className="group rounded-2xl bg-lime px-6 py-3.5 font-medium text-ink transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(217,255,63,0.35)]">
              Open the playground
              <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">→</span>
            </a>
            <a href="#solutions" data-cursor="VIEW"
              className="rounded-2xl border border-paper/25 px-6 py-3.5 text-paper transition-all duration-200 hover:border-lime hover:bg-lime/[0.06]">
              See a worked solution
            </a>
          </div>
        </div>

        <div data-hero-fade className="relative h-[420px] md:h-[520px]" data-cursor="DRAG">
          <GlyphField />
          <Blob
            values={values}
            onChange={(i, v) => setValues((vs) => { const n = [...vs]; n[i] = v; return n; })}
          />
        </div>
      </div>
    </section>
  );
}
