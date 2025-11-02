// src/ui/PixelCard.tsx
import React, { useEffect, useState } from "react";

const CARD_BG = "#12100d";
const EDGE = "#241c13";
const GLOW = "rgba(230,193,123,.06)";

export default function PixelCard({
  title,
  children,
  footer,
  style,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setInView(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const baseShadow =
    `0 12px 28px rgba(0,0,0,.35),
     inset 0 1px 0 rgba(255,255,255,.02),
     inset 0 0 0 2px ${GLOW}`;
  const hoverShadow =
    `0 18px 36px rgba(0,0,0,.45),
     inset 0 1px 0 rgba(255,255,255,.02),
     inset 0 0 0 2px rgba(230,193,123,.10)`;

  return (
    <div
      style={{
        position: "relative",
        background: CARD_BG,
        borderRadius: 14,
        padding: 14,
        border: `1px solid ${EDGE}`,
        boxShadow: baseShadow,
        transform: inView ? "translateY(0)" : "translateY(8px)",
        opacity: inView ? 1 : 0,
        transition: "opacity .6s ease, transform .6s ease, box-shadow .18s ease",
        willChange: "transform, opacity, box-shadow",
        overflow: "hidden",
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = hoverShadow;
        const ov = e.currentTarget.querySelector(".gg-pixel-overlay") as HTMLDivElement | null;
        if (ov) ov.style.opacity = "0.28";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = baseShadow;
        const ov = e.currentTarget.querySelector(".gg-pixel-overlay") as HTMLDivElement | null;
        if (ov) ov.style.opacity = "0.16";
      }}
    >
      {/* pixel corners */}
      <span style={corner(10, 10)} />
      <span style={corner(-10, 10, "right")} />
      <span style={corner(10, -10, "left", "bottom")} />
      <span style={corner(-10, -10, "right", "bottom")} />

      {/* pixel/scanline overlay */}
      <div
        className="gg-pixel-overlay"
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.16,
          background:
            // fine grid + subtle scanlines -> retro pixel feel
            `linear-gradient(0deg, rgba(255,255,255,.04) 1px, transparent 1px) 0 0 / 2px 2px,
             linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px) 0 0 / 2px 2px`,
          mixBlendMode: "overlay" as any,
          transition: "opacity .18s ease",
        }}
      />

      <div style={{ fontWeight: 900, marginBottom: 8, letterSpacing: 0.3, color: "#e6c17b" }}>
        {title}
      </div>
      <div style={{ opacity: .95, lineHeight: 1.6 }}>{children}</div>
      {footer && <div style={{ marginTop: 12 }}>{footer}</div>}
    </div>
  );
}

function corner(
  x = 10,
  y = 10,
  horiz: "left" | "right" = "left",
  vert: "top" | "bottom" = "top"
): React.CSSProperties {
  const sideX = horiz === "left" ? { left: 0 } : { right: 0 };
  const sideY = vert === "top" ? { top: 0 } : { bottom: 0 };
  return {
    position: "absolute",
    width: 6,
    height: 6,
    background: "#e6c17b",
    boxShadow: "0 0 8px rgba(230,193,123,.4)",
    transform: `translate(${x}px, ${y}px)`,
    borderRadius: 1,
    ...sideX,
    ...sideY,
    opacity: 0.85,
  };
}