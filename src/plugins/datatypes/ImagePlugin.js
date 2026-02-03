/**
 * Image Plugin
 * 
 * Renderiza URLs de imágenes.
 */

const ImagePlugin = {
  name: "image",
  datatypes: ["image", "photo", "picture", "media"],
  priority: 0,

  render(data, options = {}) {
    if (data === null || data === undefined) {
      return null;
    }

    const { fullValue } = options;
    const url = typeof data === "string" ? data : data.url;
    const alt = fullValue?.alt || fullValue?.label || "Image";
    const caption = fullValue?.caption;

    return {
      type: "image",
      url,
      alt,
      caption,
      thumbnail: this.getThumbnailUrl(url),
    };
  },

  preview(data, options = {}) {
    if (data === null || data === undefined) {
      return null;
    }
    const url = typeof data === "string" ? data : data.url;
    return {
      type: "image-thumbnail",
      url: this.getThumbnailUrl(url),
    };
  },

  getThumbnailUrl(url) {
    // Si es una URL de Commons, generar thumbnail
    if (url.includes("commons.wikimedia.org")) {
      return url.replace("/commons/", "/commons/thumb/") + "/120px-thumbnail.jpg";
    }
    return url;
  },
};

export default ImagePlugin;
