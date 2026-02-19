"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "@/lib/constants";

export default function GlobalStatistics({ stats, graphData }) {

    // Calculate property usage from graph data
    const propertyUsage = useMemo(() => {
        if (!graphData?.claims) return [];
        const usage = {};
        graphData.claims.forEach(claim => {
            const label = claim.property?.label || "Unknown";
            usage[label] = (usage[label] || 0) + 1;
        });
        return Object.entries(usage)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [graphData]);

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Summary Cards */}
            <div className="stats-grid">
                <StatCard
                    title="Entidades"
                    value={stats.entityCount}
                    icon={<span className="icon-database text-blue-500"></span>}
                    colorClass="stat-card-blue"
                />
                <StatCard
                    title="Declaraciones"
                    value={stats.claimCount}
                    icon={<span className="icon-list text-green-500"></span>}
                    colorClass="stat-card-green"
                />
                <StatCard
                    title="Calificadores"
                    value={stats.qualifierCount}
                    icon={<span className="icon-tag text-amber-500"></span>}
                    colorClass="stat-card-amber"
                />
                <StatCard
                    title="Referencias"
                    value={stats.referenceCount}
                    icon={<span className="icon-book text-pink-500"></span>}
                    colorClass="stat-card-pink"
                />
            </div>

            {/* Charts Section */}
            <div className="charts-grid">
                {/* Property Usage Chart */}
                <div className="chart-container">
                    <h3 className="chart-title">
                        Propiedades Más Usadas (Muestra Reciente)
                    </h3>
                    <div className="chart-canvas">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={propertyUsage} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.ui.borderDark} opacity={0.1} />
                                <XAxis type="number" stroke={CHART_COLORS.claims.literal} fontSize={12} />
                                <YAxis dataKey="name" type="category" width={100} stroke={CHART_COLORS.claims.literal} fontSize={12} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--tooltip-bg, rgba(255, 255, 255, 0.95))',
                                        borderRadius: '8px',
                                        border: 'none',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                        color: CHART_COLORS.ui.textDark
                                    }}
                                    itemStyle={{ color: CHART_COLORS.ui.textDark }}
                                    cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                                />
                                <Bar dataKey="value" fill={CHART_COLORS.palette[0]} radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Distribution Overview Placeholder */}
                <div className="chart-container flex flex-col justify-center items-center text-center">
                    <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                        <span className="icon-activity text-3xl text-gray-400"></span>
                    </div>
                    <h3 className="chart-title p-0 m-0">Distribución de Datos</h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-sm">
                        Visualizaciones adicionales aparecerán aquí a medida que la base de datos crezca.
                    </p>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, colorClass }) {
    return (
        <div className={`stat-card ${colorClass}`}>
            <div>
                <p className="stat-card-title">{title}</p>
                <p className="stat-card-value">
                    {value.toLocaleString()}
                </p>
            </div>
            <div className="text-2xl opacity-80">{icon}</div>
        </div>
    );
}
