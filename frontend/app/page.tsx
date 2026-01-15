"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CosmosBackground } from "@/components/ui/CosmosBackground";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-center">
      <CosmosBackground />

      <div className="z-30 w-full max-w-4xl mx-auto px-6 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="mb-10"
        >

          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white mb-6 drop-shadow-2xl">
            Quant<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Pulse</span>.
          </h1>
          <p className="max-w-xl mx-auto text-xl text-slate-300/80 leading-relaxed font-light">
            Algorithmic precision. Limitless scale.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-6 w-full justify-center items-center backdrop-blur-sm"
        >
          <Link
            href="/login"
            className="group relative px-10 py-4 bg-white/5 hover:bg-white/10 text-white font-medium rounded-full border border-white/10 backdrop-blur-md transition-all hover:scale-105 hover:border-white/20 flex items-center gap-3"
          >
            Access Terminal
            <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>

      <footer className="absolute bottom-6 text-slate-600/30 text-[10px] tracking-[0.2em] uppercase z-30 select-none">
        System Operational
      </footer>

    </main>
  );
}
