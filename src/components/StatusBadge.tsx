import { cn, getStatusColors, getStatusLabel } from "@/lib/utils";

export default function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border", getStatusColors(status), className)}>
      {getStatusLabel(status)}
    </span>
  );
}
