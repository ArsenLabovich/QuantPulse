"use client";

import { Construction, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

interface ComingSoonProps {
    title?: string;
    message?: string;
}

export function ComingSoon({
    title = "Coming Soon",
    message = "This module is currently under development. Stay tuned for updates."
}: ComingSoonProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="bg-[#1E222D] border border-[#2A2E39] p-12 rounded-3xl shadow-2xl max-w-lg w-full flex flex-col items-center"
            >
                <div className="w-20 h-20 bg-[#2A2E39] rounded-full flex items-center justify-center mb-6">
                    <Construction className="w-10 h-10 text-[#3978FF]/80" />
                </div>

                <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">{title}</h2>
                <p className="text-[#B2B5BE] mb-8 leading-relaxed font-light">
                    {message}
                </p>

                <Link
                    href="/dashboard"
                    className="flex items-center gap-2 px-6 py-3 bg-[#3978FF] hover:bg-blue-600 text-white rounded-xl transition-all font-medium active:scale-95"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </Link>
            </motion.div>
        </div>
    );
}
