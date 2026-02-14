"use client";

import { AnalyticsWidget } from "./AnalyticsWidget";
import {
    TrendingUp, ShieldAlert, Activity, Award, TrendingDown,
    Anchor, Grid, ArrowDownRight, Target, Scale
} from "lucide-react";



export function AnalyticsGrid() {
    // Static grid, no state needed for now


    return (
        <div className="flex flex-col gap-10">

            {/* Asset Filter */}

            {/* Performance */}
            <section>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                    <h2 className="text-lg font-semibold text-white">Performance Attributes</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <AnalyticsWidget title="Sharpe Ratio" description="Evaluates the portfolio performance by adjusting for the level of total risk exposure." subValue="Risk-Adjusted Return" icon={Award} href="/dashboard/analytics/sharpe" theme="green" />
                    <AnalyticsWidget title="Sortino Ratio" description="Assesses the return profile specifically against negative price fluctuations." subValue="Downside Risk-Adjusted" icon={ArrowDownRight} href="/dashboard/analytics/sortino" theme="green" />
                    <AnalyticsWidget title="Treynor Ratio" description="Quantifies the relationship between excess returns and systematic market risk." subValue="Excess Return / Beta" icon={Scale} href="/dashboard/analytics/treynor" theme="green" />
                    <AnalyticsWidget title="Monte Carlo Simulation" description="Employs statistical modeling to project the probability distribution of future results." subValue="Future Projections" icon={TrendingUp} href="/dashboard/analytics/monte-carlo" theme="green" />
                </div>
            </section>

            {/* Risk */}
            <section>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-1 h-6 bg-rose-500 rounded-full" />
                    <h2 className="text-lg font-semibold text-white">Risk Profile</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnalyticsWidget title="Value at Risk" description="Estimates the maximum potential loss within a specified timeframe and confidence interval." subValue="Potential Daily Loss" icon={ShieldAlert} href="/dashboard/analytics/risk" theme="red" />
                    <AnalyticsWidget title="Maximum Drawdown" description="Measures the largest peak-to-trough decline in capital before recovery." subValue="Historical Peak-to-Trough" icon={TrendingDown} href="/dashboard/analytics/drawdown" theme="red" />
                    <AnalyticsWidget
                        title="Volatility"
                        description="Indicates the degree of variation in asset prices."
                        subValue="Standard Deviation"
                        icon={Activity}
                        href="/dashboard/analytics/volatility"
                        theme="red"
                    />
                </div>
            </section>

            {/* Market Fit */}
            <section>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-1 h-6 bg-blue-500 rounded-full" />
                    <h2 className="text-lg font-semibold text-white">Market Correlation</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnalyticsWidget title="Beta" description="Measures the sensitivity of portfolio returns relative to broader market movements." subValue="Market Sensitivity" icon={Anchor} href="/dashboard/analytics/beta" theme="blue" />
                    <AnalyticsWidget title="Correlation Matrix" description="Analyzes the linear relationship between the price movements of different securities." subValue="Asset Diversification" icon={Grid} href="/dashboard/analytics/correlations" theme="blue" />
                    <AnalyticsWidget title="R-Squared" description="Determines the percentage of portfolio price movement explained by the benchmark." subValue="Benchmark Correlation" icon={Target} href="/dashboard/analytics/r-squared" theme="blue" />
                </div>
            </section>

        </div>
    );
}
