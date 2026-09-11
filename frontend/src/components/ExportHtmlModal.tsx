import React, { useState, useId } from "react";
import { Download, X, FileText, Filter } from "lucide-react";
import { generateStandaloneExportHtml, downloadHtmlFile } from "../utils/htmlExport";

export interface ExportMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ExportHtmlModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ExportMessage[];
  sessionFileName?: string | null;
}

export const ExportHtmlModal: React.FC<ExportHtmlModalProps> = ({
  isOpen,
  onClose,
  messages,
  sessionFileName,
}) => {
  const excludeFirstAssistantId = useId();
  const excludeUserQueriesId = useId();

  // Option 1: Remove first Assistant Response (e.g. Welcome greeting / first AI turn)
  const [excludeFirstAssistant, setExcludeFirstAssistant] = useState<boolean>(true);

  // Option 2: Remove all user queries (keep only assistant responses / reports)
  const [excludeUserQueries, setExcludeUserQueries] = useState<boolean>(false);

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Identify the first assistant message index
  const firstAssistantIndex = messages.findIndex((m) => m.role === "assistant");

  // Filter messages according to selected options
  const filteredMessages = messages.filter((m, idx) => {
    // Check 1: Exclude first Assistant Response
    if (excludeFirstAssistant && idx === firstAssistantIndex) {
      return false;
    }
    // Check 2: Exclude all User queries
    if (excludeUserQueries && m.role === "user") {
      return false;
    }
    return true;
  });

  const filteredAssistantCount = filteredMessages.filter((m) => m.role === "assistant").length;
  const filteredUserCount = filteredMessages.filter((m) => m.role === "user").length;

  const handleExport = () => {
    if (filteredMessages.length === 0) return;

    const baseTitle = sessionFileName
      ? sessionFileName.replace(/\.md$/i, "")
      : "Chat Session Export";

    // Build markdown representation
    let combinedMarkdown = "";
    if (excludeUserQueries) {
      // Clean export of assistant responses without repetitive user query dividers if desired
      combinedMarkdown = filteredMessages
        .map((m, i) => (filteredMessages.length > 1 ? `### 🤖 Assistant Response #${i + 1}\n\n${m.content}` : m.content))
        .join("\n\n---\n\n");
    } else {
      combinedMarkdown = filteredMessages
        .map((m) => `### ${m.role === "user" ? "👤 User Query" : "🤖 Assistant Response"}\n\n${m.content}`)
        .join("\n\n---\n\n");
    }

    const html = generateStandaloneExportHtml(combinedMarkdown, baseTitle);
    const filename = `${baseTitle.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, "_")}.html`;
    downloadHtmlFile(html, filename);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--bg-card, #1e293b)",
          borderRadius: "16px",
          border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
          boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.5)",
          width: "100%",
          maxWidth: "480px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--border-color, rgba(255, 255, 255, 0.08))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                background: "rgba(2, 132, 199, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#38bdf8",
              }}
            >
              <FileText size={18} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.05rem",
                  fontWeight: 600,
                  color: "var(--text-main, #f8fafc)",
                }}
              >
                Export HTML Report
              </h3>
              <p
                style={{
                  margin: "2px 0 0 0",
                  fontSize: "0.8rem",
                  color: "var(--text-muted, #94a3b8)",
                }}
              >
                Customize contents included in your offline HTML file
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 6,
              color: "var(--text-muted, #94a3b8)",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s ease, color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-main, #f8fafc)";
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted, #94a3b8)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Options List */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {/* Option 1: Remove First Assistant Response */}
            <label
              htmlFor={excludeFirstAssistantId}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                padding: "0.875rem 1rem",
                borderRadius: "10px",
                background: excludeFirstAssistant
                  ? "rgba(2, 132, 199, 0.08)"
                  : "var(--bg-card-subtle, rgba(255, 255, 255, 0.02))",
                border: `1px solid ${
                  excludeFirstAssistant
                    ? "rgba(2, 132, 199, 0.4)"
                    : "var(--border-color, rgba(255, 255, 255, 0.08))"
                }`,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <input
                id={excludeFirstAssistantId}
                type="checkbox"
                checked={excludeFirstAssistant}
                onChange={(e) => setExcludeFirstAssistant(e.target.checked)}
                style={{
                  marginTop: "0.2rem",
                  width: 16,
                  height: 16,
                  accentColor: "#0284c7",
                  cursor: "pointer",
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--text-main, #f8fafc)",
                    marginBottom: "2px",
                  }}
                >
                  Remove first Assistant Response
                </div>
                <div
                  style={{
                    fontSize: "0.775rem",
                    color: "var(--text-muted, #94a3b8)",
                    lineHeight: 1.4,
                  }}
                >
                  Omits the initial welcome greeting or first AI reply from the export.
                </div>
              </div>
            </label>

            {/* Option 2: Remove All User Queries */}
            <label
              htmlFor={excludeUserQueriesId}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                padding: "0.875rem 1rem",
                borderRadius: "10px",
                background: excludeUserQueries
                  ? "rgba(2, 132, 199, 0.08)"
                  : "var(--bg-card-subtle, rgba(255, 255, 255, 0.02))",
                border: `1px solid ${
                  excludeUserQueries
                    ? "rgba(2, 132, 199, 0.4)"
                    : "var(--border-color, rgba(255, 255, 255, 0.08))"
                }`,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <input
                id={excludeUserQueriesId}
                type="checkbox"
                checked={excludeUserQueries}
                onChange={(e) => setExcludeUserQueries(e.target.checked)}
                style={{
                  marginTop: "0.2rem",
                  width: 16,
                  height: 16,
                  accentColor: "#0284c7",
                  cursor: "pointer",
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--text-main, #f8fafc)",
                    marginBottom: "2px",
                  }}
                >
                  Remove all User Queries
                </div>
                <div
                  style={{
                    fontSize: "0.775rem",
                    color: "var(--text-muted, #94a3b8)",
                    lineHeight: 1.4,
                  }}
                >
                  Exports AI responses only (useful for standalone reports, summaries, and docs).
                </div>
              </div>
            </label>
          </div>

          {/* Export Summary & Metrics */}
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              background: "var(--bg-card-subtle, rgba(0, 0, 0, 0.15))",
              border: "1px solid var(--border-color, rgba(255, 255, 255, 0.05))",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.8rem",
            }}
          >
            <span style={{ color: "var(--text-muted, #94a3b8)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Filter size={14} /> Output Content:
            </span>
            <span style={{ fontWeight: 600, color: "var(--text-main, #f8fafc)" }}>
              {filteredAssistantCount} AI {filteredAssistantCount === 1 ? "response" : "responses"}
              {!excludeUserQueries && ` · ${filteredUserCount} user queries`}
              {" "}({filteredMessages.length} total)
            </span>
          </div>

          {filteredMessages.length === 0 && (
            <div
              style={{
                fontSize: "0.8rem",
                color: "#f87171",
                textAlign: "center",
              }}
            >
              No messages left to export with current filters.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid var(--border-color, rgba(255, 255, 255, 0.08))",
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            background: "var(--bg-card-subtle, rgba(0, 0, 0, 0.1))",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              border: "1px solid var(--border-color, rgba(255, 255, 255, 0.15))",
              background: "transparent",
              color: "var(--text-muted, #94a3b8)",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 500,
              transition: "all 0.15s ease",
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={filteredMessages.length === 0}
            onClick={handleExport}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "8px",
              border: "none",
              background: filteredMessages.length > 0 ? "var(--accent, #0284c7)" : "#475569",
              color: "#ffffff",
              cursor: filteredMessages.length > 0 ? "pointer" : "not-allowed",
              fontSize: "0.85rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              boxShadow: filteredMessages.length > 0 ? "0 2px 8px rgba(2, 132, 199, 0.3)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <Download size={15} />
            Export HTML
          </button>
        </div>
      </div>
    </div>
  );
};
