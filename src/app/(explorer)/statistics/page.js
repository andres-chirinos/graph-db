"use client";

import { useState, useEffect } from "react";
import { getGlobalStats, getGlobalGraphData } from "@/lib/database";
import GlobalStatistics from "@/components/GlobalStatistics";
import GlobalGraph from "@/components/GlobalGraph";
import { LoadingState, ErrorState } from "@/components";
import "./page.css";

export default function StatisticsPage() {
    const [stats, setStats] = useState(null);
    const [graphData, setGraphData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState("overview");

    useEffect(() => {
        async function loadData() {
            try {
                setLoading(true);
                const [statsData, graphData] = await Promise.all([
                    getGlobalStats(),
                    getGlobalGraphData(75) // Limit to top 75 for performance
                ]);
                setStats(statsData);
                setGraphData(graphData);
            } catch (err) {
                console.error("Failed to load statistics:", err);
                setError(err);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="explorer-layout">
                <main className="explorer-main">
                    <div className="explorer-container">
                        <LoadingState message="Cargando estadísticas globales..." />
                    </div>
                </main>
            </div>
        );
    }

    if (error) {
        return (
            <div className="explorer-layout">
                <main className="explorer-main">
                    <div className="explorer-container">
                        <ErrorState error={error} title="Error al cargar estadísticas" />
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="explorer-layout">
            <main className="explorer-main">
                <div className="explorer-container">
                    <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                        Estadísticas Globales
                    </h1>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                        <button
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === "overview"
                                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                }`}
                            onClick={() => setActiveTab("overview")}
                        >
                            Resumen
                        </button>
                        <button
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === "graph"
                                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                }`}
                            onClick={() => setActiveTab("graph")}
                        >
                            Grafo Global
                        </button>
                    </div>

                    {/* Content */}
                    {activeTab === "overview" && (
                        <GlobalStatistics stats={stats} graphData={graphData} />
                    )}

                    {activeTab === "graph" && (
                        <div className="animate-fadeIn">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Visualizando las entidades más activas recientemente y sus conexiones.
                            </p>
                            <GlobalGraph graphData={graphData} />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
