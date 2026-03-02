import { Info } from "lucide-react";
import { IntervalPreset } from "@/types/dashboard";

interface IntervalSelectorProps {
    value: IntervalPreset;
    onChange: (interval: IntervalPreset) => void;
}

const PRESETS: IntervalPreset[] = [
    { label: "1W", value: "1w", days: 7 },
    { label: "1M", value: "1m", days: 30 },
    { label: "3M", value: "3m", days: 90 },
    { label: "1Y", value: "1y", days: 365 },
];

export function IntervalSelector({ value, onChange }: IntervalSelectorProps) {
    return (
        <div className="flex flex-col gap-1.5 items-end">
            <div
                className="flex items-center gap-2 group transition-colors select-none"
            >
                <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest group-hover:text-gray-300">
                    Calculation Window
                </span>
                <Info className="w-3.5 h-3.5 text-gray-600 group-hover:text-[#3978FF] transition-all" />
            </div>

            <div className="flex bg-[#131722] p-1 rounded-xl border border-[#2A2E39] shadow-inner">
                {PRESETS.map((preset) => (
                    <button
                        key={preset.value}
                        onClick={() => onChange(preset)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${value.value === preset.value
                            ? "bg-[#3978FF] text-white shadow-lg shadow-[#3978FF]/20"
                            : "text-gray-500 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        {preset.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
