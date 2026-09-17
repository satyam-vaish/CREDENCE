import Lenis from "lenis";
import { useEffect } from "react";
import Cursor from "./components/Cursor";
import GlossaryDrawer from "./components/GlossaryDrawer";
import GridBackground from "./components/GridBackground";
import MockModeHUD from "./components/MockModeHUD";
import Navbar from "./components/Navbar";
import Drift from "./sections/Drift";
import Footer from "./sections/Footer";
import Hero from "./sections/Hero";
import Objective from "./sections/Objective";
import Pipeline from "./sections/Pipeline";
import Playground from "./sections/Playground";
import Quiz from "./sections/Quiz";
import Solutions from "./sections/Solutions";
import { useEvents } from "./hooks";
import { REDUCED } from "./lib";

export default function App() {
  useEvents();

  useEffect(() => {
    if (REDUCED) return;
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.5,
    });
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="grain vignette relative min-h-screen bg-ink">
      <GridBackground />
      <Cursor />
      <Navbar />
      <GlossaryDrawer />
      <MockModeHUD />
      <main className="relative z-10">
        <Hero />
        <div className="mx-auto h-px max-w-7xl bg-line" />
        <Objective />
        <div className="mx-auto h-px max-w-7xl bg-line" />
        <Playground />
        <div className="mx-auto h-px max-w-7xl bg-line" />
        <Pipeline />
        <div className="mx-auto h-px max-w-7xl bg-line" />
        <Drift />
        <div className="mx-auto h-px max-w-7xl bg-line" />
        <Quiz />
        <div className="mx-auto h-px max-w-7xl bg-line" />
        <Solutions />
        <Footer />
      </main>
    </div>
  );
}
