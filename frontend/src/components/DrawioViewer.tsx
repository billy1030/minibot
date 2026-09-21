import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  ExternalLink,
  Code,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import { extractDrawioXml, createDiagramsNetEditUrl } from '../utils/drawioHelper';

interface DrawioViewerProps {
  xml: string;
  index?: number;
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.2;

export const DrawioViewer: React.FC<DrawioViewerProps> = ({ xml, index = 0 }) => {
  const [copied, setCopied] = useState(false);
  const [showXml, setShowXml] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [unpackedXml, setUnpackedXml] = useState<string>(xml);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Unpack compressed Draw.io XML if required
  useEffect(() => {
    let isCancelled = false;
    extractDrawioXml(xml).then((extracted) => {
      if (!isCancelled) {
        setUnpackedXml(extracted);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [xml]);

  // Send load action to diagrams.net embed iframe
  const sendLoadToIframe = useCallback((payloadXml: string) => {
    if (iframeRef.current && iframeRef.current.contentWindow && payloadXml) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          action: 'load',
          autosave: 0,
          xml: payloadXml,
        }),
        '*'
      );
      setIframeLoaded(true);
    }
  }, []);

  // Handle postMessage communication with diagrams.net embedded viewer
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (typeof e.data !== 'string') return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.event === 'init') {
          // Send the XML payload to the diagrams.net embed iframe
          sendLoadToIframe(unpackedXml);
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [unpackedXml, sendLoadToIframe]);

  // If unpackedXml updates after iframe was already initialized, re-send load action
  useEffect(() => {
    if (iframeLoaded && unpackedXml) {
      sendLoadToIframe(unpackedXml);
    }
  }, [unpackedXml, iframeLoaded, sendLoadToIframe]);

  // Zoom controls
  const handleZoomIn = () => setScale((s) => Math.min(MAX_ZOOM, Number((s + ZOOM_STEP).toFixed(2))));
  const handleZoomOut = () => setScale((s) => Math.max(MIN_ZOOM, Number((s - ZOOM_STEP).toFixed(2))));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Copy raw XML
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(unpackedXml || xml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy XML:', err);
    }
  };

  // Open directly in diagrams.net full web editor
  const handleOpenInDiagramsNet = () => {
    const url = createDiagramsNetEditUrl(unpackedXml || xml);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Drag / Pan handling
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // ESC to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
        zIndex: isFullscreen ? 99999 : 10,
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.2s ease",
      }}
    >
      {/* 🌟 Unified SLS Design Topbar */}
      <div className="mermaid-topbar">
        <div className="mermaid-topbar-left">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span style={{ fontWeight: 700 }}>
            DRAW.IO DIAGRAM {index > 0 ? `#${index + 1}` : ''}
          </span>
        </div>

        {/* Action Controls matching SLS Pill & Button standards */}
        <div className="mermaid-topbar-right">
          {/* Zoom controls */}
          {!showXml && (
            <div className="mm-btn-group">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={scale <= MIN_ZOOM}
                title="Zoom out"
                className="mm-group-btn"
                style={{ opacity: scale <= MIN_ZOOM ? 0.4 : 1 }}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleReset}
                title="Reset zoom to 100%"
                className="mm-group-text"
                style={{ minWidth: 44, color: scale !== 1.0 ? '#0284c7' : undefined }}
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={scale >= MAX_ZOOM}
                title="Zoom in"
                className="mm-group-btn"
                style={{ opacity: scale >= MAX_ZOOM ? 0.4 : 1 }}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleReset}
                title="Reset view"
                className="mm-group-btn"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Toggle XML Code view */}
          <button
            type="button"
            onClick={() => setShowXml(!showXml)}
            title={showXml ? 'Show Visual Diagram' : 'View Raw XML Source'}
            className="mm-btn-action"
          >
            {showXml ? <Eye className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
            <span>{showXml ? 'Visual' : 'XML'}</span>
          </button>

          {/* Open in Diagrams.net */}
          <button
            type="button"
            onClick={handleOpenInDiagramsNet}
            title="Edit in app.diagrams.net"
            className="mm-btn-action"
            style={{ color: '#059669', borderColor: 'rgba(16, 185, 129, 0.3)' }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Edit in Draw.io</span>
          </button>

          {/* Copy XML */}
          <button
            type="button"
            onClick={handleCopy}
            title="Copy Draw.io XML"
            className="mm-btn-icon"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="mm-btn-icon"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: isFullscreen ? 'calc(100vh - 45px)' : '540px',
          overflow: 'hidden',
          background: 'var(--bg-primary, #f8fafc)',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
      >
        {showXml ? (
          <div className="w-full h-full p-4 overflow-auto font-mono text-xs text-slate-300 bg-slate-950 select-text">
            <pre className="whitespace-pre-wrap">{unpackedXml || xml}</pre>
          </div>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center transition-transform origin-center duration-75"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              pointerEvents: isDragging ? 'none' : 'auto',
            }}
          >
            <iframe
              ref={iframeRef}
              title={`drawio-viewer-${index}`}
              src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json&noSaveBtn=1&noExitBtn=1&chrome=0"
              style={{
                width: '100%',
                height: '100%',
                minHeight: isFullscreen ? '100%' : '540px',
                border: 'none',
                opacity: iframeLoaded ? 1 : 0.7,
                transition: 'opacity 0.2s ease',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
