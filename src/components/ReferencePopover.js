// src/components/ReferencePopover.js
"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import ValueRenderer from "./ValueRenderer"; // Assuming ValueRenderer might be useful for details

export default function ReferencePopover({ references, onClose }) {
  const popoverRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        onClose();
      }
    }
    // Bind the event listener
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  if (!references || references.length === 0) return null;

  return (
    <div ref={popoverRef} className="reference-popover">
      <div className="reference-popover-header">
        <h3>Referencias</h3>
        <button type="button" onClick={onClose} className="btn-close-popover">
          X
        </button>
      </div>
      <div className="reference-popover-content">
        {references.map((ref) => (
          <div key={ref.$id} className="reference-popover-item">
            {ref.reference && (
              <p>
                Referencia a: <Link href={`/entity/${ref.reference.$id}`}>{ref.reference.label || ref.reference.$id}</Link>
              </p>
            )}
            {ref.details && (
              <p>
                Detalles: <ValueRenderer value={ref.details} datatype="string" compact />
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
