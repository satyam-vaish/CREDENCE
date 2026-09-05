import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Reveal from "../components/Reveal";
import { api, type QuizQ } from "../api";

/** Lime burst: 14 particles fired from the center of the card. */
function Burst() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.span key={i} className="absolute h-1.5 w-1.5 rounded-full bg-lime"
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{
            x: Math.cos((i / 14) * Math.PI * 2) * 70,
            y: Math.sin((i / 14) * Math.PI * 2) * 70,
            opacity: 0,
          }}
          transition={{ duration: 0.7, ease: "easeOut" }} />
      ))}
    </div>
  );
}

export default function Quiz() {
  const [questions, setQuestions] = useState<QuizQ[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [burst, setBurst] = useState(false);

  useEffect(() => { void api.quiz().then((r) => setQuestions(r.questions)); }, []);

  const q = questions[idx];
  const pick = (i: number) => {
    if (picked !== null || !q) return;
    setPicked(i);
    if (i === q.answer) { setScore((s) => s + 1); setBurst(true); setTimeout(() => setBurst(false), 750); }
  };
  const next = () => { setPicked(null); setIdx((i) => Math.min(i + 1, questions.length - 1)); };

  return (
    <section id="quiz" className="mx-auto max-w-7xl px-6 py-28">
      <Reveal>
        <p className="mono-label">04 · QUIZ</p>
        <h2 className="headline mt-3 text-6xl text-paper md:text-7xl">
          Think like a{" "}
          <span className="grad-text font-serifit italic">risk analyst.</span>
        </h2>
        <p className="mt-4 text-muted">Questions generated from the model's own results — live, not canned.</p>
      </Reveal>

      <Reveal className="mx-auto mt-12 max-w-3xl">
        <div className="mb-5 flex items-center justify-between font-mono text-[11px] tracking-widest text-muted">
          <span>QUESTION {idx + 1}/{questions.length || "–"}</span>
          <span className="text-lime">SCORE {score}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <motion.div className="h-full bg-lime"
            animate={{ width: `${questions.length ? ((idx + 1) / questions.length) * 100 : 0}%` }} />
        </div>

        <AnimatePresence mode="wait">
          {q && (
            <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              className="relative mt-6 rounded-card border border-line bg-white/[0.02] p-7">
              {burst && <Burst />}
              <span className="mono-label">{q.tag}</span>
              <h3 className="mt-3 text-2xl text-paper">{q.question}</h3>
              <div className="mt-6 grid gap-3">
                {q.options.map((o, i) => {
                  const isAnswer = i === q.answer;
                  const state = picked === null ? "idle"
                    : isAnswer ? "correct" : picked === i ? "wrong" : "dim";
                  return (
                    <button key={o} onClick={() => pick(i)} data-cursor="OPEN"
                      className={`rounded-xl border px-4 py-3 text-left transition-all ${
                        state === "correct" ? "border-lime bg-lime/10 text-lime"
                        : state === "wrong" ? "border-ember bg-ember/10 text-ember"
                        : state === "dim" ? "border-line text-muted opacity-50"
                        : "border-line text-paper hover:border-lime/50"}`}>
                      <span className="mr-3 font-mono text-[10px] text-muted">{"ABCD"[i]}</span>{o}
                    </button>
                  );
                })}
              </div>
              {picked !== null && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  className="mt-5 rounded-xl border border-line bg-ink/60 p-4">
                  <p className="font-mono text-[12px] leading-relaxed text-muted">{q.explanation}</p>
                  {idx < questions.length - 1 && (
                    <button onClick={next} data-cursor="OPEN"
                      className="mt-4 rounded-xl bg-lime px-5 py-2 text-sm font-medium text-ink">
                      Next →
                    </button>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Reveal>
    </section>
  );
}
