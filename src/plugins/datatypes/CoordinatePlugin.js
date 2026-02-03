/**
 * Coordinate Plugin
 * 
 * Renderiza coordenadas geográficas (lat/long).
 */

const CoordinatePlugin = {
  name: "coordinate",
  datatypes: ["coordinate", "geo", "location", "point"],
  priority: 0,

  render(data, options = {}) {
    if (data === null || data === undefined) {
      return null;
    }

    let lat, lng;

    if (Array.isArray(data)) {
      [lat, lng] = data;
    } else if (typeof data === "object") {
      lat = data.latitude || data.lat;
      lng = data.longitude || data.lng || data.lon;
    } else {
      return String(data);
    }

    const latStr = this.formatCoordinate(lat, "N", "S");
    const lngStr = this.formatCoordinate(lng, "E", "W");

    return {
      type: "coordinate",
      latitude: lat,
      longitude: lng,
      display: `${latStr}, ${lngStr}`,
      mapUrl: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=12`,
    };
  },

  preview(data, options = {}) {
    const result = this.render(data, options);
    if (result && typeof result === "object") {
      return result.display;
    }
    return result;
  },

  formatCoordinate(value, positive, negative) {
    const abs = Math.abs(value);
    const direction = value >= 0 ? positive : negative;
    const degrees = Math.floor(abs);
    const minutes = Math.floor((abs - degrees) * 60);
    const seconds = ((abs - degrees - minutes / 60) * 3600).toFixed(1);
    return `${degrees}°${minutes}'${seconds}"${direction}`;
  },
};

export default CoordinatePlugin;
