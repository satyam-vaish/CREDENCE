export default function Footer() {
  return (
    <footer className="border-t border-line bg-ink/50 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 py-24 text-center">
        <h2 className="headline text-paper" style={{ fontSize: "clamp(48px, 6vw, 96px)" }}>
          Risk,{" "}
          <span className="grad-text font-serifit italic">made tangible.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted">
          An end-to-end production credit risk engine. Time-based splits, cost-optimal thresholds,
          live PSI drift monitoring, and TreeSHAP explainability.
        </p>

        {/* Primary Featured GitHub Button */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4">
          <a
            href="https://github.com/satyam-vaish"
            target="_blank"
            rel="noreferrer"
            data-cursor="GITHUB"
            className="group relative inline-flex items-center gap-3.5 rounded-2xl border border-lime/50 bg-surface/80 px-8 py-4 text-paper shadow-[0_0_30px_rgba(217,255,63,0.15)] transition-all duration-300 hover:scale-105 hover:border-lime hover:bg-surface hover:shadow-[0_0_40px_rgba(217,255,63,0.35)]"
          >
            {/* GitHub Octocat Icon */}
            <svg
              className="h-6 w-6 fill-current text-lime transition-transform group-hover:rotate-12 duration-200"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <div className="flex flex-col text-left">
              <span className="font-mono text-xs font-semibold tracking-wider text-lime uppercase">
                GitHub Profile
              </span>
              <span className="font-display text-base font-bold text-paper">
                github.com/satyam-vaish
              </span>
            </div>
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-1 text-lime font-mono">
              →
            </span>
          </a>
        </div>

        <p className="mono-label mt-12 text-[10px]">
          CREDENCE · HANDCRAFTED BY SATYAM VAISH · PYTHON · LIGHTGBM · FASTAPI · REACT
        </p>
      </div>
    </footer>
  );
}
