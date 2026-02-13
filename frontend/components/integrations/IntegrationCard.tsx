"use client";

import { Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import { CustomTooltip } from "../ui/CustomTooltip";

interface IntegrationCardProps {
    id: string;
    name: string;
    provider: string; // 'binance', 'trading212', etc.
    isActive: boolean;
    onDelete: (id: string) => void;
}

export function IntegrationCard({ id, name, provider, onDelete }: IntegrationCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#1E222D] border border-[#2A2E39] rounded-xl p-5 flex items-center justify-between hover:border-[#3978FF]/50 transition-colors group"
        >
            <div className="flex items-center gap-6">
                {/* Provider Icon */}
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-sm shrink-0 overflow-hidden ${provider === 'freedom24' ? 'bg-[#2A2E39] p-3' : ''
                    }`} title={provider}>
                    <Image
                        src={`/icons/square_icon/${provider}.svg`}
                        alt={name}
                        width={80}
                        height={80}
                        className="w-full h-full object-contain rounded-2xl"
                        unoptimized
                    />
                </div>

                <div>
                    <h3 className="text-white text-lg font-medium">{name}</h3>
                    <p className="text-[#909399] text-sm font-medium mt-1">
                        {provider === 'trading212' ? 'Trading 212' :
                            provider === 'freedom24' ? 'Freedom24' :
                                provider.charAt(0).toUpperCase() + provider.slice(1)}
                    </p>
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
