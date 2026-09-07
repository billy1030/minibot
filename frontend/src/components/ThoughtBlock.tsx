import React, { useState } from "react";
import { Brain, ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface ThoughtBlockProps {
  thoughtText: string;
  viewMode?: "full" | "minimize" | "hide";
  defaultExpanded?: boolean;
}

export const ThoughtBlock: React.FC<ThoughtBlockProps> = ({
  thoughtText,
  viewMode = "full",
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [copied, setCopied] = useState<boolean>(false);

  if (!thoughtText || viewMode === "hide") {
    return null;
  }

  // Calculate approximate duration / length metrics
  const charCount = thoughtText.length;
  const snippet = thoughtText.trim().replace(/\s+/g, " ").slice(0, 75);

  return (
    <div
      style={{
        borderRadius: 8,
        border: "1px solid rgba(168, 85, 247, 0.28)",
        background: "rgba(168, 85, 247, 0.04)",
        overflow: "hidden",
        marginBottom: 10,
        transition: "all 0.15s ease",
      }}
    >
      {/* Header Bar */}
      <div
        onClick={() => {
          if (viewMode === "full") {
            setIsExpanded(!isExpanded);
          }
        }}
        style={{
          padding: "7px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: viewMode === "full" ? "pointer" : "default",
          background: "rgba(168, 85, 247, 0.08)",
          borderBottom: isExpanded && viewMode === "full" ? "1px solid rgba(168, 85, 247, 0.2)" : "none",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <Brain size={14} color="#a855f7" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-main)", flexShrink: 0 }}>
            Thinking Process
          </span>
          <span
            style={{
              fontSize: 10,
              padding: "1px 5px",
              borderRadius: 4,
              backgroundColor: "rgba(168, 85, 247, 0.15)",
              color: "#a855f7",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {charCount} chars
          </span>

          {viewMode === "minimize" && (
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontStyle: "italic",
                marginLeft: 4,
              }}
            >
              — {snippet}...
            </span>
          )}
        </div>

        {viewMode === "full" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)" }}>
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await navigator.clipboard.writeText(thoughtText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch (err) {
                  console.error("Failed to copy thought text:", err);
                }
              }}
              title="Copy thinking process"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                color: copied ? "#10b981" : "var(--text-muted)",
                transition: "color 0.15s ease",
              }}
            >
              {copied ? (
                <>
                  <Check size={12} color="#10b981" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy</span>
                </>
              )}
            </button>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        )}
      </div>

      {/* Expanded Thinking Body (only in Full mode) */}
      {viewMode === "full" && isExpanded && (
        <div
          style={{
            padding: "12px 14px",
            fontSize: 12.5,
            lineHeight: 1.6,
            color: "var(--text-main)",
            maxHeight: 280,
            overflowY: "auto",
            overflowX: "hidden",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            minWidth: 0,
            backgroundColor: "rgba(168, 85, 247, 0.02)",
            borderTop: "none",
          }}
        >
          <MarkdownRenderer content={thoughtText} />
        </div>
      )}
    </div>
  );
};
