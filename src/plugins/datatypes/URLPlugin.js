/**
 * URL Plugin
 * 
 * Renderiza URLs y enlaces.
 */

function getDisplayUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname + (parsed.pathname !== "/" ? parsed.pathname : "");
  } catch {
    return url.length > 50 ? url.substring(0, 50) + "..." : url;
  }
}

const URLPlugin = {
  name: "url",
  datatypes: ["url", "uri", "link"],
  priority: 0,

  render(data, options = {}) {
    if (data === null || data === undefined) {
      return null;
    }

    const url = String(data);
    const { fullValue } = options;
    const label = fullValue?.label || getDisplayUrl(url);

    return {
      type: "link",
      href: url,
      label: label,
      external: true,
    };
  },

  preview(data, options = {}) {
    if (data === null || data === undefined) {
      return null;
    }
    return getDisplayUrl(String(data));
  },

  getDisplayUrl,
};

export default URLPlugin;
