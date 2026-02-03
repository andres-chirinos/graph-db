/**
 * Polygon Plugin
 * 
 * Renderiza polígonos y formas geométricas.
 */

const PolygonPlugin = {
  name: "polygon",
  datatypes: ["polygon", "multipolygon", "linestring", "geometry"],
  priority: 0,

  render(data, options = {}) {
    if (data === null || data === undefined) {
      return null;
    }

    const { datatype } = options;

    // Validar que sea un array de coordenadas
    if (!Array.isArray(data)) {
      return String(data);
    }

    // Calcular el centro del polígono para mostrar en mapa
    const center = this.calculateCenter(data);
    const bounds = this.calculateBounds(data);

    return {
      type: "geometry",
      geometryType: datatype,
      coordinates: data,
      center,
      bounds,
      pointCount: this.countPoints(data),
    };
  },

  preview(data, options = {}) {
    const result = this.render(data, options);
    if (result && typeof result === "object") {
      return `Polígono (${result.pointCount} puntos)`;
    }
    return result;
  },

  calculateCenter(coords) {
    const points = this.flattenPoints(coords);
    if (points.length === 0) return null;

    const sum = points.reduce(
      (acc, [lng, lat]) => {
        acc.lat += lat;
        acc.lng += lng;
        return acc;
      },
      { lat: 0, lng: 0 }
    );

    return {
      latitude: sum.lat / points.length,
      longitude: sum.lng / points.length,
    };
  },

  calculateBounds(coords) {
    const points = this.flattenPoints(coords);
    if (points.length === 0) return null;

    let minLat = Infinity,
      maxLat = -Infinity,
      minLng = Infinity,
      maxLng = -Infinity;

    for (const [lng, lat] of points) {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }

    return {
      minLatitude: minLat,
      maxLatitude: maxLat,
      minLongitude: minLng,
      maxLongitude: maxLng,
    };
  },

  flattenPoints(coords) {
    const points = [];

    function flatten(arr) {
      if (arr.length === 2 && typeof arr[0] === "number" && typeof arr[1] === "number") {
        points.push(arr);
      } else if (Array.isArray(arr)) {
        for (const item of arr) {
          flatten(item);
        }
      }
    }

    flatten(coords);
    return points;
  },

  countPoints(coords) {
    return this.flattenPoints(coords).length;
  },
};

export default PolygonPlugin;
