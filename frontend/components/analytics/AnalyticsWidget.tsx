"use client";

import { useRouter } from "next/navigation";
import { LucideIcon, Info } from "lucide-react";

interface AnalyticsWidgetProps {
    title: string;
    value?: string | number;
    subValue?: string;
    description?: string;
    icon: LucideIcon;
    href: string;
    theme: "green" | "red" | "blue";
}

export function AnalyticsWidget({
    title,
    value,
    subValue,
    description,
    icon: Icon,
    href,
    theme,
}: AnalyticsWidgetProps) {
    const router = useRouter();

    // Theme Definitions (Tailwind classes)
    const themes = {
        green: {
            bg: "bg-emerald-500/10",
            text: "text-emerald-500",
            border: "group-hover:border-emerald-500/50",
        },
        red: {
            bg: "bg-rose-500/10",
            text: "text-rose-500",
            border: "group-hover:border-rose-500/50",
        },
        blue: {
            bg: "bg-blue-500/10",
            text: "text-blue-500",
            border: "group-hover:border-blue-500/50",
        }
    };

    const currentTheme = themes[theme];

    return (
        <div
            onClick={() => router.push(href)}
            className="block w-full h-full group cursor-pointer"
        >
            <div className={`relative h-[185px] p-5 rounded-2xl bg-[#121212] border border-[#27272A] transition-all duration-300 ${currentTheme.border} hover:bg-[#18181B] overflow-hidden flex flex-col justify-between`}>

                {/* Header */}
                <div className="flex justify-between items-start z-10 relative">
                    <div className={`p-2.5 rounded-xl ${currentTheme.bg}`}>
                        <Icon className={`w-5 h-5 ${currentTheme.text}`} />
                    </div>
                    {/* Interaction Indicator: Always visible but subtle, individual hover effect */}
                    <div className={`
                        p-1.5 rounded-full border border-[#27272A] bg-[#1A1A1E] transition-all duration-300 
                        group-hover:border-current group-hover:bg-opacity-100 
                        hover:scale-110 hover:bg-[#27272A]
                        ${theme === 'green' ? 'group-hover:text-emerald-500 hover:shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
                            theme === 'red' ? 'group-hover:text-rose-500 hover:shadow-[0_0_10px_rgba(244,63,94,0.3)]' :
                                'group-hover:text-blue-500 hover:shadow-[0_0_10px_rgba(59,130,246,0.3)]'}
                    `}>
                        <Info className={`w-3.5 h-3.5 transition-all duration-300 ${currentTheme.text} opacity-40 group-hover:opacity-80 hover:opacity-100`} />
                    </div>
                </div>

                {/* Content */}
                <div className="z-10 relative">
                    <h3 className="text-sm font-medium text-[#E4E4E5] mb-2">{title}</h3>
                    <div className="flex flex-col">
                        {value && value !== "--" && (
                            <span className="text-3xl font-bold text-white tracking-tight mb-2">{value}</span>
                        )}
                        {description && (
                            <p className="text-[11px] text-[#A1A1AA] leading-normal mb-3 min-h-[32px]">
                                {description}
                            </p>
                        )}
                        <span className="text-[10px] text-[#52525B] font-bold uppercase tracking-wider mt-auto">{subValue}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
