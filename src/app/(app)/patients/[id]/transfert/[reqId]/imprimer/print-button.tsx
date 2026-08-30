"use client";

export function PrintButton() {
  return (
    <button className="btn-primary" onClick={() => window.print()}>
      Imprimer / PDF
    </button>
  );
}
