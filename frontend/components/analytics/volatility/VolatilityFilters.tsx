import { memo } from "react";
import { VolatilityFilterState } from "@/types/dashboard";
import { Search, Layers, Bitcoin, TrendingUp, Filter } from "lucide-react";

interface VolatilityFiltersProps {
    state: VolatilityFilterState;
    onChange: (state: VolatilityFilterState) => void;
    providers: string[];
}

export const VolatilityFilters = memo(function VolatilityFilters({ state, onChange, providers }: VolatilityFiltersProps) {
    return (
        <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative group w-60">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#3978FF] transition-colors">
                    <Search className="w-4 h-4" />
                </div>
                <input
                    type="text"
                    placeholder="Search assets..."
                    className="w-full bg-[#131722] border border-[#2A2E39] rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-[#3978FF]/20 focus:border-[#3978FF] outline-none transition-all placeholder:text-gray-600"
                    value={state.search}
                    onChange={(e) => onChange({ ...state, search: e.target.value })}
                />
            </div>

            {/* Provider Filter */}
            <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#3978FF] transition-colors">
                    <Filter className="w-4 h-4" />
                </div>
                <select
                    className="appearance-none bg-[#131722] border border-[#2A2E39] rounded-xl pl-9 pr-8 py-2 text-sm text-white focus:ring-2 focus:ring-[#3978FF]/20 focus:border-[#3978FF] outline-none transition-all cursor-pointer"
                    value={state.provider}
                    onChange={(e) => onChange({ ...state, provider: e.target.value })}
                >
                    <option value="all">All Sources</option>
                    {providers.map(p => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
            </div>

            {/* Asset Type Toggle */}
            <div className="flex bg-[#131722] p-1 rounded-xl border border-[#2A2E39]">
                {[
                    { id: "all", label: "All", icon: Layers },
                    { id: "crypto", label: "Crypto", icon: Bitcoin },
                    { id: "stock", label: "Stocks", icon: TrendingUp },
                ].map((type) => (
                    <button
                        key={type.id}
                        onClick={() => onChange({ ...state, assetType: type.id as "all" | "crypto" | "stock" })}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${state.assetType === type.id
                            ? "bg-[#3978FF] text-white shadow-lg shadow-[#3978FF]/20"
                            : "text-gray-400 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        <type.icon className="w-3 h-3" />
                        {type.label}
                    </button>
                ))}
            </div>
        </div>
    );
});
