"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { GRAPH_CONFIG, CHART_COLORS } from "@/lib/constants";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
    ssr: false,
    loading: () => <div className="h-[600px] flex items-center justify-center bg-gray-50 text-gray-500">Cargando visualización de grafo...</div>
});

export default function GlobalGraph({ graphData }) {
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

    const data = useMemo(() => {
        if (!graphData || !graphData.entities) return { nodes: [], links: [] };

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

        // 1. Add All Entities
        graphData.entities.forEach(entity => {
            addNode(entity.$id, entity.label || entity.$id, "entity", CHART_COLORS.entities.main, 4, {
                description: entity.description,
                aliases: entity.aliases ? entity.aliases.join(", ") : ""
            });
        });

        // 2. Add Links based on Claims
        if (graphData.claims) {
            graphData.claims.forEach(claim => {
                const subjectId = claim.subject?.$id || claim.subject;
                let targetId = claim.value_raw;
                let isEntityRef = false;

                if (claim.value_relation && typeof claim.value_relation === 'object') {
                    targetId = claim.value_relation.$id;
                    isEntityRef = true;
                } else {
                    isEntityRef = /^[a-zA-Z0-9]{18,}$/.test(claim.value_raw);
                }

                if (!subjectId || !targetId) return;

                // Add subject
                const subjectLabel = claim.subject?.label || subjectId;
                addNode(subjectId, subjectLabel, "entity", CHART_COLORS.entities.main, nodeIds.has(subjectId) ? 4 : 2);

                // Add target
                const targetLabel = claim.value_relation?.label || targetId;
                const type = isEntityRef ? "entity" : "literal";
                const color = isEntityRef ? CHART_COLORS.entities.main : CHART_COLORS.claims.literal; // Use main blue for all entities in global view? Or keep distinction?
                // Original used green for entity ref target.
                const targetColor = isEntityRef ? CHART_COLORS.claims.outgoing : CHART_COLORS.claims.literal;
                const targetNodeId = isEntityRef ? targetId : `val-${targetId}-${claim.$id}`;

                addNode(targetNodeId, targetLabel, type, targetColor, isEntityRef ? (nodeIds.has(targetId) ? 4 : 2) : 1);

                links.push({
                    source: subjectId,
                    target: targetNodeId,
                    name: claim.property?.label || "relates to",
                    color: isDark ? CHART_COLORS.ui.borderDark : CHART_COLORS.ui.borderLight
                });
            });
        }

        return { nodes, links };
    }, [graphData, isDark]);

    // Apply Obsidian-style physics
    useEffect(() => {
        if (fgRef.current) {
            fgRef.current.d3Force('charge').strength(-80).distanceMax(250);
            fgRef.current.d3Force('link').distance(40);
            fgRef.current.d3Force('center').strength(0.08);
        }
    }, [data]);

    return (
        <div className="flex flex-col gap-4">
            <div className="graph-container">
                <ForceGraph2D
                    ref={fgRef}
                    graphData={data}
                    nodeLabel="name"
                    nodeRelSize={GRAPH_CONFIG.nodeRelSize}
                    linkDirectionalArrowLength={GRAPH_CONFIG.linkArrowLength}
                    linkDirectionalArrowRelPos={1}
                    curvedLinks={false}
                    enableNodeDrag={true}
                    width={typeof window !== 'undefined' ? (window.innerWidth > 1200 ? 1100 : window.innerWidth - 40) : 800}
                    height={600}
                    backgroundColor={isDark ? GRAPH_CONFIG.darkBackground : GRAPH_CONFIG.lightBackground}
                    linkColor={() => isDark ? CHART_COLORS.ui.borderDark : CHART_COLORS.ui.borderLight}

                    // Physics
                    d3VelocityDecay={0.1}
                    d3AlphaDecay={0.02}
                    cooldownTicks={100}
                    onEngineStop={() => fgRef.current.zoomToFit(400, 50)}

                    d3Force="charge"
                    d3ForceStrength={-80}

                    nodeCanvasObject={(node, ctx, globalScale) => {
                        const label = node.name;
                        const fontSize = 12 / globalScale;

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
                        if (globalScale > 2 || (selectedNode && selectedNode.id === node.id)) {
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
                <div className="info-panel">
                    <h3 className="info-panel-title">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedNode.color }}></span>
                        {selectedNode.name}
                    </h3>
                    <div className="info-panel-details">
                        <p><span className="info-label">ID:</span> <span className="font-mono">{selectedNode.id}</span></p>
                        {selectedNode.aliases && <p><span className="info-label">Alias:</span> {selectedNode.aliases}</p>}
                        {selectedNode.description && <p className="mt-1">{selectedNode.description}</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
