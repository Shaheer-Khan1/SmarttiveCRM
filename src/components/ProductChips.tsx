export default function ProductChips({
  products,
  solution,
}: {
  products?: { id?: string; productName: string; color?: string }[];
  solution?: string | null;
}) {
  const items = products?.length
    ? products.map((p) => ({ key: p.id || p.productName, name: p.productName, color: p.color }))
    : (solution || "").split(",").map((s) => s.trim()).filter(Boolean).map((name) => ({
      key: name,
      name,
      color: undefined as string | undefined,
    }));
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {items.slice(0, 4).map((p) => (
        <span
          key={p.key}
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${p.color ? "text-white border-transparent" : "bg-slate-100 text-slate-600 border-slate-200"}`}
          style={p.color ? { background: p.color } : undefined}
        >
          {p.name}
        </span>
      ))}
    </div>
  );
}
