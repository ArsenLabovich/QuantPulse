import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface CustomTooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    delay?: number;
    className?: string;
    style?: React.CSSProperties;
}

export const CustomTooltip = ({ content, children, delay = 200, className, style }: CustomTooltipProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const triggerRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = () => {
        timerRef.current = setTimeout(() => {
            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                setCoords({
                    x: rect.left + rect.width / 2,
                    y: rect.top - 10,
                });
                setIsVisible(true);
            }
        }, delay);
    };

    const handleMouseLeave = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setIsVisible(false);
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return (
        <div 
            ref={triggerRef}
            className={`inline-block cursor-help ${className || ""}`}
            style={style}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}
            {isVisible && createPortal(
                <div 
                    className="fixed z-9999 px-3 py-2 text-xs font-medium text-white bg-[#1E222D] border border-[#2A2E39] rounded-lg shadow-2xl pointer-events-none transform -translate-x-1/2 -translate-y-full animate-in fade-in zoom-in duration-200"
                    style={{ left: coords.x, top: coords.y, maxWidth: '240px' }}
                >
                    {content}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#1E222D]" />
                </div>,
                document.body
            )}
        </div>
    );
};
