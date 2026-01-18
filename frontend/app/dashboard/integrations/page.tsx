"use client";

import { useState, useEffect } from "react";
import { Plus, Plug } from "lucide-react";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { AddIntegrationModal, IntegrationFormData } from "@/components/integrations/AddIntegrationModal";
import { DeleteConfirmationModal } from "@/components/integrations/DeleteConfirmationModal";
import api from "@/lib/api";

interface Integration {
    id: string;
    name: string;
    provider_id: string;
    is_active: boolean;
}

export default function IntegrationsPage() {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Delete state
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteName, setDeleteName] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchIntegrations = async () => {
        try {
            const res = await api.get("/integrations/");
            setIntegrations(res.data);
        } catch (error) {
            console.error("Failed to fetch integrations", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddIntegration = async (data: IntegrationFormData) => {
        // This will throw if backend returns error, handled by Modal
        const res = await api.post("/integrations/", data);
        setIntegrations([...integrations, res.data]);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            await api.delete(`/integrations/${deleteId}`);
            setIntegrations(integrations.filter(i => i.id !== deleteId));
            setDeleteId(null);
            setDeleteName(null);
        } catch (error) {
            console.error("Failed to delete integration", error);
            alert("Failed to disconnect");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteClick = (id: string, name: string) => {
        setDeleteId(id);
        setDeleteName(name);
    };

    useEffect(() => {
        fetchIntegrations();
    }, []);

    return (
        <div className="max-w-6xl mx-auto p-8" suppressHydrationWarning>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Connected Integrations</h1>
                    <p className="text-[#909399]">Manage your exchange connections and data sources.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-[#3978FF] hover:bg-[#2F65D6] text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-5 h-5" />
                    Add Connection
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 border-2 border-[#3978FF] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : integrations.length === 0 ? (
                <div className="bg-[#1E222D] border border-[#2A2E39] border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-[#2A2E39] rounded-full flex items-center justify-center text-[#909399] mb-4">
                        <Plug className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">No exchanges connected yet</h3>
                    <p className="text-[#909399] max-w-md mx-auto mb-6">
                        Connect your first exchange account to start tracking your portfolio and analyzing your performance.
                    </p>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="text-[#3978FF] hover:text-[#2F65D6] font-medium"
                    >
                        Connect Exchange
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {integrations.map((int) => (
                        <IntegrationCard
                            key={int.id}
                            id={int.id}
                            name={int.name}
                            provider={int.provider_id}
                            isActive={int.is_active}
                            onDelete={() => handleDeleteClick(int.id, int.name)}
                        />
                    ))}
                </div>
            )}

            <AddIntegrationModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSubmit={handleAddIntegration}
            />

            <DeleteConfirmationModal
                isOpen={!!deleteId}
                integrationName={deleteName}
                onClose={() => {
                    setDeleteId(null);
                    setDeleteName(null);
                }}
                onConfirm={confirmDelete}
                isLoading={isDeleting}
            />
        </div>
    );
}
