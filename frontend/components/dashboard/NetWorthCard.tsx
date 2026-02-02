"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, DollarSign, Wallet } from "lucide-react";

interface NetWorthCardProps {
    totalValue: number;
    dailyChange: number; // percentage
    isLoading?: boolean;
}

export function NetWorthCard({ totalValue, dailyChange, isLoading }: NetWorthCardProps) {
    if (isLoading) {
        return (
            <div className="bg-[#1E222D] rounded-xl p-6 border border-[#2A2E39] h-full flex flex-col justify-center animate-pulse">
                <div className="h-4 w-32 bg-[#2A2E39] rounded mb-4" />
                <div className="h-10 w-48 bg-[#2A2E39] rounded" />
            </div>
        );
    }

    const isPositive = dailyChange >= 0;
    const isZero = Math.abs(dailyChange) < 0.01;

    // Determine color: Gray if ~0%, otherwise Green/Red
    const colorClass = isZero ? "text-gray-400" : (isPositive ? 'text-[#00C805]' : 'text-[#FF3B30]');

    // Determine Icon: No icon (or dash?) if zero, otherwise TrendingUp/Down
    // We can just keep TrendingUp for 0 or hide it? Let's hide icon if 0, or show a neutral dash?
    // User didn't specify icon behavior, just color. I'll keep default arrow or maybe specific logic.
    // Let's stick effectively to "Flat" if zero.

    const formattedValue = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(totalValue);

    return (
        <div className="bg-[#1E222D] rounded-xl p-6 border border-[#2A2E39] h-full relative overflow-hidden">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-[#3978FF]/10 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-[#3978FF]" />
                </div>
                <h3 className="text-[#909399] font-medium">Total Net Worth</h3>
            </div>

            <div className="mt-4">
                <div className="text-4xl font-bold text-white tracking-tight">
                    {formattedValue}
                </div>

                <div className={`flex items-center mt-2 gap-2 text-sm font-medium ${colorClass}`}>
                    {!isZero && (isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />)}
                    {isZero && <span className="text-lg leading-none">~</span>} {/* Tilde or dash for zero? */}
                    <span>{Math.abs(dailyChange).toFixed(2)}%</span>
                    <span className="text-[#5E626B] font-normal">Last 24h</span>
                </div>
            </div>

            {/* Background Texture */}
            <div className="absolute top-0 right-0 p-8 opacity-5">
                <DollarSign className="w-32 h-32" />
            </div>
        </div>
    );
}
