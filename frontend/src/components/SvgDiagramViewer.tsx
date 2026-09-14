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
} from "lucide-react";

interface SvgDiagramViewerProps {
  svgContent: string;
  index?: number;
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.2;

export const SvgDiagramViewer: React.FC<SvgDiagramViewerProps> = ({
  svgContent,
  index = 0,
}) => {
  const [scale, setScale] = useState<number>(1.0);
  const [copied, setCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-clean raw SVG: fix unescaped ampersands inside SVG text elements that break XML parsers
  const cleanSvg = useMemo(() => {
    if (!svgContent) return "";
    return svgContent.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#[xX][0-9a-fA-F]+);)/g, "&amp;");
  }, [svgContent]);

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
        overflow: "hidden",
        position: isFullscreen ? "fixed" : "relative",
        top: isFullscreen ? 0 : undefined,
        left: isFullscreen ? 0 : undefined,
        width: isFullscreen ? "100vw" : "100%",
        height: isFullscreen ? "100vh" : "auto",
        zIndex: isFullscreen ? 99999 : "auto",
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
          userSelect: "none",
          gap: 8,
          flexWrap: "nowrap",
          overflowX: "auto",
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
