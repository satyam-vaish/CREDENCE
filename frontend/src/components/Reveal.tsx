import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useInView } from "../hooks";
import { REDUCED } from "../lib";

export default function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const [ref, inView] = useInView<HTMLDivElement>(0.06);
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={REDUCED ? {} : { opacity: 0, y: 22 }}
      animate={inView || REDUCED ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.65,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      style={{ willChange: inView ? "auto" : "opacity, transform" }}
    >
      {children}
    </motion.div>
  );
}
