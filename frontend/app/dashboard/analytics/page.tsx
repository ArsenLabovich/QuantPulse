"use client";

import { AnalyticsGrid } from "@/components/analytics/AnalyticsGrid";

export default function AnalyticsPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">Quant Analytics</h1>
                <p className="text-[13px] text-[#71717A] max-w-2xl leading-relaxed">
                    Institutional-grade risk metrics derived from <span className="text-[#A1A1AA] font-medium">portfolio backtesting</span> and statistical modeling.
                </p>
            </div>

            <AnalyticsGrid />
        </div>
    );
}
