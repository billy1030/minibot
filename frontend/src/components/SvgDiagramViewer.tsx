import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Download,
  Palette,
} from "lucide-react";

interface SvgDiagramViewerProps {
  svgContent: string;
  index?: number;
}

export type SvgThemeMode = "clean-light" | "warm-paper" | "dark-slate" | "original";

export interface SvgThemeOption {
  id: SvgThemeMode;
  name: string;
  dotColor: string;
  description: string;
}

export const SVG_THEME_OPTIONS: SvgThemeOption[] = [
  { id: "clean-light", name: "☀️ Clean Light (Default)", dotColor: "#2563eb", description: "Pure white canvas & high-contrast navy" },
  { id: "warm-paper", name: "📜 Warm Paper", dotColor: "#b45309", description: "Ivory cream canvas & warm editorial tones" },
  { id: "dark-slate", name: "🌙 Dark Slate", dotColor: "#38bdf8", description: "Executive dark slate canvas & neon accents" },
  { id: "original", name: "Original Source", dotColor: "#94a3b8", description: "Preserve raw generated SVG colors" },
];

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.2;

/**
 * Robust DOM-based SVG recoloring across Light, Warm Paper, and Dark themes.
 * Uses exact DOM element tag inspection so backgrounds and text are never confused or cross-replaced.
 */
function recolorSvg(rawSvg: string, theme: SvgThemeMode): string {
  if (theme === "original" || !rawSvg) return rawSvg;
  if (typeof DOMParser === "undefined") return rawSvg;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawSvg, "image/svg+xml");
    const svgEl = doc.querySelector("svg");
    if (!svgEl) return rawSvg;

    const darkCanvases = new Set(["#0b0f19", "#0d1117", "#0f172a", "#05070f", "#000000", "#000"]);
    const darkSurfaces = new Set(["#111827", "#1e293b", "#1f2937", "#0d1326", "#182234", "#1a2332", "#374151"]);
    const lightCanvases = new Set(["#ffffff", "#fff", "#f8fafc", "#fcfbf7", "#fafaf9", "#f1f5f9"]);
    const lightSurfaces = new Set(["#f6f1e5", "#ede4d1", "#e2e8f0", "#e0f2fe", "#f0fdf4", "#fef3c7"]);

    const allElements = doc.querySelectorAll("*");

    allElements.forEach((el) => {
      const tagName = el.tagName.toLowerCase();
      const fill = (el.getAttribute("fill") || "").toLowerCase().trim();
      const stroke = (el.getAttribute("stroke") || "").toLowerCase().trim();

      if (theme === "clean-light") {
        // --- CLEAN LIGHT THEME ---
        if (tagName === "text" || tagName === "tspan") {
          // Comprehensive color-contrast mapping: all text must have crisp contrast against white/light backgrounds
          if (
            fill === "#ffffff" || fill === "#fff" || fill === "#f8fafc" ||
            fill === "#f1f5f9" || fill === "#e2e8f0"
          ) {
            // Main body and titles -> Deep High-Contrast Navy
            el.setAttribute("fill", "#0f172a");
          } else if (fill === "#94a3b8" || fill === "#cbd5e1" || fill === "#64748b") {
            // Secondary / muted text -> Rich Slate (never washed out)
            el.setAttribute("fill", "#334155");
          } else if (
            fill === "#fca5a5" || fill === "#fecaca" || fill === "#f87171" ||
            fill === "#ef4444" || fill === "#e11d48" || fill === "#dc2626"
          ) {
            // Red / SPOF / Warning badges -> Bold Deep Crimson
            el.setAttribute("fill", "#991b1b");
            el.setAttribute("font-weight", "700");
          } else if (
            fill === "#fcd34d" || fill === "#fef3c7" || fill === "#fbbf24" ||
            fill === "#f59e0b" || fill === "#d97706" || fill === "#eab308"
          ) {
            // Amber / 准SPOF / Tier 2 badges -> Deep Dark Bronze/Amber
            el.setAttribute("fill", "#854d0e");
            el.setAttribute("font-weight", "700");
          } else if (
            fill === "#bbf7d0" || fill === "#86efac" || fill === "#34d399" ||
            fill === "#10b981" || fill === "#059669"
          ) {
            // Green / Tier 1 / OK badges -> Deep Forest Emerald
            el.setAttribute("fill", "#065f46");
            el.setAttribute("font-weight", "700");
          } else if (fill === "#67e8f9" || fill === "#38bdf8" || fill === "#0ea5e9" || fill === "#0284c7") {
            // Blue / Cyan badges -> Deep Navy Cyan
            el.setAttribute("fill", "#0369a1");
            el.setAttribute("font-weight", "700");
          }
        } else if (tagName === "rect") {
          // Canvas or section background
          if (darkCanvases.has(fill)) {
            el.setAttribute("fill", "#ffffff");
          } else if (darkSurfaces.has(fill)) {
            el.setAttribute("fill", "#f8fafc");
          } else if (fill === "#064e3b") {
            // Dark green container -> Crisp soft emerald badge with visible border
            el.setAttribute("fill", "#ecfdf5");
            el.setAttribute("stroke", "#059669");
            el.setAttribute("stroke-width", "1.5");
          } else if (fill === "#78350f") {
            // Dark amber container -> Soft warm amber badge with visible border
            el.setAttribute("fill", "#fffbeb");
            el.setAttribute("stroke", "#d97706");
            el.setAttribute("stroke-width", "1.5");
          } else if (fill === "#7f1d1d") {
            // Dark red container -> Soft rose badge with visible border
            el.setAttribute("fill", "#fef2f2");
            el.setAttribute("stroke", "#e11d48");
            el.setAttribute("stroke-width", "1.5");
          }

          if (stroke === "#1e293b" || stroke === "#374151" || stroke === "#475569" || stroke === "#0d1117") {
            el.setAttribute("stroke", "#cbd5e1");
          }
        } else if (tagName === "path" || tagName === "line") {
          if (stroke === "#1e293b" || stroke === "#374151" || stroke === "#475569") {
            el.setAttribute("stroke", "#94a3b8");
          }
        }
      } else if (theme === "warm-paper") {
        // --- WARM EDITORIAL PAPER THEME ---
        if (tagName === "text" || tagName === "tspan") {
          if (
            fill === "#ffffff" || fill === "#fff" || fill === "#f8fafc" ||
            fill === "#f1f5f9" || fill === "#e2e8f0"
          ) {
            el.setAttribute("fill", "#1c1917"); // Warm deep stone
          } else if (fill === "#94a3b8" || fill === "#cbd5e1" || fill === "#64748b") {
            el.setAttribute("fill", "#44403c"); // Dark warm slate
          } else if (
            fill === "#fca5a5" || fill === "#fecaca" || fill === "#f87171" ||
            fill === "#ef4444" || fill === "#e11d48"
          ) {
            el.setAttribute("fill", "#7f1d1d"); // Deep mahogany red
            el.setAttribute("font-weight", "700");
          } else if (
            fill === "#fcd34d" || fill === "#fef3c7" || fill === "#fbbf24" ||
            fill === "#f59e0b" || fill === "#d97706"
          ) {
            el.setAttribute("fill", "#78350f"); // Deep bronze
            el.setAttribute("font-weight", "700");
          } else if (
            fill === "#bbf7d0" || fill === "#86efac" || fill === "#34d399" ||
            fill === "#10b981" || fill === "#059669"
          ) {
            el.setAttribute("fill", "#064e3b"); // Deep forest moss
            el.setAttribute("font-weight", "700");
          } else if (fill === "#67e8f9" || fill === "#38bdf8" || fill === "#0ea5e9") {
            el.setAttribute("fill", "#0c4a6e"); // Deep ink cyan
            el.setAttribute("font-weight", "700");
          }
        } else if (tagName === "rect") {
          if (darkCanvases.has(fill)) {
            el.setAttribute("fill", "#fcfbf7"); // Warm cream canvas
          } else if (darkSurfaces.has(fill)) {
            el.setAttribute("fill", "#f6f1e5"); // Warmer container
          } else if (fill === "#064e3b" || fill === "#78350f" || fill === "#7f1d1d") {
            el.setAttribute("fill", "#ede4d1");
          }

          if (stroke === "#1e293b" || stroke === "#374151" || stroke === "#475569" || stroke === "#e2e8f0") {
            el.setAttribute("stroke", "#dcd1ba");
          }
        } else if (tagName === "path" || tagName === "line") {
          if (stroke === "#1e293b" || stroke === "#374151" || stroke === "#475569") {
            el.setAttribute("stroke", "#b8ac95");
          }
        }
      } else if (theme === "dark-slate") {
        // --- SLEEK DARK SLATE THEME ---
        if (tagName === "text" || tagName === "tspan") {
          if (
            fill === "#0f172a" || fill === "#1e293b" || fill === "#292524" ||
            fill === "#0c4a6e" || fill === "#334155" || fill === "#44403c" ||
            fill === "#475569" || fill === "#1c1917"
          ) {
            el.setAttribute("fill", "#f8fafc");
          } else if (fill === "#64748b" || fill === "#78716c" || fill === "#57534e") {
            el.setAttribute("fill", "#94a3b8");
          }
        } else if (tagName === "rect") {
          if (lightCanvases.has(fill)) {
            el.setAttribute("fill", "#0b0f19");
          } else if (lightSurfaces.has(fill) || fill === "#ecfdf5" || fill === "#fffbeb" || fill === "#fef2f2") {
            el.setAttribute("fill", "#111827");
          }

          if (stroke === "#e2e8f0" || stroke === "#e7dec8" || stroke === "#cbd5e1" || stroke === "#dcd1ba") {
            el.setAttribute("stroke", "#374151");
          }
        }
      }
    });

    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgEl);
  } catch (err) {
    console.warn("[SvgDiagramViewer] DOM recoloring failed, using raw SVG:", err);
    return rawSvg;
  }
}

export const SvgDiagramViewer: React.FC<SvgDiagramViewerProps> = ({
  svgContent,
  index = 0,
}) => {
  const [scale, setScale] = useState<number>(1.0);
  const [copied, setCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activeTheme, setActiveTheme] = useState<SvgThemeMode>("clean-light");
  const [showThemeMenu, setShowThemeMenu] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // Close theme dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false);
      }
    };
    if (showThemeMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showThemeMenu]);

  // Auto-clean raw SVG: ensure strict <svg> bounds and fix unescaped ampersands
  const cleanSvg = useMemo(() => {
    if (!svgContent) return "";
    const startIdx = svgContent.indexOf("<svg");
    const endIdx = svgContent.lastIndexOf("</svg>");
    let isolated = startIdx !== -1 && endIdx !== -1 ? svgContent.slice(startIdx, endIdx + 6) : svgContent;
    isolated = isolated.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#[xX][0-9a-fA-F]+);)/g, "&amp;");
    return recolorSvg(isolated, activeTheme);
  }, [svgContent, activeTheme]);

  const zoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale((prev) => Math.min(MAX_ZOOM, Number((prev + ZOOM_STEP).toFixed(2))));
  };

  const zoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale((prev) => Math.max(MIN_ZOOM, Number((prev - ZOOM_STEP).toFixed(2))));
  };

  const resetZoom = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale(1.0);
    setPan({ x: 0, y: 0 });
  };

  const handleCopySvg = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(cleanSvg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy SVG source:", err);
    }
  };

  const handleDownloadSvg = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const blob = new Blob([cleanSvg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `diagram-${index + 1}-${Date.now()}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download SVG:", err);
    }
  };

  // Drag-to-pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only primary button
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  return (
    <div
      ref={containerRef}
      style={{
        margin: "1.25rem 0",
        borderRadius: 12,
        border: "1px solid var(--border-color, #e2e8f0)",
        background: "var(--bg-secondary, #ffffff)",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.06)",
        overflow: "visible",
        position: isFullscreen ? "fixed" : "relative",
        top: isFullscreen ? 0 : undefined,
        left: isFullscreen ? 0 : undefined,
        width: isFullscreen ? "100vw" : "100%",
        height: isFullscreen ? "100vh" : "auto",
        zIndex: isFullscreen ? 99999 : 10,
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.2s ease",
      }}
    >
      {/* Top Floating Control Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          background: "var(--bg-card, #f8fafc)",
          borderBottom: "1px solid var(--border-color, #e2e8f0)",
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          userSelect: "none",
          gap: 8,
          flexWrap: "wrap",
          overflow: "visible",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              padding: "2px 7px",
              borderRadius: 5,
              background: "rgba(2, 132, 199, 0.12)",
              color: "#0284c7",
              border: "1px solid rgba(2, 132, 199, 0.25)",
              whiteSpace: "nowrap",
            }}
          >
            EDITORIAL SVG
          </span>
          {scale !== 1.0 && (
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted, #64748b)",
                fontFamily: "monospace",
                whiteSpace: "nowrap",
              }}
            >
              (Drag canvas to pan)
            </span>
          )}
        </div>

        {/* Action Controls: Zoom Out, Percentage, Zoom In, Reset, Fullscreen, Copy, Download */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {/* Zoom Control Group */}
          <div
            style={{
              height: 28,
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              background: "var(--bg-secondary, #ffffff)",
              border: "1px solid var(--border-color, #cbd5e1)",
              borderRadius: 8,
              padding: "0 4px",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={zoomOut}
              disabled={scale <= MIN_ZOOM}
              title="Zoom out (Reduct)"
              style={{
                background: "transparent",
                border: "none",
                cursor: scale <= MIN_ZOOM ? "not-allowed" : "pointer",
                padding: "2px 6px",
                display: "inline-flex",
                alignItems: "center",
                color: "var(--text-main, #334155)",
                opacity: scale <= MIN_ZOOM ? 0.4 : 1,
              }}
            >
              <ZoomOut size={14} />
            </button>

            <button
              type="button"
              onClick={resetZoom}
              title="Reset Zoom to 100%"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "monospace",
                fontSize: 11.5,
                fontWeight: 700,
                color: scale !== 1.0 ? "#0284c7" : "var(--text-main, #334155)",
                minWidth: 44,
                textAlign: "center",
                padding: "0 2px",
              }}
            >
              {Math.round(scale * 100)}%
            </button>

            <button
              type="button"
              onClick={zoomIn}
              disabled={scale >= MAX_ZOOM}
              title="Zoom in (Enlarge)"
              style={{
                background: "transparent",
                border: "none",
                cursor: scale >= MAX_ZOOM ? "not-allowed" : "pointer",
                padding: "2px 6px",
                display: "inline-flex",
                alignItems: "center",
                color: "var(--text-main, #334155)",
                opacity: scale >= MAX_ZOOM ? 0.4 : 1,
              }}
            >
              <ZoomIn size={14} />
            </button>

            <button
              type="button"
              onClick={resetZoom}
              title="Reset view"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "2px 5px",
                display: "inline-flex",
                alignItems: "center",
                color: "var(--text-muted, #64748b)",
              }}
            >
              <RotateCcw size={12} />
            </button>
          </div>

          {/* Dynamic Theme Switcher Dropdown */}
          <div style={{ position: "relative" }} ref={themeMenuRef}>
            <button
              type="button"
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              title="Change SVG Color Theme dynamically"
              style={{
                height: 28,
                padding: "0 8px",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                borderRadius: 7,
                border: "1px solid var(--border-color, #cbd5e1)",
                background: "var(--bg-secondary, #ffffff)",
                color: activeTheme !== "original" ? "#0284c7" : "var(--text-main, #475569)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <Palette size={13} color={SVG_THEME_OPTIONS.find((t) => t.id === activeTheme)?.dotColor || "#0284c7"} />
              <span>{SVG_THEME_OPTIONS.find((t) => t.id === activeTheme)?.name.replace(/^[^\s]+\s*/, "") || "Theme"}</span>
            </button>

            {showThemeMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 4,
                  width: 210,
                  background: "var(--bg-secondary, #ffffff)",
                  border: "1px solid var(--border-color, #cbd5e1)",
                  borderRadius: 8,
                  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)",
                  padding: "4px",
                  zIndex: 100000,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <div style={{ padding: "4px 8px 2px", fontSize: 10, fontWeight: 700, color: "var(--text-muted, #64748b)", textTransform: "uppercase" }}>
                  Color Theme
                </div>
                {SVG_THEME_OPTIONS.map((themeOpt) => {
                  const isSelected = activeTheme === themeOpt.id;
                  return (
                    <button
                      key={themeOpt.id}
                      type="button"
                      onClick={() => {
                        setActiveTheme(themeOpt.id);
                        setShowThemeMenu(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "none",
                        background: isSelected ? "rgba(2, 132, 199, 0.1)" : "transparent",
                        color: isSelected ? "#0284c7" : "var(--text-main, #334155)",
                        cursor: "pointer",
                        fontSize: 11.5,
                        fontWeight: isSelected ? 700 : 500,
                        textAlign: "left",
                        width: "100%",
                        transition: "background 0.15s ease",
                      }}
                    >
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: "50%",
                          background: themeOpt.dotColor,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                        <span>{themeOpt.name}</span>
                        <span style={{ fontSize: 9.5, color: "var(--text-muted, #94a3b8)", fontWeight: 400 }}>
                          {themeOpt.description}
                        </span>
                      </div>
                      {isSelected && <Check size={12} color="#0284c7" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Expand to Fullscreen"}
            style={{
              height: 28,
              width: 28,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 7,
              border: "1px solid var(--border-color, #cbd5e1)",
              background: "var(--bg-secondary, #ffffff)",
              color: "var(--text-main, #475569)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {/* Copy SVG Raw Code */}
          <button
            type="button"
            onClick={handleCopySvg}
            title="Copy SVG XML Source"
            style={{
              height: 28,
              padding: "0 8px",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              borderRadius: 7,
              border: "1px solid var(--border-color, #cbd5e1)",
              background: "var(--bg-secondary, #ffffff)",
              color: copied ? "#10b981" : "var(--text-main, #475569)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            <span>{copied ? "Copied" : "Copy SVG"}</span>
          </button>

          {/* Download SVG Button */}
          <button
            type="button"
            onClick={handleDownloadSvg}
            title="Download SVG file"
            style={{
              height: 28,
              width: 28,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 7,
              border: "1px solid var(--border-color, #cbd5e1)",
              background: "var(--bg-secondary, #ffffff)",
              color: "var(--text-main, #475569)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Download size={13} />
          </button>
        </div>
      </div>

      {/* SVG Canvas Area with zoom and pan transform */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          width: "100%",
          flex: 1,
          overflow: "auto",
          padding: 16,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#ffffff",
          cursor: isDragging ? "grabbing" : scale > 1.0 ? "grab" : "default",
          minHeight: isFullscreen ? "calc(100vh - 45px)" : 280,
          userSelect: "none",
        }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.15s ease-out",
            display: "inline-flex",
            justifyContent: "center",
            alignItems: "center",
            maxWidth: "100%",
            width: "100%",
          }}
          dangerouslySetInnerHTML={{ __html: cleanSvg }}
        />
      </div>
    </div>
  );
};
