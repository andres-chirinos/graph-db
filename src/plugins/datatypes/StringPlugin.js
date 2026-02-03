/**
 * String Plugin
 * 
 * Renderiza valores de tipo string (texto simple).
 */

const StringPlugin = {
  name: "string",
  datatypes: ["string", "text"],
  priority: 0,

  render(data, options = {}) {
    if (data === null || data === undefined) {
      return null;
    }
    return String(data);
  },

  preview(data, options = {}) {
    if (data === null || data === undefined) {
      return null;
    }
    const str = String(data);
    const maxLength = options.maxLength || 100;
    return str.length > maxLength ? str.substring(0, maxLength) + "..." : str;
  },
};

export default StringPlugin;
