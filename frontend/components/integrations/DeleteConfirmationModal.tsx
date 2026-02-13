"use client";

import { motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    integrationName: string | null;
    onClose: () => void;
    onConfirm: () => void;
    isLoading: boolean;
}

export function DeleteConfirmationModal({
    isOpen,
    integrationName,
    onClose,
    onConfirm,
    isLoading
}: DeleteConfirmationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#1E222D] border border-[#2A2E39] rounded-xl shadow-2xl w-[400px] overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2E39]">
                    <h3 className="text-lg font-semibold text-white">Disconnect Exchange</h3>
                    <button
                        onClick={onClose}
                        className="text-[#909399] hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="p-3 bg-red-500/10 rounded-full shrink-0">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <p className="text-[#EAECEF] text-sm leading-relaxed">
                                Are you sure you want to disconnect <span className="font-bold text-white">{integrationName}</span>?
                            </p>
                            <p className="text-[#848E9C] text-xs mt-2">
                                This will stop data synchronization and remove all associated history from your dashboard. This action cannot be undone.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-lg border border-[#2A2E39] text-white hover:bg-[#2A2E39] transition-colors font-medium text-sm"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg px-4 py-2.5 font-medium text-sm transition-colors flex items-center justify-center gap-2"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Disconnecting...
                                </>
                            ) : (
                                "Disconnect"
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
