import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ensureTag, getTags, type CrmTag } from "@/lib/crm";

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

export default function TagAutocomplete({ value, onChange, disabled }: Props) {
  const [allTags, setAllTags] = useState<CrmTag[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => { getTags().then(setAllTags).catch(() => {}); }, []);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allTags
      .filter((t) => !value.includes(t.name))
      .filter((t) => !q || t.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [allTags, query, value]);

  const add = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || value.includes(trimmed)) return;
    await ensureTag(trimmed);
    onChange([...value, trimmed]);
    setQuery("");
    setOpen(false);
    getTags().then(setAllTags).catch(() => {});
  };

  const remove = (name: string) => onChange(value.filter((t) => t !== name));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {t}
            {!disabled && (
              <button type="button" onClick={() => remove(t)} className="hover:text-red-600"><X className="w-3 h-3" /></button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="relative">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add(query);
              }
            }}
            placeholder="Type to search or create tag…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {open && (suggestions.length > 0 || query.trim()) && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map((t) => (
                <button key={t.id} type="button" onClick={() => void add(t.name)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between">
                  <span>{t.name}</span>
                  <span className="text-xs text-gray-400">{t.usageCount}</span>
                </button>
              ))}
              {query.trim() && !suggestions.some((t) => t.name.toLowerCase() === query.trim().toLowerCase()) && (
                <button type="button" onClick={() => void add(query)}
                  className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50">
                  Create “{query.trim()}”
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
