import React, { useState, useEffect } from "react";
import { Download, Upload, RefreshCw, X, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { GithubIcon } from "./GithubIcon";

interface GitSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGitSync: (action: "pull" | "push" | "sync", message?: string) => Promise<{ success: boolean; output?: string; lastCommit?: string; error?: string }>;
  isSyncing: boolean;
}

export const GitSyncModal: React.FC<GitSyncModalProps> = ({
  isOpen,
  onClose,
  onGitSync,
  isSyncing,
}) => {
  const [selectedAction, setSelectedAction] = useState<"sync" | "push" | "pull">("sync");
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [statusOutput, setStatusOutput] = useState<string | null>(null);
  const [isError, setIsError] = useState<boolean>(false);
  const [lastCommit, setLastCommit] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStatusOutput(null);
      setIsError(false);
      setCommitMessage("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSyncing) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSyncing, onClose]);

  if (!isOpen) return null;

  const handleExecute = async () => {
    if (isSyncing) return;
    setStatusOutput(null);
    setIsError(false);

    const result = await onGitSync(selectedAction, commitMessage.trim() || undefined);
    if (result.success) {
      setIsError(false);
      setStatusOutput(result.output || "Completed successfully.");
      if (result.lastCommit) setLastCommit(result.lastCommit);
    } else {
      setIsError(true);
      setStatusOutput(result.error || "Git operation failed.");
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
        if (e.target === e.currentTarget && !isSyncing) onClose();
      }}
    >
      <div
        style={{
          background: "var(--bg-card, #1e293b)",
          borderRadius: "16px",
          border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
          boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.5)",
          width: "100%",
          maxWidth: "520px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header */}
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
                background: "rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#10b981",
              }}
            >
              <GithubIcon size={18} />
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
                GitHub Synchronization
              </h3>
              <p
                style={{
                  margin: "2px 0 0 0",
                  fontSize: "0.8rem",
                  color: "var(--text-muted, #94a3b8)",
                }}
              >
                Sync local workspace directory with GitHub remote repository
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSyncing}
            style={{
              background: "transparent",
              border: "none",
              cursor: isSyncing ? "not-allowed" : "pointer",
              padding: 6,
              color: "var(--text-muted, #94a3b8)",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Action selection tabs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => setSelectedAction("sync")}
              style={{
                padding: "0.75rem 0.5rem",
                borderRadius: "8px",
                border: `1px solid ${selectedAction === "sync" ? "#10b981" : "var(--border-color, rgba(255, 255, 255, 0.08))"}`,
                background: selectedAction === "sync" ? "rgba(16, 185, 129, 0.12)" : "var(--bg-card-subtle, rgba(255, 255, 255, 0.02))",
                color: selectedAction === "sync" ? "#10b981" : "var(--text-muted, #94a3b8)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                fontSize: "0.8rem",
                fontWeight: 600,
                transition: "all 0.15s ease",
              }}
            >
              <RefreshCw size={16} />
              <span>Full Sync</span>
              <span style={{ fontSize: "0.7rem", fontWeight: 400, opacity: 0.8 }}>Pull & Push</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedAction("push")}
              style={{
                padding: "0.75rem 0.5rem",
                borderRadius: "8px",
                border: `1px solid ${selectedAction === "push" ? "#10b981" : "var(--border-color, rgba(255, 255, 255, 0.08))"}`,
                background: selectedAction === "push" ? "rgba(16, 185, 129, 0.12)" : "var(--bg-card-subtle, rgba(255, 255, 255, 0.02))",
                color: selectedAction === "push" ? "#10b981" : "var(--text-muted, #94a3b8)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                fontSize: "0.8rem",
                fontWeight: 600,
                transition: "all 0.15s ease",
              }}
            >
              <Upload size={16} />
              <span>Push</span>
              <span style={{ fontSize: "0.7rem", fontWeight: 400, opacity: 0.8 }}>Commit & Push</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedAction("pull")}
              style={{
                padding: "0.75rem 0.5rem",
                borderRadius: "8px",
                border: `1px solid ${selectedAction === "pull" ? "#10b981" : "var(--border-color, rgba(255, 255, 255, 0.08))"}`,
                background: selectedAction === "pull" ? "rgba(16, 185, 129, 0.12)" : "var(--bg-card-subtle, rgba(255, 255, 255, 0.02))",
                color: selectedAction === "pull" ? "#10b981" : "var(--text-muted, #94a3b8)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                fontSize: "0.8rem",
                fontWeight: 600,
                transition: "all 0.15s ease",
              }}
            >
              <Download size={16} />
              <span>Pull</span>
              <span style={{ fontSize: "0.7rem", fontWeight: 400, opacity: 0.8 }}>Fetch Updates</span>
            </button>
          </div>

          {/* Description of current action */}
          <div
            style={{
              fontSize: "0.8rem",
              color: "var(--text-muted, #94a3b8)",
              background: "var(--bg-card-subtle, rgba(0, 0, 0, 0.2))",
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              border: "1px solid var(--border-color, rgba(255, 255, 255, 0.05))",
              lineHeight: 1.5,
            }}
          >
            {selectedAction === "sync" && (
              <>
                <strong>Full Sync (Recommended):</strong> Pulls latest upstream commits from GitHub, stages all modified and new files in this directory, and pushes them to your repository.
              </>
            )}
            {selectedAction === "push" && (
              <>
                <strong>Push to GitHub:</strong> Automatically stages any local changes (code, markdown docs, sessions), commits them, and pushes directly to GitHub.
              </>
            )}
            {selectedAction === "pull" && (
              <>
                <strong>Pull from GitHub:</strong> Fetches and fast-forwards new commits from remote GitHub origin branch.
              </>
            )}
          </div>

          {/* Optional Commit Message input for push/sync */}
          {(selectedAction === "push" || selectedAction === "sync") && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-main, #f8fafc)",
                  marginBottom: "0.35rem",
                }}
              >
                Commit Message (Optional):
              </label>
              <input
                type="text"
                placeholder="chore(sync): automated update"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                disabled={isSyncing}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, rgba(255, 255, 255, 0.15))",
                  background: "var(--bg-input, rgba(0, 0, 0, 0.25))",
                  color: "var(--text-main, #f8fafc)",
                  fontSize: "0.85rem",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {/* Execution Result Log */}
          {statusOutput && (
            <div
              style={{
                borderRadius: "8px",
                border: `1px solid ${isError ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                background: isError ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)",
                padding: "0.75rem 1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                maxHeight: "160px",
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", fontWeight: 600, color: isError ? "#ef4444" : "#10b981" }}>
                {isError ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                <span>{isError ? "Sync Encountered an Error" : "Operation Succeeded"}</span>
              </div>
              <pre
                style={{
                  margin: 0,
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "0.75rem",
                  color: "var(--text-main, #f8fafc)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {statusOutput}
              </pre>
            </div>
          )}

          {lastCommit && !isError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.75rem",
                color: "var(--text-muted, #94a3b8)",
              }}
            >
              <Clock size={13} />
              <span>Latest commit: <code>{lastCommit}</code></span>
            </div>
          )}
        </div>

        {/* Footer */}
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
            disabled={isSyncing}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              border: "1px solid var(--border-color, rgba(255, 255, 255, 0.15))",
              background: "transparent",
              color: "var(--text-muted, #94a3b8)",
              cursor: isSyncing ? "not-allowed" : "pointer",
              fontSize: "0.85rem",
              fontWeight: 500,
            }}
          >
            {statusOutput ? "Close" : "Cancel"}
          </button>

          <button
            type="button"
            disabled={isSyncing}
            onClick={handleExecute}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "8px",
              border: "none",
              background: isSyncing ? "#059669" : "#10b981",
              color: "#ffffff",
              cursor: isSyncing ? "not-allowed" : "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
              transition: "all 0.15s ease",
            }}
          >
            {isSyncing ? (
              <>
                <RefreshCw size={15} className="spin" />
                <span>Running Git {selectedAction.toUpperCase()}...</span>
              </>
            ) : (
              <>
                <GithubIcon size={15} />
                <span>Execute {selectedAction === "sync" ? "Full Sync" : selectedAction === "push" ? "Push" : "Pull"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
