"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Dynamically import specific ForceGraph2D to avoid SSR issues with canvas
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
    ssr: false,
    loading: () => <div className="h-full flex items-center justify-center bg-gray-50 text-gray-500">Cargando visualización de grafo...</div>
});

export default function EntityGraph({ entity, otherRelations }) {
    const fgRef = useRef();
    const [isDark, setIsDark] = useState(false);
    const [selectedNode, setSelectedNode] = useState(null);

    useEffect(() => {
        const checkDark = () => document.documentElement.classList.contains("dark");
        setIsDark(checkDark());
        const observer = new MutationObserver(checkDark);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    const [filters, setFilters] = useState({
        outgoing: true,
        incoming: true,
        asProperty: true,
        references: true
    });

    const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));

    const data = useMemo(() => {
        if (!entity) return { nodes: [], links: [] };

        const nodes = [];
        const links = [];
        const nodeIds = new Set();

        const addNode = (id, name, type, color, val = 5, extraInfo = {}) => {
            if (!id) return;
            const nodeId = id;

            if (!nodeIds.has(nodeId)) {
                nodes.push({ id: nodeId, name, type, color, val, ...extraInfo });
                nodeIds.add(nodeId);
            }
            return nodeId;
        };

        // Add Central Node (Self)
        addNode(entity.$id, entity.label || entity.$id, "main", "#2563eb", 4, {
            description: entity.description,
            role: "Entidad Actual"
        });

        // 1. Process Outgoing Claims
        if (filters.outgoing && entity.claims) {
            entity.claims.forEach(claim => {
                let targetId = claim.value_raw;
                let targetLabel = claim.value_raw;
                let isEntityRef = false;

                // Check for expanded relation
                if (claim.value_relation && typeof claim.value_relation === 'object') {
                    targetId = claim.value_relation.$id;
                    targetLabel = claim.value_relation.label || targetId;
                    isEntityRef = true;
                } else {
                    // Check if it looks like an Entity ID
                    isEntityRef = /^[a-zA-Z0-9]{18,}$/.test(claim.value_raw);
                }

                if (!targetId) return;

                const color = isEntityRef ? "#10b981" : "#9ca3af";
                const type = isEntityRef ? "entity" : "literal";

                const nodeId = isEntityRef ? targetId : `val-${targetId}`;
                const propertyLabel = claim.property?.label || "relates to";

                addNode(nodeId, targetLabel, type, color, isEntityRef ? 2 : 1, {
                    role: "Destino (Saliente)",
                    property: propertyLabel,
                    originalValue: claim.value_raw
                });

                links.push({
                    source: entity.$id,
                    target: nodeId,
                    name: propertyLabel,
                    color: "#9ca3af"
                });
            });
        }

        // 2. Incoming Relationships (Target -> Self)
        if (filters.incoming && otherRelations?.incoming) {
            otherRelations.incoming.forEach(claim => {
                const sourceId = claim.subject?.$id || claim.subject;
                const sourceLabel = claim.subject?.label || sourceId;
                const propertyLabel = claim.property?.label || "relates to";

                addNode(sourceId, sourceLabel, "entity", "#f59e0b", 2, {
                    role: "Fuente (Entrante)",
                    property: propertyLabel
                });

                links.push({
                    source: sourceId,
                    target: entity.$id,
                    name: propertyLabel,
                    color: "#f59e0b",
                    dashed: true
                });
            });
        }

        // 3. Used as Property (Subject -> [Self] -> Value)
        if (filters.asProperty && otherRelations?.asProperty) {
            otherRelations.asProperty.forEach(claim => {
                const sourceId = claim.subject?.$id || claim.subject;
                const sourceLabel = claim.subject?.label || sourceId;

                addNode(sourceId, sourceLabel, "entity", "#8b5cf6", 2, {
                    role: "Usuario de Propiedad",
                    property: "uses property"
                });

                links.push({
                    source: sourceId,
                    target: entity.$id,
                    name: "uses property",
                    color: "#8b5cf6"
                });
            });
        }

        // 4. References (Source -> Self)
        if (filters.references && otherRelations?.references) {
            otherRelations.references.forEach(ref => {
                if (ref.claim) {
                    const claimSubj = ref.claim.subject;
                    if (claimSubj) {
                        const subjId = claimSubj.$id || claimSubj;
                        const subjLabel = claimSubj.label || subjId;

                        addNode(subjId, subjLabel, "entity", "#ec4899", 2, {
                            role: "Fuente de Referencia",
                            property: "cites"
                        });

                        links.push({
                            source: subjId,
                            target: entity.$id,
                            name: "cites",
                            color: "#ec4899"
                        });
                    }
                }
            });
        }

        return { nodes, links };
    }, [entity, otherRelations, filters]);

    // Apply Obsidian-style physics
    useEffect(() => {
        if (fgRef.current) {
            fgRef.current.d3Force('charge').strength(-100).distanceMax(300);
            fgRef.current.d3Force('link').distance(50);
            fgRef.current.d3Force('center').strength(0.05);
        }
    }, [data]);

    return (
        <div className="flex flex-col gap-4">
            <div className="relative w-full h-[600px] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900 group">
                {/* Filter Controls - Overlay */}
                <div className="absolute top-4 right-4 z-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 text-xs transition-opacity opacity-0 group-hover:opacity-100 duration-200">
                    <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-200">Filtros de Grafo</h4>
                    <div className="space-y-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={filters.outgoing} onChange={() => toggleFilter('outgoing')} className="rounded text-blue-600 focus:ring-blue-500" />
                            <span className="text-gray-600 dark:text-gray-300">Salientes <span className="w-2 h-2 inline-block rounded-full bg-blue-500 ml-1"></span></span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={filters.incoming} onChange={() => toggleFilter('incoming')} className="rounded text-amber-500 focus:ring-amber-500" />
                            <span className="text-gray-600 dark:text-gray-300">Entrantes <span className="w-2 h-2 inline-block rounded-full bg-amber-500 ml-1"></span></span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={filters.asProperty} onChange={() => toggleFilter('asProperty')} className="rounded text-violet-500 focus:ring-violet-500" />
                            <span className="text-gray-600 dark:text-gray-300">Como Propiedad <span className="w-2 h-2 inline-block rounded-full bg-violet-500 ml-1"></span></span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={filters.references} onChange={() => toggleFilter('references')} className="rounded text-pink-500 focus:ring-pink-500" />
                            <span className="text-gray-600 dark:text-gray-300">Referencias <span className="w-2 h-2 inline-block rounded-full bg-pink-500 ml-1"></span></span>
                        </label>
                    </div>
                </div>

                <ForceGraph2D
                    ref={fgRef}
                    graphData={data}
                    nodeLabel="name"
                    nodeRelSize={4}
                    linkDirectionalArrowLength={3.5}
                    linkDirectionalArrowRelPos={1}
                    curvedLinks={false}
                    enableNodeDrag={true}
                    width={typeof window !== 'undefined' ? (window.innerWidth > 1200 ? 1100 : window.innerWidth - 40) : 800}
                    height={600}
                    backgroundColor={isDark ? "#111827" : "#ffffff"}
                    linkColor={link => link.color || (isDark ? "#4b5563" : "#d1d5db")}
                    linkLineDash={link => link.dashed ? [4, 2] : null}

                    // Obsidian-like Physics
                    d3VelocityDecay={0.1}
                    d3AlphaDecay={0.02}
                    cooldownTicks={100}
                    onEngineStop={() => fgRef.current.zoomToFit(400, 50)}

                    d3Force="charge"
                    d3ForceStrength={-120}

                    nodeCanvasObject={(node, ctx, globalScale) => {
                        const label = node.name;
                        const fontSize = 12 / globalScale;
                        // Node Drawing
                        ctx.beginPath();
                        const r = node.val;
                        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
                        ctx.fillStyle = node.color;
                        ctx.fill();

                        // Selection Halo
                        if (selectedNode && selectedNode.id === node.id) {
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, r + 2, 0, 2 * Math.PI, false);
                            ctx.strokeStyle = isDark ? "#fff" : "#000";
                            ctx.lineWidth = 1 / globalScale;
                            ctx.stroke();
                        }

                        // Text
                        if (globalScale > 1.5 || node.type === 'main' || (selectedNode && selectedNode.id === node.id)) {
                            ctx.font = `${fontSize}px Sans-Serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'top';
                            ctx.fillStyle = isDark ? 'rgba(229, 231, 235, 0.8)' : 'rgba(55, 65, 81, 0.8)';
                            ctx.fillText(label, node.x, node.y + r + 1);
                        }
                    }}
                    onNodeClick={node => {
                        setSelectedNode(node);
                        fgRef.current.centerAt(node.x, node.y, 1000);
                        fgRef.current.zoom(4, 2000);
                    }}
                    onBackgroundClick={() => setSelectedNode(null)}
                />
            </div>

            {/* Selected Node Info Panel */}
            {selectedNode && (
                <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm animate-fadeIn">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedNode.color }}></span>
                        {selectedNode.name}
                    </h3>
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <span className="font-semibold block text-xs uppercase tracking-wider text-gray-400">ID</span>
                            <span className="font-mono text-xs">{selectedNode.id}</span>
                        </div>
                        <div>
                            <span className="font-semibold block text-xs uppercase tracking-wider text-gray-400">Rol</span>
                            <span>{selectedNode.role || "N/A"}</span>
                        </div>
                        {selectedNode.property && (
                            <div>
                                <span className="font-semibold block text-xs uppercase tracking-wider text-gray-400">Propiedad</span>
                                <span>{selectedNode.property}</span>
                            </div>
                        )}
                        {selectedNode.description && (
                            <div className="col-span-1 md:col-span-2">
                                <span className="font-semibold block text-xs uppercase tracking-wider text-gray-400">Descripción</span>
                                <span>{selectedNode.description}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
