"use client";

import { useState, useEffect } from "react";
import { X, Check, Lock, AlertTriangle, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CustomTooltip } from "@/components/ui/CustomTooltip";

export interface IntegrationFormData {
    provider_id: string;
    name: string;
    credentials: {
        api_key: string;
        api_secret: string;
    };
}

interface AddIntegrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: IntegrationFormData) => Promise<void>;
}

export function AddIntegrationModal({ isOpen, onClose, onSubmit }: AddIntegrationModalProps) {
    const [step, setStep] = useState(1); // 1: Select, 2: Configure
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: "", apiKey: "", apiSecret: "" });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showHelp, setShowHelp] = useState(false);
    const [formErrors, setFormErrors] = useState<{ apiKey?: string[]; apiSecret?: string[] }>({});



    const handleProviderSelect = (provider: string) => {
        setSelectedProvider(provider);
        setStep(2);
    };

    const validateForm = (isSubmit = false) => {
        const errors: { apiKey?: string[]; apiSecret?: string[] } = {};
        if (selectedProvider === "binance") {
            const key = formData.apiKey.trim();
            const secret = formData.apiSecret.trim();

            if (key) {
                const kErrors: string[] = [];
                if (key.length !== 64) {
                    kErrors.push(`Invalid length (${key.length}/64 characters)`);
                }
                if (!/^[a-zA-Z0-9]+$/.test(key)) {
                    kErrors.push("Contains invalid characters (only A-Z, 0-9 allowed)");
                }
                if (kErrors.length > 0) errors.apiKey = kErrors;
            } else if (isSubmit) {
                errors.apiKey = ["API Key is required"];
            }

            if (secret) {
                const sErrors: string[] = [];
                if (secret.length !== 64) {
                    sErrors.push(`Invalid length (${secret.length}/64 characters)`);
                }
                if (!/^[a-zA-Z0-9]+$/.test(secret)) {
                    sErrors.push("Contains invalid characters (only A-Z, 0-9 allowed)");
                }
                if (sErrors.length > 0) errors.apiSecret = sErrors;
            } else if (isSubmit) {
                errors.apiSecret = ["API Secret is required"];
            }
        } else if (selectedProvider === "trading212") {
            const key = formData.apiKey.trim();
            if (key) {
                if (key.length < 10) {
                    errors.apiKey = ["API Key looks too short"];
                }
            } else if (isSubmit) {
                errors.apiKey = ["API Key is required"];
            }
        } else if (selectedProvider === "freedom24") {
            if (!formData.apiKey.trim() && isSubmit) {
                errors.apiKey = ["API Key (Public Key) is required"];
            }
            if (!formData.apiSecret.trim() && isSubmit) {
                errors.apiSecret = ["Secret Key (Private Key) is required"];
            }
        }
        return Object.keys(errors).length > 0 ? errors : null;
    };

    // Live validation
    useEffect(() => {
        // Skip validation if modal is closed to avoid unnecessary checks/renders
        if (!isOpen) return;

        if (step === 2) {
            const errors = validateForm(false);
            setFormErrors(errors || {});
        }
    }, [formData, step, isOpen]); // Added isOpen to dependencies

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setFormErrors({});

        if (!selectedProvider) {
            setError("Please select a provider");
            return;
        }

        const validationErrors = validateForm(true);
        if (validationErrors) {
            setFormErrors(validationErrors);
            return;
        }

        setIsLoading(true);
        try {
            await onSubmit({
                provider_id: selectedProvider,
                name: formData.name,
                credentials: {
                    api_key: formData.apiKey.trim(),
                    api_secret: formData.apiSecret.trim()
                }
            });
            onClose();
            // Reset state
            setStep(1);
            setFormData({ name: "", apiKey: "", apiSecret: "" });
            setFormErrors({});
        } catch (err: any) {
            console.error("Connection Error:", err);
            // Try to extract backend error message
            if (err.response && err.response.data && err.response.data.detail) {
                setError(err.response.data.detail);
            } else if (err instanceof Error) {
                setError(err.message || "Failed to connect");
            } else {
                setError("Failed to connect");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#151921] rounded-xl shadow-2xl w-[500px]"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2E39] relative z-20">
                    <div className="flex items-center gap-3">
                        {step === 2 && (
                            <div className="w-8 h-8 flex items-center justify-center">
                                {selectedProvider === 'binance' ? (
                                    <svg role="img" viewBox="0 0 24 24" className="w-6 h-6 text-[#F0B90B] fill-current" xmlns="http://www.w3.org/2000/svg">
                                        <title>Binance</title>
                                        <path d="M16.624 13.9202l2.7175 2.7154-7.353 7.353-7.353-7.352 2.7175-2.7164 4.6355 4.6595 4.6356-4.6595zm4.6366-4.6366L24 12l-2.7154 2.7164L18.5682 12l2.6924-2.7164zm-9.272.001l2.7163 2.6914-2.7164 2.7174v-.001L9.2721 12l2.7164-2.7154zm-9.2722-.001L5.4088 12l-2.6914 2.6924L0 12l2.7164-2.7164zM11.9885.0115l7.353 7.329-2.7174 2.7154-4.6356-4.6356-4.6355 4.6595-2.7174-2.7154 7.353-7.353z" />
                                    </svg>
                                ) : selectedProvider === 'trading212' ? (
                                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M4 19L12 5L20 19" stroke="#00A4E1" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                ) : selectedProvider === 'freedom24' ? (
                                    <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#66BC29] fill-current" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M21 4H3C2.45 4 2 4.45 2 5V19C2 19.55 2.45 20 3 20H21C21.55 20 22 19.55 22 19V5C22 4.45 21.55 4 21 4ZM12 17L7 12H10V8H14V12H17L12 17Z" />
                                    </svg>
                                ) : null}
                            </div>
                        )}
                        <h2 className="text-lg font-semibold text-white">
                            {step === 1 ? "Select Exchange" :
                                selectedProvider === 'binance' ? "Configure Binance" :
                                    selectedProvider === 'trading212' ? "Configure Trading 212" :
                                        selectedProvider === 'freedom24' ? "Configure Freedom24" : "Configure Integration"}
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        {step === 2 && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowHelp(!showHelp)}
                                    className={`
                                        flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                                        ${showHelp
                                            ? 'bg-[#3978FF]/10 text-[#3978FF] ring-1 ring-[#3978FF]'
                                            : 'bg-[#1F2123] text-[#909399] hover:text-white hover:bg-[#2A2E39]'
                                        }
                                    `}
                                >
                                    <HelpCircle className="w-4 h-4" />
                                    <span>Help</span>
                                </button>

                                <AnimatePresence>
                                    {showHelp && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute right-0 top-full mt-3 w-80 bg-[#1E2329] border border-[#2B3139] rounded-lg p-5 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.6)] z-50"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="p-2 bg-[#FCD535]/10 rounded text-[#FCD535] shrink-0 mt-0.5">
                                                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                                                </div>
                                                <div className="space-y-3">
                                                    <h4 className="text-[14px] font-bold text-[#EAECEF] leading-snug">API Key Permissions</h4>
                                                    <div className="text-[12px] text-[#848E9C] space-y-2 leading-relaxe font-medium">
                                                        <p>1. Log in to <span className="text-[#FCD535] hover:underline cursor-pointer">Binance</span>.</p>
                                                        <p>2. Go to <span className="text-[#EAECEF]">Account &gt; API Management</span>.</p>
                                                        <p>3. Create a new API Key.</p>

                                                        <div className="pt-2 flex flex-col gap-2">
                                                            <div className="flex items-center gap-2 text-[#0ECB81]">
                                                                <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                                                <span>Enable Reading</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[#F6465D] opacity-80">
                                                                <X className="w-3.5 h-3.5" strokeWidth={3} />
                                                                <span>Disable Spot & Margin Trading</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[#F6465D] opacity-80">
                                                                <X className="w-3.5 h-3.5" strokeWidth={3} />
                                                                <span>Disable Withdrawals</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        <div className="w-px h-6 bg-[#2A2E39] mx-1" />

                        <button
                            onClick={onClose}
                            className="text-[#909399] hover:text-white transition-colors p-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {step === 1 ? (
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => handleProviderSelect("binance")}
                                className="bg-[#131722] hover:bg-[#1A1E29] border border-[#1F2123] hover:border-[#3978FF] rounded-xl p-6 flex flex-col items-center gap-3 transition-all group"
                            >
                                <div className="w-12 h-12 flex items-center justify-center mb-2">
                                    <svg role="img" viewBox="0 0 24 24" className="w-10 h-10 text-[#F0B90B] fill-current" xmlns="http://www.w3.org/2000/svg">
                                        <title>Binance</title>
                                        <path d="M16.624 13.9202l2.7175 2.7154-7.353 7.353-7.353-7.352 2.7175-2.7164 4.6355 4.6595 4.6356-4.6595zm4.6366-4.6366L24 12l-2.7154 2.7164L18.5682 12l2.6924-2.7164zm-9.272.001l2.7163 2.6914-2.7164 2.7174v-.001L9.2721 12l2.7164-2.7154zm-9.2722-.001L5.4088 12l-2.6914 2.6924L0 12l2.7164-2.7164zM11.9885.0115l7.353 7.329-2.7174 2.7154-4.6356-4.6356-4.6355 4.6595-2.7174-2.7154 7.353-7.353z" />
                                    </svg>
                                </div>
                                <span className="text-white font-medium">Binance</span>
                                <div className="flex items-center gap-1.5 text-xs text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    Active
                                </div>
                            </button>

                            <button
                                onClick={() => handleProviderSelect("trading212")}
                                className="bg-[#131722] hover:bg-[#1A1E29] border border-[#1F2123] hover:border-[#3978FF] rounded-xl p-6 flex flex-col items-center gap-3 transition-all group"
                            >
                                <div className="w-12 h-12 flex items-center justify-center mb-2">
                                    <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M4 19L12 5L20 19" stroke="#00A4E1" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                                <span className="text-white font-medium">Trading 212</span>
                                <div className="flex items-center gap-1.5 text-xs text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    Active
                                </div>
                            </button>

                            <button
                                onClick={() => handleProviderSelect("freedom24")}
                                className="bg-[#131722] hover:bg-[#1A1E29] border border-[#1F2123] hover:border-[#3978FF] rounded-xl p-6 flex flex-col items-center gap-3 transition-all group"
                            >
                                <div className="w-12 h-12 flex items-center justify-center mb-2">
                                    <svg viewBox="0 0 24 24" className="w-10 h-10 text-[#66BC29] fill-current" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M21 4H3C2.45 4 2 4.45 2 5V19C2 19.55 2.45 20 3 20H21C21.55 20 22 19.55 22 19V5C22 4.45 21.55 4 21 4ZM12 17L7 12H10V8H14V12H17L12 17Z" />
                                    </svg>
                                </div>
                                <span className="text-white font-medium">Freedom24</span>
                                <div className="flex items-center gap-1.5 text-xs text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    Active
                                </div>
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                            {/* Trick browser auto-fill/save-password logic */}
                            <div className="absolute opacity-0 w-0 h-0 overflow-hidden pointer-events-none">
                                <input type="text" name="prevent_autofill_name" tabIndex={-1} autoComplete="off" />
                                <input type="password" name="prevent_autofill_pass" tabIndex={-1} autoComplete="off" />
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-400">{error}</p>
                                </div>
                            )}

                            {selectedProvider === 'binance' ? (
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-3">
                                    <Lock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                    <div className="text-sm text-blue-300">
                                        Your keys are encrypted using AES-256 before storage.
                                        <br />
                                        <span className="text-blue-200 mt-1 block font-medium">Please disable &quot;Withdrawals&quot; on your API key.</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-3">
                                    <Lock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                    <div className="text-sm text-blue-300">
                                        Your API Key is encrypted securely.
                                        <br />
                                        <span className="text-blue-200 mt-1 block font-medium">Generate it in Settings &gt; API.</span>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-[#909399]">Connection Name</label>
                                </div>
                                <input
                                    type="text"
                                    name="qp_conn_name"
                                    id="qp_conn_name"
                                    required
                                    placeholder="e.g. Main Account"
                                    className="w-full bg-[#131722] border border-[#1F2123] rounded-lg px-4 py-2.5 text-white placeholder:text-[#333] focus:border-[#3978FF] focus:outline-none transition-colors"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    autoComplete="off"
                                />
                            </div>

                            <div className="space-y-1.5 relative">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-[#909399]">
                                        {selectedProvider === 'trading212' ? 'API Key ID' : 'API Key'}
                                    </label>
                                </div>

                                <input
                                    type="text"
                                    name="qp_api_key_v1"
                                    id="qp_api_key_v1"
                                    required
                                    readOnly={true}
                                    onFocus={(e) => e.target.readOnly = false}
                                    className={`w-full bg-[#131722] border rounded-lg px-4 py-2.5 text-white placeholder:text-[#333] focus:outline-none transition-colors ${formErrors.apiKey?.length
                                        ? 'border-red-500 focus:border-red-500'
                                        : 'border-[#1F2123] focus:border-[#3978FF]'
                                        }`}
                                    value={formData.apiKey}
                                    onChange={e => {
                                        setFormData({ ...formData, apiKey: e.target.value });
                                        if (formErrors.apiKey) setFormErrors({ ...formErrors, apiKey: undefined });
                                    }}
                                    autoComplete="off"
                                />
                                {formErrors.apiKey && formErrors.apiKey.map((err, i) => (
                                    <p key={i} className="text-xs text-red-500 mt-1">{err}</p>
                                ))}
                            </div>



                            {(selectedProvider === 'binance' || selectedProvider === 'trading212' || selectedProvider === 'freedom24') && (
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-[#909399]">
                                        {selectedProvider === 'trading212' ? 'API Secret / Private Key' :
                                            selectedProvider === 'freedom24' ? 'Secret Key (Private Key)' : 'API Secret'}
                                    </label>
                                    <input
                                        type="password"
                                        name="qp_api_secret_v1"
                                        id="qp_api_secret_v1"
                                        required
                                        readOnly={true}
                                        onFocus={(e) => e.target.readOnly = false}
                                        className={`w-full bg-[#131722] border rounded-lg px-4 py-2.5 text-white placeholder:text-[#333] focus:outline-none transition-colors ${formErrors.apiSecret?.length
                                            ? 'border-red-500 focus:border-red-500'
                                            : 'border-[#1F2123] focus:border-[#3978FF]'
                                            }`}
                                        value={formData.apiSecret}
                                        onChange={e => {
                                            setFormData({ ...formData, apiSecret: e.target.value });
                                            if (formErrors.apiSecret) setFormErrors({ ...formErrors, apiSecret: undefined });
                                        }}
                                        autoComplete="off"
                                        data-lpignore="true"
                                        data-form-type="other"
                                    />
                                    {formErrors.apiSecret && formErrors.apiSecret.map((err, i) => (
                                        <p key={i} className="text-xs text-red-500 mt-1">{err}</p>
                                    ))}
                                </div>
                            )}

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="flex-1 px-4 py-2.5 rounded-lg border border-[#1F2123] text-white hover:bg-[#1F2123] transition-colors"
                                    disabled={isLoading}
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-[#3978FF] hover:bg-[#2F65D6] text-white rounded-lg px-4 py-2.5 font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Verifying...
                                        </>
                                    ) : (
                                        <>
                                            Connect
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </motion.div >
        </div >
    );
}
