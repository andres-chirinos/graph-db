/**
 * Global Constants & Configurations
 */

// Color palettes for charts and visualizations
export const CHART_COLORS = {
    // Standard palette for ordered data or categories
    palette: ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#ef4444"],

    // Semantic colors for specific entity/relationship types
    entities: {
        main: "#3b82f6",      // Blue
        reference: "#ec4899", // Pink
        property: "#8b5cf6",  // Violet
    },

    claims: {
        outgoing: "#10b981",  // Green
        incoming: "#f59e0b",  // Amber
        literal: "#9ca3af",   // Gray
    },

    ui: {
        borderLight: "#e5e7eb",
        borderDark: "#374151",
        textLight: "#f3f4f6", // ~gray-100
        textDark: "#1f2937",  // ~gray-800
    }
};

// Graph Visualization Config
export const GRAPH_CONFIG = {
    nodeRelSize: 4,
    linkWidth: 1.5,
    linkArrowLength: 3,
    darkBackground: "#111827",
    lightBackground: "#ffffff",
};
