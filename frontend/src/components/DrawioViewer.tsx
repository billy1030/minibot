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

  // Handle postMessage communication with diagrams.net embedded viewer
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (typeof e.data !== 'string') return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.event === 'init') {
          // Send the XML payload to the diagrams.net embed iframe
          if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              JSON.stringify({
                action: 'load',
                autosave: 0,
                xml: unpackedXml,
              }),
              '*'
            );
            setIframeLoaded(true);
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [unpackedXml]);

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
      className={`relative my-4 rounded-xl border border-slate-700/60 bg-slate-900/90 shadow-lg overflow-hidden transition-all duration-200 ${
        isFullscreen ? 'fixed inset-4 z-50 flex flex-col bg-slate-950 border-slate-600 shadow-2xl' : ''
      }`}
    >
      {/* Header / Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/70 select-none">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
            Draw.io Diagram {index > 0 ? `#${index + 1}` : ''}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          {!showXml && (
            <div className="flex items-center gap-0.5 bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/50 mr-1">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={scale <= MIN_ZOOM}
                title="Zoom Out"
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-slate-400 min-w-[3rem] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={scale >= MAX_ZOOM}
                title="Zoom In"
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleReset}
                title="Reset View"
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/40 transition-colors"
          >
            {showXml ? <Eye className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
          </button>

          {/* Open in Diagrams.net */}
          <button
            type="button"
            onClick={handleOpenInDiagramsNet}
            title="Edit in diagrams.net"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 border border-emerald-500/30 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Edit in Draw.io</span>
          </button>

          {/* Copy XML */}
          <button
            type="button"
            onClick={handleCopy}
            title="Copy Draw.io XML"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/40 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/40 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className={`relative w-full overflow-hidden bg-slate-950/80 ${
          isFullscreen ? 'flex-1 h-full' : 'h-[520px]'
        }`}
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
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
              src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json&noSaveBtn=1&noExitBtn=1"
              className="w-full h-full border-0 rounded"
              style={{
                minHeight: isFullscreen ? '100%' : '500px',
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
