"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";

/**
 * MiniMap Component
 * 
 * Muestra un pequeño mapa con geometrías GeoJSON.
 * Se carga dinámicamente para evitar problemas con SSR.
 * Incluye opción de expandir para explorar el mapa.
 */

// Componente de mapa expandido (fullscreen)
function ExpandedMap({ 
  L,
  coordinates, 
  geometryType,
  center,
  geoJsonData,
  fileUrl,
  onClose,
}) {
  const expandedMapRef = useRef(null);
  const expandedMapInstanceRef = useRef(null);

  useEffect(() => {
    if (!L || !expandedMapRef.current || expandedMapInstanceRef.current) return;

    // Crear el mapa expandido con controles completos
    const map = L.map(expandedMapRef.current, {
      zoomControl: true,
      attributionControl: true,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
    });

    // Añadir capa de tiles (OpenStreetMap)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    expandedMapInstanceRef.current = map;

    // Función para añadir GeoJSON al mapa
    function addGeoJsonToMap(geoJson) {
      try {
        const layer = L.geoJSON(geoJson, {
          style: {
            color: "#3b82f6",
            weight: 2,
            fillColor: "#3b82f6",
            fillOpacity: 0.3,
          },
        }).addTo(map);

        // Ajustar la vista a los bounds
        const layerBounds = layer.getBounds();
        if (layerBounds.isValid()) {
          map.fitBounds(layerBounds, { padding: [50, 50] });
        } else if (center) {
          map.setView([center.latitude, center.longitude], 10);
        } else {
          map.setView([0, 0], 2);
        }
      } catch (e) {
        console.error("Error creating GeoJSON layer:", e);
        if (center) {
          map.setView([center.latitude, center.longitude], 10);
        } else {
          map.setView([0, 0], 2);
        }
      }
    }

    // Si tenemos datos cargados desde archivo
    if (geoJsonData) {
      addGeoJsonToMap(geoJsonData);
    }
    // Si tenemos coordenadas directas
    else if (coordinates) {
      let geoJsonType = "Polygon";
      if (geometryType === "multipolygon") geoJsonType = "MultiPolygon";
      else if (geometryType === "linestring") geoJsonType = "LineString";
      else if (geometryType === "point") geoJsonType = "Point";

      const geoJson = {
        type: "Feature",
        geometry: {
          type: geoJsonType,
          coordinates: coordinates,
        },
      };

      addGeoJsonToMap(geoJson);
    } else if (center) {
      map.setView([center.latitude, center.longitude], 10);
    } else {
      map.setView([0, 0], 2);
    }

    // Forzar re-render del mapa después de que el modal esté visible
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      if (expandedMapInstanceRef.current) {
        expandedMapInstanceRef.current.remove();
        expandedMapInstanceRef.current = null;
      }
    };
  }, [L, coordinates, center, geometryType, geoJsonData]);

  // Cerrar con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="expanded-map-overlay" onClick={onClose}>
      <div className="expanded-map-container" onClick={(e) => e.stopPropagation()}>
        <div className="expanded-map-header">
          <h3>Explorar mapa</h3>
          <button className="expanded-map-close" onClick={onClose} title="Cerrar (Esc)">
            <span className="icon-x"></span>
          </button>
        </div>
        <div 
          ref={expandedMapRef}
          className="expanded-map"
        />
        {fileUrl && (
          <div className="expanded-map-footer">
            <a 
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="file-link"
              download
            >
              <span className="icon-download"></span>
              <span>Descargar GeoJSON</span>
            </a>
          </div>
        )}
      </div>
      <style jsx global>{`
        .expanded-map-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
        }

        .expanded-map-container {
          background: white;
          border-radius: 8px;
          width: 100%;
          max-width: 1200px;
          height: 80vh;
          max-height: 800px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .expanded-map-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .expanded-map-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #374151;
        }

        .expanded-map-close {
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          border-radius: 4px;
          color: #6b7280;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .expanded-map-close:hover {
          background: #e5e7eb;
          color: #374151;
        }

        .expanded-map {
          flex: 1;
          width: 100%;
          min-height: 0;
        }

        .expanded-map-footer {
          padding: 12px 16px;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
          display: flex;
          justify-content: flex-end;
        }

        .expanded-map-footer .file-link {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: #3b82f6;
          color: white;
          border-radius: 4px;
          text-decoration: none;
          font-size: 14px;
          transition: background 0.2s;
        }

        .expanded-map-footer .file-link:hover {
          background: #2563eb;
        }
      `}</style>
    </div>,
    document.body
  );
}

// Componente interno que usa Leaflet
function MiniMapInternal({ 
  coordinates, 
  geometryType = "polygon",
  center,
  bounds,
  fileUrl,
  fileId,
  bucketId,
  height = 150,
  className = "",
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [isClient, setIsClient] = useState(false);
  const [L, setL] = useState(null);
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExpand = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsExpanded(false);
  }, []);

  useEffect(() => {
    setIsClient(true);
    // Cargar Leaflet dinámicamente solo en el cliente
    import("leaflet").then((leaflet) => {
      setL(leaflet.default);
    });
  }, []);

  // Cargar GeoJSON desde URL si no hay coordenadas directas
  useEffect(() => {
    if (!coordinates && fileUrl && isClient) {
      setLoading(true);
      setError(null);
      fetch(fileUrl)
        .then((res) => {
          if (!res.ok) throw new Error("Error al cargar GeoJSON");
          return res.json();
        })
        .then((data) => {
          setGeoJsonData(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error loading GeoJSON from URL:", err);
          setError(err.message);
          setLoading(false);
        });
    }
  }, [coordinates, fileUrl, isClient]);

  useEffect(() => {
    if (!isClient || !L || !mapRef.current || mapInstanceRef.current) return;
    
    // Esperar a que tengamos coordenadas o datos cargados del archivo
    const hasCoordinates = coordinates || geoJsonData;
    if (!hasCoordinates && fileUrl && loading) return; // Aún cargando

    // Crear el mapa
    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    });

    // Añadir capa de tiles (OpenStreetMap)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Función para añadir GeoJSON al mapa
    function addGeoJsonToMap(geoJson) {
      try {
        const layer = L.geoJSON(geoJson, {
          style: {
            color: "#3b82f6",
            weight: 2,
            fillColor: "#3b82f6",
            fillOpacity: 0.3,
          },
        }).addTo(map);

        // Ajustar la vista a los bounds
        const layerBounds = layer.getBounds();
        if (layerBounds.isValid()) {
          map.fitBounds(layerBounds, { padding: [10, 10] });
        } else if (center) {
          map.setView([center.latitude, center.longitude], 10);
        } else {
          map.setView([0, 0], 2);
        }
      } catch (e) {
        console.error("Error creating GeoJSON layer:", e);
        if (center) {
          map.setView([center.latitude, center.longitude], 10);
        } else {
          map.setView([0, 0], 2);
        }
      }
    }

    // Si tenemos datos cargados desde archivo
    if (geoJsonData) {
      addGeoJsonToMap(geoJsonData);
    }
    // Si tenemos coordenadas directas
    else if (coordinates) {
      // Determinar el tipo de geometría para GeoJSON
      let geoJsonType = "Polygon";
      if (geometryType === "multipolygon") geoJsonType = "MultiPolygon";
      else if (geometryType === "linestring") geoJsonType = "LineString";
      else if (geometryType === "point") geoJsonType = "Point";

      const geoJson = {
        type: "Feature",
        geometry: {
          type: geoJsonType,
          coordinates: coordinates,
        },
      };

      addGeoJsonToMap(geoJson);
    } else if (center) {
      map.setView([center.latitude, center.longitude], 10);
    } else {
      map.setView([0, 0], 2);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isClient, L, coordinates, center, bounds, geometryType, geoJsonData, loading]);

  if (!isClient || loading) {
    return (
      <div 
        className={`mini-map-placeholder ${className}`}
        style={{ height, backgroundColor: "#f0f0f0", borderRadius: "4px" }}
      >
        <span className="loading-text">Cargando mapa...</span>
      </div>
    );
  }

  return (
    <div className={`mini-map-container ${className}`} style={{ position: "relative" }}>
      <div 
        ref={mapRef} 
        className="mini-map"
        style={{ 
          height, 
          width: "100%", 
          borderRadius: "4px",
          overflow: "hidden",
        }}
      />
      <button
        className="mini-map-expand-btn"
        onClick={handleExpand}
        title="Expandir mapa para explorar"
        type="button"
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          background: "white",
          border: "1px solid #d1d5db",
          borderRadius: "4px",
          padding: "6px 8px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          zIndex: 1000,
          fontSize: "14px",
        }}
      >
        ⛶
      </button>
      {(fileUrl || fileId) && (
        <div className="mini-map-file-link">
          <a 
            href={fileUrl || `#file-${fileId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="file-link"
            title="Descargar archivo GeoJSON"
          >
            <span className="icon-download"></span>
            <span>Descargar GeoJSON</span>
          </a>
        </div>
      )}
      {isExpanded && L && (
        <ExpandedMap
          L={L}
          coordinates={coordinates}
          geometryType={geometryType}
          center={center}
          geoJsonData={geoJsonData}
          fileUrl={fileUrl}
          onClose={handleClose}
        />
      )}
    </div>
  );
}

// Exportar con dynamic import para evitar SSR
const MiniMap = dynamic(() => Promise.resolve(MiniMapInternal), {
  ssr: false,
  loading: () => (
    <div 
      className="mini-map-placeholder"
      style={{ height: 150, backgroundColor: "#f0f0f0", borderRadius: "4px" }}
    >
      <span className="loading-text">Cargando mapa...</span>
    </div>
  ),
});

export default MiniMap;
