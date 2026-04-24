import { useState } from "react";
import { Star } from "lucide-react";
import { Link } from "wouter";

interface Props {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readonly?: boolean;
  count?: number;
  showCount?: boolean;
  showAvg?: boolean;
  emptyLabel?: string;
  className?: string;
  profileLinkUserId?: number;
}

export function StarRating({
  value,
  onChange,
  size = 16,
  readonly = true,
  count = 0,
  showCount = true,
  showAvg = true,
  emptyLabel = "Nouveau vendeur",
  className = "",
  profileLinkUserId,
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;

  const stars = [1, 2, 3, 4, 5].map((i) => {
    const filled = i <= Math.round(display);
    return (
      <button
        key={i}
        type="button"
        disabled={readonly}
        onMouseEnter={() => !readonly && setHover(i)}
        onMouseLeave={() => !readonly && setHover(null)}
        onClick={() => !readonly && onChange?.(i)}
        className={readonly ? "cursor-default" : "cursor-pointer"}
        aria-label={`${i} étoile${i > 1 ? "s" : ""}`}
        data-testid={`star-${i}`}
      >
        <Star
          style={{ width: size, height: size }}
          fill={filled ? "#16a34a" : "transparent"}
          stroke={filled ? "#16a34a" : "#d1d5db"}
          strokeWidth={1.5}
        />
      </button>
    );
  });

  const isEmpty = count === 0 && readonly;

  if (isEmpty && readonly) {
    return (
      <span className={`text-xs text-muted-foreground italic ${className}`}>
        {emptyLabel}
      </span>
    );
  }

  const inner = (
    <span className={`inline-flex items-center gap-1 ${className}`} data-testid="star-rating">
      <span className="inline-flex items-center gap-0.5">{stars}</span>
      {readonly && showAvg && count > 0 && (
        <span className="text-xs font-medium text-foreground">
          {value.toFixed(1)}
        </span>
      )}
      {readonly && showCount && count > 0 && (
        <span className="text-xs text-muted-foreground">
          · {count} avis
        </span>
      )}
    </span>
  );

  if (readonly && profileLinkUserId) {
    return (
      <Link
        href={`/profil/${profileLinkUserId}`}
        className="hover:opacity-80 transition-opacity"
        data-testid={`link-profile-${profileLinkUserId}`}
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
