import React, { useState, useEffect } from "react";
import {
  FileUp,
  X,
  FileSpreadsheet,
  FileText,
  Trash2,
  Loader2,
  Paperclip,
  CheckCircle2,
  Info,
  Image as ImageIcon
} from "lucide-react";

export interface DocumentItem {
  hash: string;
  originalName: string;
  extension: string;
  fileSize: number;
  charCount: number;
  createdAt: string;
  previewSnippet: string;
  sheetCount?: number;
  sheetNames?: string[];
}

interface UploadDocModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDocHashes: string[];
  onAddDocHash: (hash: string) => void;
  onRemoveDocHash: (hash: string) => void;
  showAlert: (message: string, type?: "success" | "error" | "warning" | "info", title?: string) => void;
  showConfirm: (message: string, onConfirm: () => void, title?: string, confirmLabel?: string) => void;
}

export const UploadDocModal: React.FC<UploadDocModalProps> = ({
  isOpen,
  onClose,
  activeDocHashes,
  onAddDocHash,
  onRemoveDocHash,
  showAlert,
  showConfirm,
}) => {
  const [sessionDocuments, setSessionDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<DocumentItem | null>(null);

  // Fetch only the documents specifically associated with the current session's hashes
  const fetchSessionDocuments = async () => {
    if (activeDocHashes.length === 0) {
      setSessionDocuments([]);
      setSelectedPreview(null);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/documents/by-hashes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ hashes: activeDocHashes }),
      });
      const data = await res.json();
      if (data.success && data.documents) {
        setSessionDocuments(data.documents);
        if (data.documents.length > 0 && !selectedPreview) {
          setSelectedPreview(data.documents[0]);
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch session documents:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessionDocuments();
    }
  }, [isOpen, activeDocHashes]);

  if (!isOpen) return null;

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsUploading(true);

    let uploadedCount = 0;
    let duplicateCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const base64 = await fileToBase64(file);
        const res = await fetch("/api/documents/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            fileName: file.name,
            fileBase64: base64,
          }),
        });

        const contentType = res.headers.get("content-type") || "";
        let data: any;

        if (contentType.includes("application/json")) {
          data = await res.json();
        } else {
          const rawText = await res.text();
          throw new Error(`Server returned HTTP ${res.status}: ${rawText.slice(0, 120)}`);
        }

        if (data.success && data.document) {
          if (data.isDuplicate) {
            duplicateCount++;
          } else {
            uploadedCount++;
          }
          // Bind document hash specifically to this session
          onAddDocHash(data.document.hash);
        } else {
          showAlert(`Failed to ingest ${file.name}: ${data.error || "Unknown error"}`, "error", "Upload Failed");
        }
      } catch (err: any) {
        showAlert(`Error uploading ${file.name}: ${err.message}`, "error", "Network Error");
      }
    }

    setIsUploading(false);

    if (uploadedCount > 0 || duplicateCount > 0) {
      showAlert(
        `Added to current conversation!\n✨ ${uploadedCount} new converted file(s)\n⚡ ${duplicateCount} matched existing CAS cache (deduplicated).`,
        "success",
        "Attached to Session"
      );
    }
  };

  const handleDetachFromSession = (doc: DocumentItem) => {
    showConfirm(
      `Are you sure you want to remove this attachment from the current session?\n\nFilename: ${doc.originalName}`,
      () => {
        onRemoveDocHash(doc.hash);
        if (selectedPreview?.hash === doc.hash) {
          setSelectedPreview(null);
        }
      },
      "Remove Attachment Confirmation",
      "Confirm Remove"
    );
  };

  const getDocIcon = (doc: DocumentItem) => {
    const ext = doc.extension.toLowerCase();
    if (ext.includes("xls") || ext.includes("csv")) {
      return <FileSpreadsheet size={16} color="#10b981" />;
    }
    if (ext.includes("png") || ext.includes("jpg") || ext.includes("jpeg") || ext.includes("webp") || ext.includes("gif") || ext.includes("svg")) {
      return <ImageIcon size={16} color="#8b5cf6" />;
    }
    return <FileText size={16} color="var(--accent)" />;
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(960px, 95vw)",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          borderRadius: 14,
          padding: 24,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 45px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
              <Paperclip size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                Session Attachments
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "rgba(2, 132, 199, 0.12)", color: "var(--accent)", fontWeight: 600 }}>
                  Scoped to Current Chat Only
                </span>
              </h2>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                Documents & screenshots uploaded here are attached to this conversation session (Excel, Word, PDF, Text, and Images).
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 6,
              borderRadius: 6,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Upload Dropzone */}
        <div
          style={{
            border: "2px dashed var(--border-color)",
            borderRadius: 10,
            padding: "16px 20px",
            background: "var(--bg-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <FileUp size={24} color="#10b981" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)" }}>
                Attach Multi-Tab Excel (.xlsx, .xls, .csv), PDF, Word (.docx), or Text
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Files are deduplicated on disk and only accessible within this specific conversation.
              </div>
            </div>
          </div>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 18px",
              borderRadius: 8,
              background: "#10b981",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: isUploading ? "not-allowed" : "pointer",
              boxShadow: "0 2px 4px rgba(16, 185, 129, 0.25)",
            }}
          >
            {isUploading ? <Loader2 size={15} className="spin" /> : <FileUp size={15} />}
            {isUploading ? "Uploading..." : "Attach File"}
            <input
              type="file"
              multiple
              accept=".xlsx,.xls,.csv,.pdf,.docx,.txt,.md,.json,.html,.png,.jpg,.jpeg,.webp,.gif"
              style={{ display: "none" }}
              disabled={isUploading}
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </label>
        </div>

        {/* Status Count */}
        <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
          {sessionDocuments.length} attachment(s) active in this conversation
        </div>

        {/* Main Content Area: Left Doc List, Right Text Preview */}
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16, height: 380, overflow: "hidden" }}>
          {/* Documents List */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              height: "100%",
              overflowY: "auto",
              padding: 8,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {isLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
                <Loader2 size={16} className="spin" /> Loading attachments...
              </div>
            ) : sessionDocuments.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, color: "var(--text-muted)", fontSize: 13, padding: 20, textAlign: "center" }}>
                <Info size={24} />
                No documents attached to this conversation yet. Use "Attach File" above to add context.
              </div>
            ) : (
              sessionDocuments.map((doc) => {
                const isSelected = selectedPreview?.hash === doc.hash;

                return (
                  <div
                    key={doc.hash}
                    onClick={() => setSelectedPreview(doc)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: isSelected ? "rgba(16, 185, 129, 0.08)" : "var(--bg-secondary)",
                      border: isSelected ? "1px solid #10b981" : "1px solid var(--border-color)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
                      {getDocIcon(doc)}

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {doc.originalName}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                          <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>{doc.charCount.toLocaleString()} chars</span>
                          {doc.sheetCount && (
                            <>
                              <span>•</span>
                              <span style={{ color: "#10b981", fontWeight: 600 }}>{doc.sheetCount} tab(s)</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDetachFromSession(doc);
                      }}
                      title="Detach from this conversation"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        padding: 4,
                        borderRadius: 4,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Text / Markdown Preview Pane */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflow: "hidden",
              boxSizing: "border-box",
            }}
          >
            {selectedPreview ? (
              <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, borderBottom: "1px solid var(--border-color)", paddingBottom: 8, flexShrink: 0 }}>
                  <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {selectedPreview.originalName}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      SHA-256: {selectedPreview.hash.slice(0, 24)}...
                    </div>
                  </div>
                  {selectedPreview.sheetNames && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flexShrink: 0 }}>
                      {selectedPreview.sheetNames.map((s) => (
                        <span key={s} style={{ fontSize: 10, background: "rgba(16, 185, 129, 0.15)", color: "#10b981", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, flexShrink: 0 }}>
                  PREPROCESSED TEXT (INJECTED INTO THIS CHAT):
                </div>
                <pre
                  style={{
                    flex: 1,
                    minHeight: 0,
                    margin: 0,
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: 6,
                    padding: 10,
                    fontSize: 11.5,
                    lineHeight: 1.5,
                    color: "var(--text-main)",
                    fontFamily: "ui-monospace, monospace",
                    overflowY: "auto",
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {selectedPreview.previewSnippet.slice(0, 1024)}
                  {selectedPreview.charCount > 1024 ? "\n\n... (preview truncated at 1,024 chars, full text grounded into this conversation)" : ""}
                </pre>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 13 }}>
                Select an attachment to view its preprocessed content
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, borderTop: "1px solid var(--border-color)", paddingTop: 14 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 22px",
              borderRadius: 6,
              background: "#1f6feb",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              boxShadow: "0 2px 4px rgba(31, 111, 235, 0.25)",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
