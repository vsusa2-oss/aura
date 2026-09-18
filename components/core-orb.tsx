"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function CoreOrb({
  active,
  listening,
  speaking,
}: {
  active: boolean;
  listening: boolean;
  speaking: boolean;
}) {
  const pulse = listening || speaking || active;

  return (
    <div className="relative flex h-48 w-48 items-center justify-center md:h-56 md:w-56">
      <motion.div
        className={cn(
          "absolute inset-0 rounded-full border border-cyan-500/30",
          pulse && "border-cyan-400/60",
        )}
        animate={{
          scale: pulse ? [1, 1.08, 1] : 1,
          opacity: pulse ? [0.35, 0.7, 0.35] : 0.25,
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-4 rounded-full border border-teal-400/20"
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className={cn(
          "relative h-28 w-28 rounded-full md:h-32 md:w-32",
          "bg-[radial-gradient(circle_at_30%_30%,#67e8f9,#0891b2_45%,#042f2e_100%)]",
          "shadow-[0_0_60px_rgba(34,211,238,0.45),inset_0_0_40px_rgba(255,255,255,0.15)]",
        )}
        animate={{
          boxShadow: speaking
            ? [
                "0 0 40px rgba(34,211,238,0.35)",
                "0 0 90px rgba(34,211,238,0.75)",
                "0 0 40px rgba(34,211,238,0.35)",
              ]
            : listening
              ? [
                  "0 0 50px rgba(45,212,191,0.5)",
                  "0 0 70px rgba(45,212,191,0.65)",
                  "0 0 50px rgba(45,212,191,0.5)",
                ]
              : "0 0 60px rgba(34,211,238,0.45)",
        }}
        transition={{ duration: 1.1, repeat: Infinity }}
      >
        <div className="absolute inset-0 overflow-hidden rounded-full opacity-40">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute left-1/2 top-1/2 h-[120%] w-px origin-bottom bg-cyan-200/50"
              style={{ rotate: `${i * 30}deg` }}
              animate={{ scaleY: pulse ? [0.6, 1, 0.6] : 0.5 }}
              transition={{
                duration: 0.8 + i * 0.05,
                repeat: Infinity,
                delay: i * 0.08,
              }}
            />
          ))}
        </div>
      </motion.div>
      <div className="pointer-events-none absolute -bottom-8 text-center font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-300/70">
        {listening ? "Receiving" : speaking ? "Transmitting" : "Standby"}
      </div>
    </div>
  );
}
