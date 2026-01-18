"use client";

import { Trash2, CheckCircle, AlertCircle, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { CustomTooltip } from "../ui/CustomTooltip";

interface IntegrationCardProps {
    id: string;
    name: string;
    provider: string; // 'binance', 'trading212', etc.
    isActive: boolean;
    onDelete: (id: string) => void;
}

export function IntegrationCard({ id, name, provider, isActive, onDelete }: IntegrationCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#1E222D] border border-[#2A2E39] rounded-xl p-5 flex items-center justify-between hover:border-[#3978FF]/50 transition-colors group"
        >
            <div className="flex items-center gap-4">
                {/* Provider Icon */}
                <div className="w-12 h-12 rounded-lg bg-[#2A2E39] flex items-center justify-center text-white" title={provider}>
                    {provider === 'binance' ? (
                        <svg role="img" viewBox="0 0 24 24" className="w-8 h-8 text-[#F0B90B] fill-current" xmlns="http://www.w3.org/2000/svg">
                            <title>Binance</title>
                            <path d="M16.624 13.9202l2.7175 2.7154-7.353 7.353-7.353-7.352 2.7175-2.7164 4.6355 4.6595 4.6356-4.6595zm4.6366-4.6366L24 12l-2.7154 2.7164L18.5682 12l2.6924-2.7164zm-9.272.001l2.7163 2.6914-2.7164 2.7174v-.001L9.2721 12l2.7164-2.7154zm-9.2722-.001L5.4088 12l-2.6914 2.6924L0 12l2.7164-2.7164zM11.9885.0115l7.353 7.329-2.7174 2.7154-4.6356-4.6356-4.6355 4.6595-2.7174-2.7154 7.353-7.353z" />
                        </svg>
                    ) : provider === 'trading212' ? (
                        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 19L12 5L20 19" stroke="#00A4E1" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    ) : (
                        <span className="font-bold text-xl">{provider[0]?.toUpperCase()}</span>
                    )}
                </div>

                <div>
                    <h3 className="text-white font-medium">{name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-xs text-[#909399] uppercase tracking-wider font-medium">
                            {isActive ? 'Active' : 'Error'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <CustomTooltip content="Disconnect" delay={100}>
                    <button
                        onClick={() => onDelete(id)}
                        className="p-2 text-[#909399] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </CustomTooltip>
            </div>
        </motion.div>
    );
}
