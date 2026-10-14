import React, { useState, useId } from "react";
import { Download, X, FileText, Filter, FileCode2, FileSpreadsheet, Loader2 } from "lucide-react";
import { generateStandaloneExportHtml, downloadHtmlFile } from "../utils/htmlExport";
import { exportToWord } from "../utils/wordExport";

export interface ExportMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: Array<{ id: string; name: string; dataUrl: string }>;
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

  // Option 1: Remove Welcome Greeting (only active by default if a welcome message actually exists in session)
  const hasWelcomeMessage = messages.some((m) => m.id === "welcome");
  const [excludeFirstAssistant, setExcludeFirstAssistant] = useState<boolean>(hasWelcomeMessage);

  // Option 2: Remove all user queries (keep only assistant responses / reports)
  const [excludeUserQueries, setExcludeUserQueries] = useState<boolean>(false);

  // Export Format: "html" or "docx"
  const [exportFormat, setExportFormat] = useState<"html" | "docx">("html");
  const [isExporting, setIsExporting] = useState<boolean>(false);

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

  // Filter messages according to selected options
  const filteredMessages = messages.filter((m) => {
    // Check 1: Exclude Welcome Greeting / first greeting message if chosen
    if (excludeFirstAssistant && m.id === "welcome") {
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

  const handleExport = async () => {
    if (filteredMessages.length === 0 || isExporting) return;

    const baseTitle = sessionFileName
      ? sessionFileName.replace(/\.md$/i, "")
      : "Chat Session Export";

    // Helper: format message content with any attached images (without showing filename/caption)
    const formatMessageWithImages = (m: ExportMessage, headerText: string) => {
      let text = `### ${headerText}\n\n${m.content}`;
      if (m.images && m.images.length > 0) {
        const imageMarkdown = m.images
          .map((img) => `\n\n![](${img.dataUrl})`)
          .join("");
        text += imageMarkdown;
      }
      return text;
    };

    // Build markdown representation
    let combinedMarkdown = "";
    if (excludeUserQueries) {
      combinedMarkdown = filteredMessages
        .map((m, i) => {
          const header = filteredMessages.length > 1 ? `🤖 Assistant Response #${i + 1}` : "🤖 Assistant Response";
          return formatMessageWithImages(m, header);
        })
        .join("\n\n---\n\n");
    } else {
      combinedMarkdown = filteredMessages
        .map((m) => {
          const header = m.role === "user" ? "👤 User Query" : "🤖 Assistant Response";
          return formatMessageWithImages(m, header);
        })
        .join("\n\n---\n\n");
    }

    const cleanBaseName = baseTitle.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, "_");

    if (exportFormat === "docx") {
      try {
        setIsExporting(true);
        const filename = `${cleanBaseName}.docx`;
        await exportToWord(combinedMarkdown, filename, baseTitle);
        onClose();
      } catch (err) {
        console.error("Docx export failed:", err);
        alert(`Failed to export Word document: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsExporting(false);
      }
    } else {
      const html = generateStandaloneExportHtml(combinedMarkdown, baseTitle);
      const filename = `${cleanBaseName}.html`;
      downloadHtmlFile(html, filename);
      onClose();
    }
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
                Export Conversation
              </h3>
              <p
                style={{
                  margin: "2px 0 0 0",
                  fontSize: "0.8rem",
                  color: "var(--text-muted, #94a3b8)",
                }}
              >
                Download as Standalone HTML or MS Word Document (.docx)
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
          {/* Export Format Selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Export Format
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setExportFormat("html")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  padding: "0.75rem 0.85rem",
                  borderRadius: "10px",
                  border: exportFormat === "html" ? "1.5px solid var(--accent, #0284c7)" : "1px solid var(--border-color, rgba(255,255,255,0.08))",
                  background: exportFormat === "html" ? "rgba(2, 132, 199, 0.12)" : "var(--bg-card-subtle, rgba(255, 255, 255, 0.02))",
                  color: exportFormat === "html" ? "var(--accent, #0284c7)" : "var(--text-main, #f8fafc)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <FileCode2 size={20} color={exportFormat === "html" ? "var(--accent, #0284c7)" : "#94a3b8"} />
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>Standalone HTML</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted, #94a3b8)" }}>Interactive, offline vector diagrams</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat("docx")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  padding: "0.75rem 0.85rem",
                  borderRadius: "10px",
                  border: exportFormat === "docx" ? "1.5px solid #2563eb" : "1px solid var(--border-color, rgba(255,255,255,0.08))",
                  background: exportFormat === "docx" ? "rgba(37, 99, 235, 0.12)" : "var(--bg-card-subtle, rgba(255, 255, 255, 0.02))",
                  color: exportFormat === "docx" ? "#3b82f6" : "var(--text-main, #f8fafc)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <FileSpreadsheet size={20} color={exportFormat === "docx" ? "#3b82f6" : "#94a3b8"} />
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>MS Word (.docx)</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted, #94a3b8)" }}>Native OpenXML, embedded images</div>
                </div>
              </button>
            </div>
          </div>

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
                  Remove initial Welcome Greeting
                </div>
                <div
                  style={{
                    fontSize: "0.775rem",
                    color: "var(--text-muted, #94a3b8)",
                    lineHeight: 1.4,
                  }}
                >
                  Omits the initial bot greeting message from the exported report.
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
            disabled={filteredMessages.length === 0 || isExporting}
            onClick={handleExport}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "8px",
              border: "none",
              background: isExporting
                ? "#64748b"
                : filteredMessages.length > 0
                ? exportFormat === "docx"
                  ? "#2563eb"
                  : "var(--accent, #0284c7)"
                : "#475569",
              color: "#ffffff",
              cursor: filteredMessages.length > 0 && !isExporting ? "pointer" : "not-allowed",
              fontSize: "0.85rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              boxShadow: filteredMessages.length > 0 && !isExporting ? `0 2px 8px ${exportFormat === "docx" ? "rgba(37, 99, 235, 0.35)" : "rgba(2, 132, 199, 0.3)"}` : "none",
              transition: "all 0.15s ease",
            }}
          >
            {isExporting ? (
              <>
                <Loader2 size={15} className="spin" />
                Generating Word Doc...
              </>
            ) : (
              <>
                <Download size={15} />
                {exportFormat === "docx" ? "Export Word (.docx)" : "Export HTML"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
