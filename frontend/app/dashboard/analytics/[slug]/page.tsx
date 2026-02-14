"use client";

import { useParams } from "next/navigation";
import { MetricDetails } from "@/components/analytics/MetricDetails";

export default function AnalyticsDetailPage() {
    const params = useParams();
    const slug = params?.slug as string;

    return (
        <div className="p-6 md:p-10 min-h-screen bg-[#09090B]">
            <MetricDetails slug={slug} />
        </div>
    );
}
