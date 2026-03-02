import { memo } from "react";
import { VolatilityResult } from "@/types/dashboard";
import { Activity, Zap, Database, AlertTriangle, Info, TrendingDown } from "lucide-react";
import { CustomTooltip } from "@/components/ui/CustomTooltip";

interface VolatilityStatsProps {
    result: VolatilityResult | null;
    isLoading: boolean;
    totalValue?: number;
}

export const VolatilityStats = memo(function VolatilityStats({ result, isLoading, totalValue }: VolatilityStatsProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-5 h-24 animate-pulse" />
                ))}
            </div>
        );
    }

    if (!result) {
        return (
            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-8 text-center text-gray-400">
                <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-gray-300">No Data Calculated</h3>
                <p className="text-gray-500 text-sm mt-1">Select assets and click Apply to see volatility metrics.</p>
            </div>
        );
    }

    const { portfolio } = result;
    
    // Value at Risk Calculation (95% confidence level, approx 1.645 standard deviations)
    const var95 = portfolio.daily_vol && totalValue ? totalValue * portfolio.daily_vol * 1.645 : null;

    const cards = [
        {
            label: "Annualized Risk",
            value: portfolio.display_value,
            subtext: "Expected Yearly Swing",
            tooltip: "Expected price fluctuation over a year based on historical price movement.",
            icon: Activity,
            color: "text-[#3978FF]",
            bg: "bg-[#3978FF]/10",
        },
        {
            label: "Avg. Daily Swing",
            value: portfolio.daily_vol ? `${(portfolio.daily_vol * 100).toFixed(2)}%` : "--",
            subtext: "Daily Volatility",
            tooltip: "Expected daily price fluctuation of your portfolio.",
            icon: Zap,
            color: "text-[#FF9500]",
            bg: "bg-[#FF9500]/10",
        },
        {
            label: "Daily VaR (95%)",
            value: var95 ? `$${var95.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "--",
            subtext: "Est. Maximum Local Loss",
            tooltip: "Value at Risk (95%): There is a 95% probability that the daily loss will not exceed this amount. This figure reflects the high volatility inherent in crypto assets (~5-10x higher than traditional stocks).",
            icon: TrendingDown,
            color: "text-[#FF3B30]",
            bg: "bg-[#FF3B30]/10",
        },
        {
            label: "Trading Days",
            value: portfolio.data_points,
            subtext: "Volume of History",
            tooltip: "The number of trading days used to calculate the volatility metrics.",
            icon: Database,
            color: "text-[#00C805]",
            bg: "bg-[#00C805]/10",
        },
        {
            label: "Excluded Assets",
            value: portfolio.alignment_loss,
            subtext: "Missing 1Y History",
            tooltip: "Assets excluded because they have less than 1 year of price history. This ensures calculation accuracy.",
            icon: AlertTriangle,
            color: portfolio.alignment_loss > 0 ? "text-[#FF3B30]" : "text-gray-400",
            bg: portfolio.alignment_loss > 0 ? "bg-[#FF3B30]/10" : "bg-gray-500/10",
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {cards.map((card) => (
                <div key={card.label} className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-5 flex items-center gap-4 hover:border-primary/30 transition-colors group relative">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.bg} ${card.color} shrink-0`}>
                        <card.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider truncate">{card.label}</div>
                            <CustomTooltip content={card.tooltip}>
                                <div className="text-gray-600 hover:text-gray-400 transition-colors">
                                    <Info className="w-3.5 h-3.5" />
                                </div>
                            </CustomTooltip>
                        </div>
                        <div className="text-2xl font-bold text-white tabular-nums truncate">{card.value}</div>
                        <div className="flex items-center justify-between">
                            <div className="text-[10px] text-gray-500 font-medium truncate">{card.subtext}</div>
                            {card.label === "Annualized Risk" && portfolio.confidence && (
                                <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                    portfolio.confidence === "high" ? "bg-[#00C805]/10 text-[#00C805]" :
                                    portfolio.confidence === "moderate" ? "bg-[#FF9500]/10 text-[#FF9500]" :
                                    "bg-[#FF3B30]/10 text-[#FF3B30]"
                                }`}>
                                    {portfolio.confidence.toUpperCase()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
});

