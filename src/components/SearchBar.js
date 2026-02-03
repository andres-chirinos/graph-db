"use client";

import { useState } from "react";

/**
 * Barra de búsqueda de entidades estilo Wikidata
 */
export default function SearchBar({ onSearch, placeholder = "Buscar entidades..." }) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      await onSearch(query.trim());
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="search-bar">
      <div className="search-input-wrapper">
        <span className="search-icon icon-search"></span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="search-input"
          disabled={isSearching}
        />
        <button
          type="submit"
          className="search-button"
          disabled={isSearching || !query.trim()}
        >
          {isSearching ? (
            <span className="icon-loader animate-spin"></span>
          ) : (
            "Buscar"
          )}
        </button>
      </div>
    </form>
  );
}
