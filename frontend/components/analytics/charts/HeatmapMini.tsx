"use client";

export function HeatmapMini() {
    // Generate some mock correlation data (3x3 grid)
    // 1 = High correlation (Red), 0 = Low (Green).
    const data = [
        1.0, 0.8, 0.2,
        0.8, 1.0, 0.4,
        0.2, 0.4, 1.0,
    ];

    const getColor = (value: number) => {
        if (value > 0.7) return "bg-rose-500/80";
        if (value > 0.4) return "bg-amber-500/80";
        return "bg-emerald-500/80";
    };

    return (
        <div className="w-full h-full flex items-center justify-center p-4">
            <div className="grid grid-cols-3 gap-1 w-full max-w-[120px] aspect-square">
                {data.map((val, i) => (
                    <div
                        key={i}
                        className={`rounded-sm ${getColor(val)} transition-opacity hover:opacity-100 opacity-80 cursor-pointer`}
                        title={`Correlation: ${val}`}
                    />
                ))}
            </div>
        </div>
    );
}
