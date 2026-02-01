import { TrendingUp, TrendingDown } from "lucide-react";
import { HoldingItem } from "@/types/dashboard";

interface MoversProps {
    gainer?: HoldingItem | null;
    loser?: HoldingItem | null;
}

export function MoversWidget({ gainer, loser }: MoversProps) {
    if (!gainer && !loser) return null;

    const isGainerNeutral = gainer && Math.abs(gainer.change_24h || 0) < 0.005;
    const isLoserNeutral = loser && Math.abs(loser.change_24h || 0) < 0.005;

    return (
        <div className="flex flex-col sm:flex-row justify-between gap-6 mb-8">
            {gainer ? (
                <div className="flex-1 bg-[#1E222D] rounded-xl p-5 border border-[#2A2E39] hover:bg-[#1E222D]/80 transition-colors shadow-lg shadow-green-900/5">
                    <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                            <div className="w-12 h-12 rounded-full bg-[#131722] flex items-center justify-center text-sm font-bold text-gray-400 overflow-hidden ring-1 ring-white/10">
                                {gainer.icon_url ? (
                                    <img
                                        src={gainer.icon_url}
                                        alt={gainer.symbol}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.parentElement?.querySelector('span')?.classList.remove('hidden');
                                        }}
                                    />
                                ) : null}
                                <span className={gainer.icon_url ? "hidden" : "block"}>{gainer.symbol[0]}</span>
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-[#131722] rounded-full p-1 ring-2 ring-[#1E222D] z-10">
                                <TrendingUp className={`w-3 h-3 ${isGainerNeutral ? "text-gray-500" : "text-[#00C805]"}`} />
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-white text-lg truncate">{gainer.symbol}</span>
                                <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${isGainerNeutral ? "text-gray-500 bg-white/5" : "text-[#00C805] bg-[#00C805]/10"}`}>
                                    +{gainer.change_24h?.toFixed(2)}%
                                </span>
                            </div>
                            <div className="text-xs text-gray-500 font-medium tracking-wide uppercase">Top Gainer</div>
                        </div>
                    </div>
                </div>
            ) : <div className="flex-1" />}

            {loser && (
                <div className="flex-1 bg-[#1E222D] rounded-xl p-5 border border-[#2A2E39] hover:bg-[#1E222D]/80 transition-colors shadow-lg shadow-red-900/5">
                    <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                            <div className="w-12 h-12 rounded-full bg-[#131722] flex items-center justify-center text-sm font-bold text-gray-400 overflow-hidden ring-1 ring-white/10">
                                {loser.icon_url ? (
                                    <img
                                        src={loser.icon_url}
                                        alt={loser.symbol}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.parentElement?.querySelector('span')?.classList.remove('hidden');
                                        }}
                                    />
                                ) : null}
                                <span className={loser.icon_url ? "hidden" : "block"}>{loser.symbol[0]}</span>
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-[#131722] rounded-full p-1 ring-2 ring-[#1E222D] z-10">
                                <TrendingDown className={`w-3 h-3 ${isLoserNeutral ? "text-gray-500" : "text-[#FF3B30]"}`} />
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-white text-lg truncate">{loser.symbol}</span>
                                <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${isLoserNeutral ? "text-gray-500 bg-white/5" : "text-[#FF3B30] bg-[#FF3B30]/10"}`}>
                                    {loser.change_24h?.toFixed(2)}%
                                </span>
                            </div>
                            <div className="text-xs text-gray-500 font-medium tracking-wide uppercase">Top Loser</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
