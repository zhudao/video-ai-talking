import { useId } from "react";
import { cn } from "@/lib/cn";

export function BrandMark({ className }: { className?: string }) {
  const rawId = useId().replace(/:/g, "");
  const ink = `vat-ink-${rawId}`;
  const sheen = `vat-sheen-${rawId}`;

  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="口播"
      className={cn("size-8 shrink-0 text-primary", className)}
    >
      <defs>
        <linearGradient id={ink} x1="4" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4a6a86" />
          <stop offset="1" stopColor="#1d3348" />
        </linearGradient>
        <linearGradient id={sheen} x1="8" y1="6" x2="22" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${ink})`} />
      <rect width="32" height="32" rx="9" fill={`url(#${sheen})`} />
      <rect
        x="6.4"
        y="6.4"
        width="19.2"
        height="19.2"
        rx="3.6"
        fill="none"
        stroke="#f4f7fa"
        strokeWidth="2.5"
      />
      <rect x="10.8" y="14" width="2.1" height="4" rx="1.05" fill="#f4f7fa" />
      <rect x="14.95" y="11.2" width="2.1" height="9.6" rx="1.05" fill="#f4f7fa" />
      <rect x="19.1" y="13.1" width="2.1" height="5.8" rx="1.05" fill="#f4f7fa" />
    </svg>
  );
}
