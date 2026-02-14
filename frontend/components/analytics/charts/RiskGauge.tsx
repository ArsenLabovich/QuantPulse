"use client";

interface GaugeProps {
    value: number; // 0 to 100
    label?: string;
    sublabel?: string;
    color?: string;
}

export function RiskGauge({ value, label, sublabel }: GaugeProps) {
    // Determine color based on risk level
    const getColor = (v: number) => {
        if (v < 30) return "#10B981"; // Low Risk (Emerald)
        if (v < 70) return "#F59E0B"; // Medium (Amber)
        return "#EF4444"; // High (Red)
    };

    const color = getColor(value);
    const radius = 40;
    const stroke = 8;
    const normalizedRadius = radius - stroke * 0.5;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (value / 100) * (circumference / 2); // Half circle

    return (
        <div className="flex flex-col items-center justify-center relative w-full h-[120px]">
            {/* SVG Arc Gauge */}
            <svg
                height={radius * 2}
                width={radius * 2}
                className="transform -rotate-90 overflow-visible"
            >
                {/* Background Track */}
                <circle
                    stroke="#1F2123"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    fill="transparent"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                    style={{ strokeDasharray: `${circumference / 2} ${circumference}` }}
                />
                {/* Progress Arc */}
                <circle
                    stroke={color}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    fill="transparent"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                    style={{
                        strokeDasharray: `${circumference / 2} ${circumference}`,
                        strokeDashoffset: strokeDashoffset,
                        transition: 'stroke-dashoffset 0.5s ease-in-out'
                    }}
                />
            </svg>

            {/* Value Check (Simple overlay) */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center mt-2">
                <span className="text-2xl font-bold text-white block">{value}%</span>
                {label && <span className="text-xs text-[#909399] uppercase tracking-wider">{label}</span>}
            </div>

            {sublabel && <div className="text-xs text-[#505050] mt-[-10px]">{sublabel}</div>}
        </div>
    );
}
