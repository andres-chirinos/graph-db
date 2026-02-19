"use client";

import { useMemo, useState, useEffect } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from "recharts";
import { Calculator, Link, Tag, FileText } from "lucide-react";

const COLORS_LIGHT = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];
const COLORS_DARK = ["#3b82f6", "#10b981", "#f59e0b", "#f97316", "#8b5cf6", "#a78bfa"];

export default function EntityStatistics({ entity }) {
    // Theme detection
    const [isDark, setIsDark] = useState(false);
    useEffect(() => {
        const checkDark = () => document.documentElement.classList.contains("dark");
        setIsDark(checkDark());
        const observer = new MutationObserver(checkDark);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    const colors = isDark ? COLORS_DARK : COLORS_LIGHT;
    // ... useMemo logic ...
    const stats = useMemo(() => {
        if (!entity) return null;

        const claims = entity.claims || [];
        const totalClaims = claims.length;

        // Count qualifiers and references
        let totalQualifiers = 0;
        let totalReferences = 0;

        const propertyCounts = {};

        claims.forEach(claim => {
            if (claim.qualifiers) totalQualifiers += claim.qualifiers.length;
            if (claim.references) totalReferences += claim.references.length;

            const propLabel = claim.property?.label || claim.property?.$id || "Unknown";
            propertyCounts[propLabel] = (propertyCounts[propLabel] || 0) + 1;
        });

        const propertyData = Object.entries(propertyCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return {
            totalClaims,
            totalQualifiers,
            totalReferences,
            propertyData
        };
    }, [entity]);

    if (!stats) return <div className="text-center p-4">Cargando estadísticas...</div>;

    const tooltipStyle = {
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        color: isDark ? '#f3f4f6' : '#111827',
        borderRadius: '0.5rem'
    };

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Declaraciones"
                    value={stats.totalClaims}
                    icon={<Link className="w-5 h-5 text-blue-500" />}
                    description="Total de relaciones salientes"
                />
                <StatCard
                    title="Calificadores"
                    value={stats.totalQualifiers}
                    icon={<Tag className="w-5 h-5 text-green-500" />}
                    description="Detalles sobre las declaraciones"
                />
                <StatCard
                    title="Referencias"
                    value={stats.totalReferences}
                    icon={<FileText className="w-5 h-5 text-orange-500" />}
                    description="Fuentes citadas"
                />
                <StatCard
                    title="Tipos de Propiedad"
                    value={stats.propertyData.length}
                    icon={<Calculator className="w-5 h-5 text-purple-500" />}
                    description="Propiedades únicas usadas"
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Property Distribution Bar Chart */}
                <div className="bg-white p-4 rounded-lg shadow border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Distribución de Propiedades</h3>
                    <div className="h-64 w-full">
                        {stats.propertyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.propertyData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? "#374151" : "#e5e7eb"} />
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: isDark ? "#9ca3af" : "#4b5563" }} />
                                    <Tooltip
                                        contentStyle={tooltipStyle}
                                        itemStyle={{ color: isDark ? '#e5e7eb' : '#374151' }}
                                        cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                                    />
                                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                                        {stats.propertyData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                Sin datos suficientes
                            </div>
                        )}
                    </div>
                </div>

                {/* Pie Chart */}
                <div className="bg-white p-4 rounded-lg shadow border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Proporción de Relaciones</h3>
                    <div className="h-64 w-full">
                        {stats.propertyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.propertyData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {stats.propertyData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Legend
                                        layout="vertical"
                                        verticalAlign="middle"
                                        align="right"
                                        wrapperStyle={{ color: isDark ? '#e5e7eb' : '#374151' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                Sin datos suficientes
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, description }) {
    return (
        <div className="bg-white p-4 rounded-lg shadow border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
                {icon}
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
            <p className="text-xs text-gray-400 mt-1">{description}</p>
        </div>
    );
}
