/**
 * BrandHexLogo — the gradient-border hex monogram from the auth screen,
 * extracted so the sidebar/header use the same mark as /login.
 */
import { BRAND } from "@/lib/brand";

const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

interface BrandHexLogoProps {
  /** Height in px. Width is auto (sqrt(3)/2 * height). */
  size?: number;
  className?: string;
}

export function BrandHexLogo({ size = 42, className }: BrandHexLogoProps) {
  const h = size;
  const w = Math.round((Math.sqrt(3) / 2) * h * 10) / 10;
  const mono = Math.round(h * 0.42);
  return (
    <span
      className={`group relative grid place-items-center shrink-0${className ? ` ${className}` : ""}`}
      style={{ height: h, width: w }}
      aria-label={BRAND.name}
    >
      {/* Outer glow */}
      <span
        aria-hidden
        className="absolute inset-0 opacity-70 blur-md transition-opacity duration-500 group-hover:opacity-100"
        style={{
          clipPath: HEX_CLIP,
          background:
            "conic-gradient(from 140deg, oklch(0.6 0.23 27), oklch(0.45 0.17 25), oklch(0.6 0.2 293), oklch(0.6 0.23 27))",
        }}
      />
      {/* Gradient border hex */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          clipPath: HEX_CLIP,
          background:
            "linear-gradient(140deg, oklch(0.6 0.23 27), oklch(0.45 0.17 25) 50%, oklch(0.6 0.2 293))",
        }}
      />
      {/* Inner dark hex face */}
      <span
        aria-hidden
        className="absolute inset-[1.5px]"
        style={{
          clipPath: HEX_CLIP,
          background:
            "linear-gradient(155deg, oklch(0.18 0.02 270) 0%, oklch(0.1 0.015 270) 100%)",
          boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.12)",
        }}
      />
      {/* Specular sheen */}
      <span
        aria-hidden
        className="absolute inset-[1.5px] opacity-60"
        style={{
          clipPath: HEX_CLIP,
          background:
            "linear-gradient(160deg, oklch(1 0 0 / 0.18) 0%, transparent 45%)",
        }}
      />
      {/* Vila da Folha (Konoha) leaf symbol */}
      <svg
        viewBox="0 0 24 24"
        className="relative"
        style={{ height: mono, width: mono }}
        aria-hidden
      >
        <defs>
          <linearGradient id="brand-hex-m-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.95 0.02 27)" />
            <stop offset="100%" stopColor="oklch(0.68 0.22 27)" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#brand-hex-m-grad)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {/* leaf outline with tip at top-right */}
          <path d="M19.5 4.5C20.5 11 17.5 19.5 11.5 19.5C7.4 19.5 4.5 16.4 4.5 12.8C4.5 9 7.6 6.2 11.4 6.2C14.5 6.2 17 5.4 19.5 4.5Z" />
          {/* inner spiral */}
          <path d="M11.6 13.2a.9.9 0 1 1 .9-1.1a2.3 2.3 0 1 1-3.5 2.1a3.6 3.6 0 0 1 3-4.6" />
          {/* stem */}
          <path d="M6.2 17.8L3 21" />
        </g>

      </svg>
    </span>
  );
}
