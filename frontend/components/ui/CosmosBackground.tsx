"use client";
import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export const CosmosBackground = ({ className }: { className?: string }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animationFrameId: number;
        let width = window.innerWidth;
        let height = window.innerHeight;

        const stars: { x: number; y: number; size: number; alpha: number; speed: number }[] = [];
        const starCount = 150;

        const init = () => {
            canvas.width = width;
            canvas.height = height;
            stars.length = 0;
            for (let i = 0; i < starCount; i++) {
                stars.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    size: Math.random() * 1.5,
                    alpha: Math.random(),
                    speed: (Math.random() * 0.05) + 0.01,
                });
            }
        };

        const draw = () => {
            ctx.clearRect(0, 0, width, height);

            stars.forEach((star) => {
                ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();

                // Move stars slowly continuously to the right/up for a subtle cosmic drift
                star.y -= star.speed;
                if (star.y < 0) star.y = height;

                // Twinkle effect
                star.alpha += (Math.random() - 0.5) * 0.02;
                if (star.alpha < 0.1) star.alpha = 0.1;
                if (star.alpha > 0.8) star.alpha = 0.8;
            });

            animationFrameId = requestAnimationFrame(draw);
        };

        init();
        draw();

        const handleResize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            init();
        };

        window.addEventListener("resize", handleResize);
        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    return (
        <div className={cn("fixed inset-0 z-0 overflow-hidden bg-slate-950 pointer-events-none", className)} suppressHydrationWarning>
            {/* Deep Space Gradients (Nebulas) */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full animate-pulse-slow" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 blur-[120px] rounded-full animate-pulse-slow delay-1000" />
            <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] bg-indigo-900/10 blur-[100px] rounded-full animate-float" />

            <canvas ref={canvasRef} className="absolute inset-0 z-10" />

            {/* Vignette */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent via-slate-950/20 to-slate-950/90 z-20" />
        </div>
    );
};
