import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import {
  Network,
  X,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Copy,
  Check,
  Code,
  Eye,
  ChevronsDownUp
} from 'lucide-react';
import { sanitizeMermaidCode } from '../utils/mermaidGuardrail';

export type MermaidThemeId = 'sky' | 'emerald' | 'indigo' | 'amber' | 'midnight';

export interface ThemePreset {
  id: MermaidThemeId;
  label: string;
  dotColor: string;
  isDark: boolean;
  clusterBkg: string;
  clusterBorder: string;
  themeVariables: Record<string, any>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'sky',
    label: 'Tech Sky',
    dotColor: '#38bdf8',
    isDark: false,
    clusterBkg: '#f8fafc',
    clusterBorder: '#93c5fd',
    themeVariables: {
      darkMode: false,
      background: '#ffffff',
      mainBkg: '#f8fafc',
      primaryColor: '#f0f9ff',
      primaryTextColor: '#0f172a',
      primaryBorderColor: '#38bdf8',
      secondaryColor: '#f8fafc',
      secondaryTextColor: '#1e293b',
      secondaryBorderColor: '#cbd5e1',
      tertiaryColor: '#f1f5f9',
      tertiaryTextColor: '#1e293b',
      tertiaryBorderColor: '#94a3b8',
      lineColor: '#2563eb',
      textColor: '#0f172a',
      clusterBkg: '#f8fafc',
      clusterBorder: '#93c5fd',
      nodeBorder: '#0284c7',
      defaultLinkColor: '#2563eb',
      titleColor: '#0369a1',
      edgeLabelBackground: '#ffffff',
      nodeTextColor: '#0f172a',
      fontFamily: '"Roboto", -apple-system, BlinkMacSystemFont, "Noto Sans TC", sans-serif'
    }
  },
  {
    id: 'emerald',
    label: 'Fresh Emerald',
    dotColor: '#10b981',
    isDark: false,
    clusterBkg: '#f0fdf4',
    clusterBorder: '#86efac',
    themeVariables: {
      darkMode: false,
      background: '#ffffff',
      mainBkg: '#f0fdf4',
      primaryColor: '#ecfdf5',
      primaryTextColor: '#064e3b',
      primaryBorderColor: '#34d399',
      secondaryColor: '#f0fdf4',
      secondaryTextColor: '#065f46',
      secondaryBorderColor: '#a7f3d0',
      tertiaryColor: '#d1fae5',
      tertiaryTextColor: '#064e3b',
      tertiaryBorderColor: '#6ee7b7',
      lineColor: '#059669',
      textColor: '#064e3b',
      clusterBkg: '#f0fdf4',
      clusterBorder: '#86efac',
      nodeBorder: '#059669',
      defaultLinkColor: '#059669',
      titleColor: '#047857',
      edgeLabelBackground: '#ffffff',
      nodeTextColor: '#064e3b',
      fontFamily: '"Roboto", -apple-system, BlinkMacSystemFont, "Noto Sans TC", sans-serif'
    }
  },
  {
    id: 'indigo',
    label: 'Aurora Indigo',
    dotColor: '#6366f1',
    isDark: false,
    clusterBkg: '#f5f3ff',
    clusterBorder: '#c7d2fe',
    themeVariables: {
      darkMode: false,
      background: '#ffffff',
      mainBkg: '#f5f3ff',
      primaryColor: '#eef2ff',
      primaryTextColor: '#1e1b4b',
      primaryBorderColor: '#818cf8',
      secondaryColor: '#f5f3ff',
      secondaryTextColor: '#312e81',
      secondaryBorderColor: '#c7d2fe',
      tertiaryColor: '#ede9fe',
      tertiaryTextColor: '#1e1b4b',
      tertiaryBorderColor: '#a5b4fc',
      lineColor: '#4f46e5',
      textColor: '#1e1b4b',
      clusterBkg: '#f5f3ff',
      clusterBorder: '#c7d2fe',
      nodeBorder: '#4f46e5',
      defaultLinkColor: '#4f46e5',
      titleColor: '#4338ca',
      edgeLabelBackground: '#ffffff',
      nodeTextColor: '#1e1b4b',
      fontFamily: '"Roboto", -apple-system, BlinkMacSystemFont, "Noto Sans TC", sans-serif'
    }
  },
  {
    id: 'amber',
    label: 'Warm Amber',
    dotColor: '#f59e0b',
    isDark: false,
    clusterBkg: '#ede3cb',
    clusterBorder: '#c4b087',
    themeVariables: {
      darkMode: false,
      background: '#fbf7ee',
      mainBkg: '#f6f1e3',
      primaryColor: '#ede4cf',
      primaryTextColor: '#382e21',
      primaryBorderColor: '#b49f70',
      secondaryColor: '#f1ebd8',
      secondaryTextColor: '#382e21',
      secondaryBorderColor: '#c4ad7c',
      tertiaryColor: '#e8ddc4',
      tertiaryTextColor: '#382e21',
      tertiaryBorderColor: '#9f8859',
      lineColor: '#8c6f3e',
      textColor: '#382e21',
      clusterBkg: '#ede3cb',
      clusterBorder: '#c4b087',
      nodeBorder: '#b49f70',
      defaultLinkColor: '#8c6f3e',
      titleColor: '#5c4b32',
      edgeLabelBackground: '#f6f1e3',
      nodeTextColor: '#382e21',
      fontFamily: '"Roboto", -apple-system, BlinkMacSystemFont, "Noto Sans TC", sans-serif'
    }
  },
  {
    id: 'midnight',
    label: 'Deep Midnight',
    dotColor: '#1e293b',
    isDark: true,
    clusterBkg: '#0f172a',
    clusterBorder: '#38bdf8',
    themeVariables: {
      darkMode: true,
      background: '#020617',
      mainBkg: '#0f172a',
      primaryColor: '#1e293b',
      primaryTextColor: '#f8fafc',
      primaryBorderColor: '#38bdf8',
      secondaryColor: '#172554',
      secondaryTextColor: '#f1f5f9',
      secondaryBorderColor: '#60a5fa',
      tertiaryColor: '#1e1b4b',
      tertiaryTextColor: '#f1f5f9',
      tertiaryBorderColor: '#93c5fd',
      lineColor: '#38bdf8',
      textColor: '#f8fafc',
      clusterBkg: '#0f172a',
      clusterBorder: '#38bdf8',
      nodeBorder: '#38bdf8',
      defaultLinkColor: '#38bdf8',
      titleColor: '#7dd3fc',
      edgeLabelBackground: '#1e293b',
      nodeTextColor: '#f8fafc',
      fontFamily: '"Roboto", -apple-system, BlinkMacSystemFont, "Noto Sans TC", sans-serif'
    }
  }
];

interface MermaidDiagramProps {
  code: string;
  index?: number;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ code, index = 0 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);

  const [svgContent, setSvgContent] = useState<string>('');
  const [isCodeCopied, setIsCodeCopied] = useState<boolean>(false);
  const [isCodeVisible, setIsCodeVisible] = useState<boolean>(false);
  const [showColorMenu, setShowColorMenu] = useState<boolean>(false);

  // 色彩風格狀態 (預設 sky，若全域 dark 則預設 midnight)
  const [selectedTheme, setSelectedTheme] = useState<MermaidThemeId>(() => {
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'midnight';
    }
    return 'sky';
  });

  // 點擊選單外部自動關閉色彩主題選單
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorMenuRef.current && !colorMenuRef.current.contains(e.target as Node)) {
        setShowColorMenu(false);
      }
    };
    if (showColorMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColorMenu]);

  // 外框寬度三級狀態：0 (預設), 1 (4:3 展開), 2 (放到最大 80vw 全屏視野)
  const [expandLevel, setExpandLevel] = useState<number>(0);

  // 縮放與平移狀態 (上限 500%)
  const [inlineScale, setInlineScale] = useState(1.0);
  const [inlinePan, setInlinePan] = useState({ x: 0, y: 0 });
  const [isInlineDragging, setIsInlineDragging] = useState(false);
  const inlineDragStart = useRef({ x: 0, y: 0, initialPanX: 0, initialPanY: 0 });

  // 原始 SVG 尺寸紀錄
  const [, setNativeSvgDim] = useState<{ width: number; height: number } | null>(null);

  // 節點行距與上下層級間距狀態 (預設 rankSpacing 50, lineHeight 1.2)
  const [lineHeight, setLineHeight] = useState(1.2);
  const [rankSpacing, setRankSpacing] = useState(50);

  // 依當前放大倍率自動偵測並緊縮消除上下留白邊距 (預設啟用)
  const [isReduceMargin, setIsReduceMargin] = useState(true);
  const [tightHeight, setTightHeight] = useState<number | null>(null);
  const [dynamicWidthStyle, setDynamicWidthStyle] = useState<{ width?: string; marginLeft?: string }>({});

  const [renderError, setRenderError] = useState<string | null>(null);

  // 依當前放大倍率 (scale) 自動偵測圖表內容真實現有高度，計算消除上下留白後的緊湊高度
  const calculateTightHeight = (scale: number): number | null => {
    const container = containerRef.current;
    if (!container) return null;
    const svg = container.querySelector('svg');
    if (!svg) return null;

    let baseHeight = 0;
    const isTall = svg.classList.contains('mermaid-tall-chart');
    try {
      const rect = svg.getBoundingClientRect();
      if (rect && rect.height > 0) {
        baseHeight = rect.height / (scale || 1.0);
      }
    } catch {
      // ignore
    }

    if (!baseHeight) {
      try {
        const bbox = svg.getBBox();
        if (bbox && bbox.height > 0 && bbox.width > 0) {
          if (isTall || bbox.height / bbox.width > 1.33) {
            baseHeight = Math.min(480, bbox.height);
          } else {
            const clientW = svg.clientWidth || container.clientWidth || 800;
            const widthRatio = clientW / bbox.width;
            baseHeight = bbox.height * widthRatio;
          }
        }
      } catch {
        // ignore
      }
    }

    if (baseHeight > 0) {
      if (isTall) {
        baseHeight = Math.min(baseHeight, 480);
      }
      // 根據當前放大比例計算緊密高度，上下各保留 8px 呼吸邊距 (共 16px)
      const snug = Math.round(baseHeight * scale + 16);
      return Math.max(60, snug);
    }
    return null;
  };

  const toggleReduceMargin = () => {
    if (!isReduceMargin) {
      const h = calculateTightHeight(inlineScale);
      setTightHeight(h);
      setIsReduceMargin(true);
      setInlinePan(p => ({ ...p, y: 0 }));
    } else {
      setIsReduceMargin(false);
      setTightHeight(null);
    }
  };

  // 當倍率變動或 SVG 載入時重算緊湊高度
  useEffect(() => {
    if (isReduceMargin && svgContent) {
      const timer = setTimeout(() => {
        const h = calculateTightHeight(inlineScale);
        if (h) setTightHeight(h);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [inlineScale, isReduceMargin, svgContent]);

  // 動態更新圖表層級行距 (rankSpacing) 與節點內部行距
  const updateLineHeight = (val: number) => {
    const nextLh = parseFloat(val.toFixed(1));
    setLineHeight(nextLh);

    const calculatedSpacing = Math.round(50 + (nextLh - 1.2) * 55);
    setRankSpacing(Math.max(25, Math.min(150, calculatedSpacing)));

    const container = containerRef.current;
    if (!container) return;

    container.style.setProperty('--mermaid-node-line-height', nextLh.toString());

    // 純 SVG 模式 (tspan dy)
    const tspans = container.querySelectorAll('tspan');
    tspans.forEach((ts, i) => {
      if (i > 0 && ts.getAttribute('dy')) {
        ts.setAttribute('dy', `${(nextLh * 1.1).toFixed(2)}em`);
      }
    });

    const textContainers = container.querySelectorAll('foreignObject, .nodeLabel, .label, text, .cluster-label, div, span');
    textContainers.forEach((el: any) => {
      el.style.setProperty('line-height', nextLh.toString(), 'important');
    });
  };

  // 變更展開等級 (0: 預設, 1: 4:3 展開, 2: 放到最大全屏視圖)
  const handleSetExpandLevel = (nextLevel: number) => {
    const target = Math.max(0, Math.min(2, nextLevel));
    setExpandLevel(target);

    if (target === 1) {
      const calculateDynamicBounds = () => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return { canvasW: 800, canvasH: 600 };
        const scrollParent = (wrapper.closest('.overflow-y-auto') || wrapper.parentElement) as HTMLElement | null;
        if (!scrollParent) return { canvasW: wrapper.clientWidth, canvasH: Math.round(wrapper.clientWidth * 0.75) };

        const availableWidth = scrollParent.clientWidth - 48;
        const currentArticleWidth = wrapper.parentElement?.clientWidth || 768;

        const extraSpace = Math.max(0, availableWidth - currentArticleWidth);
        const extendMargin = Math.min(extraSpace / 2, 260);

        if (extendMargin > 10) {
          setDynamicWidthStyle({
            width: `calc(100% + ${Math.round(extendMargin * 2)}px)`,
            marginLeft: `-${Math.round(extendMargin)}px`
          });
        } else {
          setDynamicWidthStyle({ width: '100%', marginLeft: '0px' });
        }

        const effectiveW = currentArticleWidth + extendMargin * 2;
        const effectiveH = Math.round(effectiveW * 0.75);
        return { canvasW: effectiveW, canvasH: effectiveH };
      };

      const { canvasW, canvasH } = calculateDynamicBounds();

      setTimeout(() => {
        const container = containerRef.current;
        if (!container) return;
        const svg = container.querySelector('svg');
        if (!svg) return;

        let svgW = 0;
        let svgH = 0;
        try {
          const bbox = svg.getBBox();
          svgW = bbox.width || 0;
          svgH = bbox.height || 0;
        } catch {}

        if (!svgW || !svgH) {
          const rect = svg.getBoundingClientRect();
          svgW = rect.width / (inlineScale || 1);
          svgH = rect.height / (inlineScale || 1);
        }

        if (svgW > 0 && svgH > 0) {
          const chartAspect = svgW / svgH;
          const nodeCount = svg.querySelectorAll('.node, .cluster, .actor, .statediagram-state').length || 1;

          let bestScale = 1.0;
          if (nodeCount <= 3 && svgW < 300) {
            bestScale = 0.55;
          } else if (chartAspect < 0.65) {
            const fitH = (canvasH * 0.85) / svgH;
            bestScale = Math.max(0.6, Math.min(1.0, fitH));
          } else {
            const targetScaleX = (canvasW * 0.88) / svgW;
            const targetScaleY = (canvasH * 0.85) / svgH;
            bestScale = Math.min(targetScaleX, targetScaleY);
            bestScale = Math.max(0.6, Math.min(1.8, Number(bestScale.toFixed(2))));
          }

          setInlineScale(Number(bestScale.toFixed(2)));
          setInlinePan({ x: 0, y: 0 });
        }
      }, 120);
    } else {
      setDynamicWidthStyle({});
      setInlineScale(1.0);
      setInlinePan({ x: 0, y: 0 });
    }
  };

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      try {
        setRenderError(null);
        const isDark = document.documentElement.classList.contains('dark');
        const isWarm = document.documentElement.classList.contains('warm');

        let activePreset = THEME_PRESETS.find(p => p.id === selectedTheme);
        if (!activePreset) {
          activePreset = isDark
            ? THEME_PRESETS.find(p => p.id === 'midnight')!
            : isWarm
            ? THEME_PRESETS.find(p => p.id === 'amber')!
            : THEME_PRESETS[0];
        }

        if (containerRef.current) {
          containerRef.current.style.setProperty('--mermaid-cluster-bg', activePreset.clusterBkg);
          containerRef.current.style.setProperty('--mermaid-cluster-border', activePreset.clusterBorder);
        }

        mermaid.initialize({
          startOnLoad: false,
          suppressErrorRendering: true,
          theme: 'base',
          themeVariables: activePreset.themeVariables,
          securityLevel: 'loose',
          fontFamily: '"Roboto", -apple-system, BlinkMacSystemFont, "Noto Sans TC", sans-serif',
          fontSize: 13.5,
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis',
            nodeSpacing: 45,
            rankSpacing: 48,
            padding: 12,
            wrappingWidth: 240
          },
          sequence: {
            diagramMarginX: 50,
            diagramMarginY: Math.round(rankSpacing * 0.6),
            actorFontSize: 14,
            messageFontSize: 13.5,
            noteFontSize: 13,
            width: 180,
            height: Math.round(rankSpacing)
          }
        });

        // 🛡️ 第三層：強效清洗 SVG 字串，將 Mermaid 寫死在 SVG inline style 裡的預設淡黃色徹底替換
        const cleanSvgColors = (rawSvg: string, clusterBg: string) => {
          return rawSvg
            .replace(/#ffffde/gi, clusterBg)
            .replace(/#ffffcc/gi, clusterBg)
            .replace(/#ffffdf/gi, clusterBg)
            .replace(/#fffbe8/gi, clusterBg)
            .replace(/#fefae0/gi, clusterBg)
            .replace(/#ffffe0/gi, clusterBg);
        };

        // 🛡️ 第一層：主動執行 Guardrail 自動清洗修復
        const sanitizedCode = sanitizeMermaidCode(code.trim());
        const id = `mermaid_${Date.now()}_${index}_${selectedTheme}`;
        let finalSvg = '';
        try {
          const { svg } = await mermaid.render(id, sanitizedCode);
          finalSvg = cleanSvgColors(svg, activePreset.clusterBkg);
        } catch {
          // 🛡️ 第二層：若初次渲染失敗，嘗試深度轉義清洗再次嘗試
          const fallbackCode = sanitizeMermaidCode(sanitizedCode)
            .replace(/([A-Za-z0-9_]+)\[([^\]"]+)\]/g, '$1["$2"]')
            .replace(/([A-Za-z0-9_]+)\{([^}"]+)\}/g, '$1{"$2"}');
          const retryId = `retry_${Date.now()}_${index}_${selectedTheme}`;
          const { svg } = await mermaid.render(retryId, fallbackCode);
          finalSvg = cleanSvgColors(svg, activePreset.clusterBkg);
        }

        if (isMounted && finalSvg) {
          let isTallChart = false;
          const vbMatch = finalSvg.match(/viewBox=["']([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)["']/i);
          if (vbMatch) {
            const vbW = parseFloat(vbMatch[3]);
            const vbH = parseFloat(vbMatch[4]);
            if (vbW > 0 && vbH > 0) {
              setNativeSvgDim({ width: vbW, height: vbH });
              if (vbH / vbW > 1.33) {
                isTallChart = true;
              }
            }
          }

          if (isTallChart) {
            if (finalSvg.includes('class="')) {
              finalSvg = finalSvg.replace(/class=["']([^"']*)["']/i, 'class="$1 mermaid-tall-chart"');
            } else {
              finalSvg = finalSvg.replace(/<svg\b/i, '<svg class="mermaid-tall-chart" ');
            }
          }

          setSvgContent(finalSvg);
          setTimeout(() => {
            if (!containerRef.current) return;
            updateLineHeight(lineHeight);
            const svgEl = containerRef.current.querySelector('svg');
            if (svgEl) {
              try {
                const bbox = svgEl.getBBox();
                if (bbox.width > 0 && bbox.height > 0) {
                  setNativeSvgDim({ width: bbox.width, height: bbox.height });
                  if (bbox.height / bbox.width > 1.33) {
                    svgEl.classList.add('mermaid-tall-chart');
                  }
                }
              } catch {
                const rect = svgEl.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  setNativeSvgDim({ width: rect.width, height: rect.height });
                  if (rect.height / rect.width > 1.33) {
                    svgEl.classList.add('mermaid-tall-chart');
                  }
                }
              }
            }
          }, 50);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setRenderError(err?.message || 'Mermaid Render Error');
      }
    };

    renderChart();

    // 🌗 監聽日夜模式切換，即時重繪圖表配色
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          const isDarkNow = document.documentElement.classList.contains('dark');
          setSelectedTheme(isDarkNow ? 'midnight' : 'sky');
          break;
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      isMounted = false;
      observer.disconnect();
    };
  }, [code, index, lineHeight, selectedTheme]);

  // 內聯拖拽平移事件
  const handleInlineMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsInlineDragging(true);
    inlineDragStart.current = {
      x: e.clientX,
      y: e.clientY,
      initialPanX: inlinePan.x,
      initialPanY: inlinePan.y
    };
  };

  const handleInlineMouseMove = (e: React.MouseEvent) => {
    if (!isInlineDragging) return;
    const dx = e.clientX - inlineDragStart.current.x;
    const dy = e.clientY - inlineDragStart.current.y;
    setInlinePan({
      x: inlineDragStart.current.initialPanX + dx,
      y: inlineDragStart.current.initialPanY + dy
    });
  };

  const handleInlineMouseUp = () => setIsInlineDragging(false);

  const copyMermaidCode = async () => {
    try {
      const rawCode = `\`\`\`mermaid\n${code.trim()}\n\`\`\``;
      await navigator.clipboard.writeText(rawCode);
      setIsCodeCopied(true);
      setTimeout(() => setIsCodeCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        ...dynamicWidthStyle,
        transition: isInlineDragging ? 'none' : 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1), margin-left 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      className="mermaid-wrapper"
    >
      {/* 🌟 圖表頂部操作列：左側為標題，所有功能按鈕全部靠最右手邊對齊 (100% SLS Parity) */}
      <div className="mermaid-topbar">
        <div className="mermaid-topbar-left">
          <Network className="w-4 h-4 text-sky-500" style={{ color: '#0ea5e9' }} />
          <span>Diagram ({(index + 1).toString().padStart(2, '0')})</span>
        </div>

        {/* 🎮 所有操作按鈕群組 (檢視語法、複製代碼、100% 縮放、行距、4:3 展開) 一律靠最右手邊 */}
        <div className="mermaid-topbar-right">
          {/* 👁️/💻 顯示 / 隱藏 原始代碼按鈕 */}
          <button
            onClick={() => setIsCodeVisible(v => !v)}
            className={`mm-btn-action ${isCodeVisible ? 'active' : ''}`}
            title={isCodeVisible ? 'Hide raw code' : 'Display raw code'}
          >
            {isCodeVisible ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Hide Code</span>
              </>
            ) : (
              <>
                <Code className="w-3.5 h-3.5" style={{ color: '#6366f1' }} />
                <span>View Code</span>
              </>
            )}
          </button>

          {/* 📋 複製代碼按鈕 */}
          <button
            onClick={copyMermaidCode}
            className="mm-btn-action"
            title="Copy raw diagram code"
          >
            {isCodeCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" style={{ color: '#10b981' }} />
                <span style={{ color: '#10b981', fontWeight: 700 }}>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-sky-500" style={{ color: '#0ea5e9' }} />
                <span>Copy Code</span>
              </>
            )}
          </button>

          {/* 🎮 內聯直接控制按鈕組 (放大、縮小、復位 100% - SLS Parity) */}
          <div
            className="mm-btn-group"
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setInlineScale(s => Math.max(0.4, Number((s - 0.2).toFixed(2))));
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              className="mm-group-btn"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setInlineScale(1.0);
                setInlinePan({ x: 0, y: 0 });
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              className="mm-group-text min-w-[38px] text-center"
              title="Reset view"
            >
              {Math.round(inlineScale * 100)}%
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setInlineScale(s => Math.min(5.0, Number((s + 0.25).toFixed(2))));
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              className="mm-group-btn"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setInlineScale(1.0);
                setInlinePan({ x: 0, y: 0 });
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              className="mm-group-btn"
              title="Reset view"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* ↕️ 節點上下行距/字距控制鍵 (↕- / 1.2 / ↕+) */}
          <div
            className="mm-btn-group"
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                updateLineHeight(Math.max(1.0, Number((lineHeight - 0.2).toFixed(1))));
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              className="mm-group-btn"
              title="Decrease node line spacing (-0.2)"
            >
              ↕-
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                updateLineHeight(1.2);
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              className="mm-group-text indigo"
              title="Click to reset line height to default (1.2)"
            >
              ↕{lineHeight}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                updateLineHeight(Math.min(2.8, Number((lineHeight + 0.2).toFixed(1))));
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              className="mm-group-btn"
              title="Increase node line spacing (+0.2)"
            >
              ↕+
            </button>
          </div>

          {/* ↕️ 消除上下留白邊距按鈕 (Detect & Reduce Up/Down Margin) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              toggleReduceMargin();
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            className={`mm-btn-fit ${isReduceMargin ? '' : 'inactive'}`}
            title={`${isReduceMargin ? 'Margin Fitted' : 'Fit Margin'}: Detect & reduce vertical margin space for current zoom (${Math.round(inlineScale * 100)}%)`}
          >
            <ChevronsDownUp className="w-3.5 h-3.5" style={{ color: '#475569' }} />
          </button>

          {/* 📐 4:3 展開外框切換按鈕 (Icon-only) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleSetExpandLevel(expandLevel === 0 ? 1 : 0);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            className="mm-btn-icon"
            title={expandLevel === 1 ? 'Restore default frame' : 'Expand to 4:3 aspect ratio frame'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#475569' }}>
              {expandLevel === 1 ? (
                <>
                  <polyline points="4 14 10 14 10 20"/>
                  <polyline points="20 10 14 10 14 4"/>
                  <line x1="14" y1="10" x2="21" y2="3"/>
                  <line x1="3" y1="21" x2="10" y2="14"/>
                </>
              ) : (
                <>
                  <path d="M15 3h6v6"/>
                  <path d="M9 21H3v-6"/>
                  <path d="M21 3l-7 7"/>
                  <path d="M3 21l7-7"/>
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* 原始程式碼預覽抽屜 */}
      {isCodeVisible && (
        <div className="p-3.5 bg-slate-900 text-slate-200 border-b border-slate-800 text-xs font-mono relative overflow-hidden transition-all">
          <div className="flex items-center justify-between mb-2 text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
            <span className="font-bold flex items-center gap-1.5 text-sky-400">
              <Code className="w-3.5 h-3.5" />
              <span>Source Code</span>
            </span>
            <span className="text-[10px] text-slate-500">{code.split('\n').length} lines</span>
          </div>
          <pre className="overflow-x-auto p-2 bg-slate-950/60 rounded-lg text-sky-200/90 leading-relaxed font-mono select-text max-h-[260px]">
            <code>{code.trim()}</code>
          </pre>
        </div>
      )}

      {/* 畫布區域 */}
      {renderError ? (
        <div className="p-4 bg-slate-50 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 rounded-xl m-3 font-mono text-xs overflow-x-auto border border-slate-200 dark:border-slate-800">
          <div className="text-amber-600 dark:text-amber-400 font-bold mb-2">⚠️ Diagram syntax note (displayed in code mode):</div>
          <pre className="!bg-transparent !p-0 !border-0"><code className="!text-slate-700 dark:!text-slate-300">{code}</code></pre>
        </div>
      ) : (
        <div
          onMouseDown={handleInlineMouseDown}
          onMouseMove={handleInlineMouseMove}
          onMouseUp={handleInlineMouseUp}
          onMouseLeave={handleInlineMouseUp}
          onDoubleClick={() => { setInlineScale(1.0); setInlinePan({ x: 0, y: 0 }); }}
          style={{
            minHeight: isReduceMargin ? 'auto' : (expandLevel === 1 ? '420px' : 'auto'),
            height: isReduceMargin && tightHeight ? `${tightHeight}px` : 'auto',
            maxHeight: expandLevel === 1 && !isReduceMargin ? '750px' : 'none',
            padding: isReduceMargin ? '2px 12px' : '6px 12px',
            transition: isInlineDragging ? 'none' : 'height 0.2s ease-out, min-height 0.2s ease-out'
          }}
          className={`mermaid-container overflow-hidden relative flex items-center justify-center select-none ${
            isInlineDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          <div
            ref={containerRef}
            style={{
              transform: `translate(${inlinePan.x}px, ${inlinePan.y}px) scale(${inlineScale})`,
              transformOrigin: 'center center',
              transition: isInlineDragging ? 'none' : 'transform 0.15s ease-out',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: 'auto'
            }}
            className="flex items-center justify-center pointer-events-none"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      )}

      {/* 🚀 第三級：放到最大 Pop-Up 浮層 (精準 80% 視窗視野 w-[80vw] h-[80vh]) */}
      {expandLevel === 2 && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-[85vw] h-[82vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-4">
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-sky-500" />
                <span className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100">Full Diagram View (80% Panorama)</span>
              </div>

              <div className="flex items-center gap-3">
                {/* 彈窗內縮放控制組 */}
                <div
                  className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs"
                  onMouseDown={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setInlineScale(s => Math.max(0.4, Number((s - 0.2).toFixed(2))));
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                    className="p-1 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setInlineScale(1.0);
                      setInlinePan({ x: 0, y: 0 });
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                    className="px-1.5 text-xs font-mono font-bold text-slate-600 dark:text-slate-300 hover:text-sky-600 cursor-pointer min-w-[38px] text-center"
                    title="Reset Zoom (100%)"
                  >
                    {Math.round(inlineScale * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setInlineScale(s => Math.min(5.0, Number((s + 0.25).toFixed(2))));
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                    className="p-1 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 退回 4:3 按鈕 */}
                <button
                  onClick={() => handleSetExpandLevel(1)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                  title="Return to 4:3 aspect ratio frame"
                >
                  4:3 Frame
                </button>

                {/* 關閉彈窗 */}
                <button
                  onClick={() => handleSetExpandLevel(0)}
                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                  title="Close and reset view"
                >
                  <X className="w-4 h-4" />
                  <span>Close</span>
                </button>
              </div>
            </div>

            {/* 80% 畫布區 */}
            <div
              onMouseDown={handleInlineMouseDown}
              onMouseMove={handleInlineMouseMove}
              onMouseUp={handleInlineMouseUp}
              className="flex-1 bg-slate-50/70 dark:bg-slate-950/70 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-inner overflow-hidden relative flex items-center justify-center select-none cursor-grab active:cursor-grabbing p-4"
            >
              <div
                style={{
                  transform: `translate(${inlinePan.x}px, ${inlinePan.y}px) scale(${inlineScale})`,
                  transition: isInlineDragging ? 'none' : 'transform 0.15s ease-out',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                className="pointer-events-none"
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
