import { useEffect, useRef, useState } from "react";
import { toggleGlossary, toggleMockMode, useGlobal } from "../store";

const LINKS = [
  { n: "00", id: "objective", label: "Objective" },
  { n: "01", id: "playground", label: "Playground" },
  { n: "02", id: "pipeline", label: "Pipeline" },
  { n: "03", id: "drift", label: "Drift" },
  { n: "04", id: "quiz", label: "Quiz" },
  { n: "05", id: "solutions", label: "Solutions" },
];

export default function Navbar() {
  const version = useGlobal((s) => s.modelVersion);
  const mock = useGlobal((s) => s.mock);
  const [active, setActive] = useState("");
  const [underline, setUnderline] = useState({ x: 0, w: 0 });
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-40% 0px -55% 0px" },
    );
    LINKS.forEach((l) => {
      const el = document.getElementById(l.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = linkRefs.current[active];
    if (el) setUnderline({ x: el.offsetLeft, w: el.offsetWidth });
  }, [active]);

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const lenis = (window as unknown as { __lenis?: { scrollTo: (t: string, o?: object) => void } }).__lenis;
    if (lenis) lenis.scrollTo(`#${id}`, { offset: -80 });
    else document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-ink/70 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <a href="#top" onClick={go("top")} className="flex items-center gap-3" data-cursor="OPEN">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime shadow-[0_0_15px_rgba(217,255,63,0.3)]">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 15 L12 3" stroke="#0a0c10" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </span>
          <div className="flex flex-col">
            <span className="font-display text-xl tracking-tight text-paper leading-none">CREDENCE</span>
            <span className="font-mono text-[9px] text-lime/80 tracking-widest mt-0.5">CREDIT RISK AI</span>
          </div>
        </a>

        {/* Navigation Links */}
        <div className="relative hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.id}
              ref={(el) => {
                linkRefs.current[l.id] = el;
              }}
              href={`#${l.id}`}
              onClick={go(l.id)}
              className="flex items-baseline gap-1.5 text-[14px] transition-colors hover:text-lime"
              data-cursor="VIEW"
            >
              <span className="font-mono text-[10px] tracking-[0.15em] text-muted">{l.n}</span>
              <span className={active === l.id ? "text-paper font-medium" : "text-paper/70"}>
                {l.label}
              </span>
            </a>
          ))}
          <span
            className="absolute -bottom-[21px] h-[2px] bg-lime transition-all duration-300 shadow-[0_0_8px_#d9ff3f]"
            style={{ left: underline.x, width: underline.w }}
          />
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2.5">
          {/* Classy Mock Mode / Live API Interactive Switch */}
          <button
            onClick={toggleMockMode}
            data-cursor="TOGGLE"
            title={
              mock
                ? "Mock Mode ON: High-Fidelity Client Simulation active (click to toggle Live API)"
                : "Live API ON: Connected to FastAPI backend (click to toggle Mock Mode)"
            }
            className={`group flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs transition-all duration-200 ${
              mock
                ? "border-amber-400/50 bg-amber-400/10 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.2)] hover:border-amber-300 hover:bg-amber-400/20"
                : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:border-emerald-400 hover:bg-emerald-500/20"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {mock ? (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                </>
              ) : (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </>
              )}
            </span>
            <span className="text-[11px] font-semibold">
              {mock ? "MOCK MODE" : `LIVE API v${version || "5"}`}
            </span>
          </button>

          {/* Glossary Pill */}
          <button
            onClick={toggleGlossary}
            className="flex items-center gap-1.5 rounded-full border border-lime/40 bg-lime/10 px-3 py-1 font-mono text-xs text-lime transition-all hover:border-lime hover:bg-lime/20 hover:shadow-[0_0_12px_rgba(217,255,63,0.25)]"
            data-cursor="GLOSSARY"
            title="Credit Terms & Short Forms Guide (hotkey ?)"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-lime text-ink text-[10px] font-bold">
              ?
            </span>
            <span className="hidden sm:inline font-mono text-[11px] font-medium tracking-wide">
              Glossary
            </span>
          </button>

          {/* GitHub User Profile Button */}
          <a
            href="https://github.com/satyam-vaish"
            target="_blank"
            rel="noreferrer"
            className="group hidden sm:flex items-center gap-1.5 rounded-full border border-paper/30 px-3 py-1 text-xs text-paper transition-all hover:border-lime hover:text-lime hover:shadow-[0_0_15px_rgba(217,255,63,0.15)]"
            data-cursor="GITHUB"
            title="Satyam Vaish GitHub Profile"
          >
            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span className="font-mono text-[11px]">@satyam-vaish</span>
          </a>
        </div>
      </nav>
    </header>
  );
}
