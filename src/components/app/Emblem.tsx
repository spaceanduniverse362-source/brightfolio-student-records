import emblemLight from "@/assets/emblem-light.png.asset.json";
import emblemInk from "@/assets/emblem-ink.png.asset.json";
import emblemPhoto from "@/assets/emblem.jpg.asset.json";
import { cn } from "@/lib/utils";

export const EMBLEM_INK_URL = emblemInk.url;

export function Emblem({
  variant = "badge",
  className,
}: {
  variant?: "badge" | "light" | "ink";
  className?: string;
}) {
  if (variant === "badge") {
    return (
      <img
        src={emblemPhoto.url}
        alt="Burka Harbu Special Secondary School emblem"
        className={cn("rounded-full ring-1 ring-gold/50", className)}
      />
    );
  }
  return (
    <img
      src={variant === "light" ? emblemLight.url : emblemInk.url}
      alt="Burka Harbu Special Secondary School emblem"
      className={className}
    />
  );
}
