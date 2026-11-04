import { cn, getFollowUpColors, getFollowUpLabel, RED_FLAG_EXPLANATION, type FollowUpStatus } from "@/lib/utils";

export default function FollowUpBadge({ status, className }: { status: FollowUpStatus; className?: string }) {
  const { badge, dot } = getFollowUpColors(status);
  const title = status === "RED_FLAG" || status === "WARNING" ? RED_FLAG_EXPLANATION : undefined;
  return (
    <span title={title} className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", badge, className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
      {getFollowUpLabel(status)}
    </span>
  );
}
