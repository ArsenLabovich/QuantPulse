import { DetailedHoldingItem } from "@/types/dashboard";

/**
 * Aggregates multiple asset positions (e.g. same symbol across different providers)
 * into a single unified row.
 */
export function aggregateAssetsBySymbol(items: DetailedHoldingItem[]): DetailedHoldingItem[] {
    const map = new Map<string, DetailedHoldingItem>();

    for (const item of items) {
        // Use trimmed uppercase symbol as key to prevent duplication due to case/whitespace
        const key = item.symbol.trim().toUpperCase();

        if (!map.has(key)) {
            // Create a copy to avoid mutating original data
            map.set(key, { ...item, integration_name: "Multiple", provider_id: "multiple" });
        } else {
            const existing = map.get(key)!;
            const totalVal = existing.value_usd + item.value_usd;
            const totalBal = existing.balance + item.balance;

            // Weighted average change if possible
            const existingWeight = existing.value_usd * (existing.change_24h || 0);
            const itemWeight = item.value_usd * (item.change_24h || 0);
            const newChange = totalVal > 0 ? (existingWeight + itemWeight) / totalVal : 0;

            existing.value_usd = totalVal;
            existing.balance = totalBal;
            existing.change_24h = newChange;

            // Re-calculate price based on total value / balance if needed, 
            // or just keep the one from the larger position
            existing.price_usd = totalBal > 0 ? totalVal / totalBal : existing.price_usd;

            // Fallback for icons/names
            if (!existing.icon_url && item.icon_url) {
                existing.icon_url = item.icon_url;
            }
            if ((!existing.name || existing.name === existing.symbol) && item.name) {
                existing.name = item.name;
            }
        }
    }
    return Array.from(map.values());
}
