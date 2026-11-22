import { UserRound } from "lucide-react";
import { usePhotoUrl } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function StudentPhoto({
  path,
  name,
  className,
  paper,
}: {
  path: string | null | undefined;
  name: string;
  className?: string;
  paper?: boolean;
}) {
  const { data: url } = usePhotoUrl(path);
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden",
        paper ? "border border-paper-border bg-paper-tint" : "rounded-full bg-muted ring-1 ring-glass-border",
        className,
      )}
    >
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <UserRound className={cn("h-1/2 w-1/2", paper ? "text-paper-muted" : "text-muted-foreground")} />
      )}
    </div>
  );
}
