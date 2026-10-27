import { useEffect, useRef, useState } from "react";
import type { CatalogProduct } from "@/lib/crm";

export interface ProductChoice {
  productId: string;
  productName: string;
  color: string;
  requiresPoc: boolean;
}

export default function ProductMultiSelect({
  catalog,
  value,
  onChange,
}: {
  catalog: CatalogProduct[];
  value: ProductChoice[];
  onChange: (next: ProductChoice[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const toggle = (p: CatalogProduct) => {
    const exists = value.some((x) => x.productId === p.id);
    if (exists) onChange(value.filter((x) => x.productId !== p.id));
    else onChange([...value, { productId: p.id, productName: p.name, color: p.color, requiresPoc: false }]);
  };

  const label = value.length ? value.map((p) => p.productName).join(", ") : "Select products…";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white text-left flex items-center justify-between gap-2"
        aria-expanded={open}
      >
        <span className={value.length ? "text-slate-900 truncate" : "text-slate-400 truncate"}>{label}</span>
        <span className="text-slate-400 text-xs">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg p-1">
          {catalog.length === 0 && (
            <p className="text-xs text-slate-500 px-2 py-2">No products in the catalog yet.</p>
          )}
          {catalog.map((p) => {
            const on = value.some((x) => x.productId === p.id);
            return (
              <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 text-sm cursor-pointer">
                <input type="checkbox" checked={on} onChange={() => toggle(p)} />
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <span className="truncate">{p.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
