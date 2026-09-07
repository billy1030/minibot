import { useState, useEffect } from "react";
import {
  X,
  GitFork,
  Bot,
  User,
  Wrench,
  Clock,
  Layers,
  Copy,
  Check,
  Loader2,
  Paperclip,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ThoughtBlock } from "./ThoughtBlock";

interface SubConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionFilename: string | null;
  workspace?: string;
  onCloneSuccess: (newFilename: string) => void;
  showAlert: (message: string, type?: "success" | "error" | "warning" | "info", title?: string) => void;
}

interface TurnData {
  turnIndex: number;
  userPrompt: string;
  assistantAnswer: string;
  toolCalls: any[];
  timestamp?: number;
  duration?: number;
  charCount: number;
}

interface DocDetail {
  hash: string;
  originalName: string;
  extension: string;
  fileSize: number;
}

export function SubConversationModal({
  isOpen,
  onClose,
  sessionFilename,
  workspace = "default",
  onCloneSuccess,
  showAlert,
}: SubConversationModalProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [cloning, setCloning] = useState<boolean>(false);
  const [turns, setTurns] = useState<TurnData[]>([]);
  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number>(1);
  const [sessionTitle, setSessionTitle] = useState<string>("");
  const [forkLevel, setForkLevel] = useState<number>(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Attachment management state for cloning
  const [attachedDocs, setAttachedDocs] = useState<DocDetail[]>([]);
  const [selectedDocHashes, setSelectedDocHashes] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && sessionFilename) {
      loadSessionTurns(sessionFilename);
    } else {
      setTurns([]);
      setSelectedTurnIndex(1);
      setSessionTitle("");
      setForkLevel(0);
      setAttachedDocs([]);
      setSelectedDocHashes([]);
    }
  }, [isOpen, sessionFilename]);

  const loadSessionTurns = async (filename: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/logs/${encodeURIComponent(filename)}?workspace=${encodeURIComponent(workspace)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load session details");
      const data = await res.json();
      setSessionTitle(data.title || filename);
      setForkLevel(data.forkLevel || 0);

      const rawHashes: string[] = data.attachedDocHashes || [];
      setSelectedDocHashes(rawHashes);

      // Fetch document metadata for these hashes
      if (rawHashes.length > 0) {
        try {
          const docRes = await fetch("/api/documents/by-hashes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ hashes: rawHashes }),
          });
          const docData = await docRes.json();
          if (docData.success && docData.documents) {
            setAttachedDocs(docData.documents);
          } else {
            setAttachedDocs(rawHashes.map((h) => ({ hash: h, originalName: `Doc ${h.slice(0, 8)}`, extension: "txt", fileSize: 0 })));
          }
        } catch {
          setAttachedDocs(rawHashes.map((h) => ({ hash: h, originalName: `Doc ${h.slice(0, 8)}`, extension: "txt", fileSize: 0 })));
        }
      } else {
        setAttachedDocs([]);
      }

      // Group messages by turnIndex
      const messages: any[] = data.messages || [];
      const turnMap = new Map<number, TurnData>();

      for (const msg of messages) {
        const tIndex = msg.turnIndex || 1;
        if (!turnMap.has(tIndex)) {
          turnMap.set(tIndex, {
            turnIndex: tIndex,
            userPrompt: "",
            assistantAnswer: "",
            toolCalls: [],
            timestamp: msg.timestamp,
            duration: msg.duration,
            charCount: 0,
          });
        }
        const turnObj = turnMap.get(tIndex)!;
        if (msg.role === "user") {
          turnObj.userPrompt = msg.content || "";
        } else if (msg.role === "assistant") {
          turnObj.assistantAnswer = msg.content || "";
          turnObj.toolCalls = msg.toolCalls || [];
          if (msg.duration) turnObj.duration = msg.duration;
        }
      }

      const parsedTurns = Array.from(turnMap.values()).sort((a, b) => a.turnIndex - b.turnIndex);
      parsedTurns.forEach((t) => {
        t.charCount = (t.userPrompt?.length || 0) + (t.assistantAnswer?.length || 0);
      });

      setTurns(parsedTurns);
      if (parsedTurns.length > 0) {
        setSelectedTurnIndex(parsedTurns[0].turnIndex);
      }
    } catch (err: any) {
      console.error(err);
      showAlert(`Failed to load sub-conversations: ${err.message || err}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleDocSelection = (hash: string) => {
    setSelectedDocHashes((prev) =>
      prev.includes(hash) ? prev.filter((h) => h !== hash) : [...prev, hash]
    );
  };

  const MAX_FORK_LEVEL = 5;
  const isMaxForkReached = forkLevel >= MAX_FORK_LEVEL;

  const handleCloneTurn = async (mode: "single" | "up_to") => {
    if (!sessionFilename) return;
    if (isMaxForkReached) {
      showAlert(`Maximum fork level reached (Level ${MAX_FORK_LEVEL}), cannot fork further.`, "warning", "Fork Limit");
      return;
    }
    try {
      setCloning(true);
      const res = await fetch(`/api/logs/${encodeURIComponent(sessionFilename)}/clone-turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          turnIndex: selectedTurnIndex,
          mode,
          workspace,
          customDocHashes: selectedDocHashes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to clone sub-conversation");
      }

      showAlert(
        `Sub-conversation successfully forked as a new standalone session!\nFilename: ${data.newFilename}\nFork Level: Level ${data.forkLevel || (forkLevel + 1)} / ${MAX_FORK_LEVEL} (with ${selectedDocHashes.length} attachments)`,
        "success",
        "Fork Successful"
      );
      onClose();
      onCloneSuccess(data.newFilename);
    } catch (err: any) {
      showAlert(`Error cloning session: ${err.message || err}`, "error");
    } finally {
      setCloning(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!isOpen) return null;

  const currentTurn = turns.find((t) => t.turnIndex === selectedTurnIndex) || turns[0];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1050px",
          height: "85vh",
          maxHeight: "850px",
          backgroundColor: "var(--bg-card)",
          borderRadius: "14px",
          border: "1px solid var(--border-color)",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--bg-secondary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "rgba(37, 99, 235, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent)",
              }}
            >
              <Layers size={18} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)" }}>
                  Sub-Conversation Inspector & Branch
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 7px",
                    borderRadius: 12,
                    background: "rgba(37, 99, 235, 0.12)",
                    color: "var(--accent)",
                    fontWeight: 600,
                  }}
                >
                  {turns.length} {turns.length === 1 ? "Turn" : "Turns"}
                </span>

                {/* Fork Level Badge */}
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: isMaxForkReached ? "rgba(239, 68, 68, 0.15)" : "rgba(168, 85, 247, 0.15)",
                    color: isMaxForkReached ? "#ef4444" : "#a855f7",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <GitFork size={12} />
                  Level {forkLevel} / {MAX_FORK_LEVEL}
                  {isMaxForkReached ? " (MAX)" : ""}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "500px",
                }}
              >
                Source: {sessionTitle} ({sessionFilename})
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.15s, background-color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-main)";
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Left Column: Turn Navigation List */}
          <div
            style={{
              width: "290px",
              borderRight: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-primary)",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              padding: "12px",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                padding: "2px 4px 6px 4px",
              }}
            >
              Select Sub-Session (Turn)
            </div>

            {loading ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "30px 0",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                <Loader2 size={16} className="animate-spin" /> Loading turns...
              </div>
            ) : turns.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 10 }}>
                No turns found in this session.
              </div>
            ) : (
              turns.map((turn) => {
                const isSelected = turn.turnIndex === selectedTurnIndex;
                return (
                  <div
                    key={turn.turnIndex}
                    onClick={() => setSelectedTurnIndex(turn.turnIndex)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      cursor: "pointer",
                      background: isSelected ? "rgba(37, 99, 235, 0.15)" : "var(--bg-secondary)",
                      border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border-color)",
                      transition: "all 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: isSelected ? "var(--accent)" : "var(--text-main)",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        Turn #{turn.turnIndex}
                      </span>
                      {turn.toolCalls && turn.toolCalls.length > 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: "1px 5px",
                            borderRadius: 4,
                            background: "rgba(16, 185, 129, 0.15)",
                            color: "#10b981",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <Wrench size={10} /> {turn.toolCalls.length} tools
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {turn.userPrompt || "(No query text)"}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Turn Inspector & Fork Actions */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              backgroundColor: "var(--bg-card)",
              overflow: "hidden",
            }}
          >
            {/* Action Bar */}
            <div
              style={{
                padding: "12px 18px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "var(--bg-secondary)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>
                  Turn #{selectedTurnIndex} Overview
                </span>
                {currentTurn?.duration && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <Clock size={12} /> {currentTurn.duration}s
                  </span>
                )}
              </div>

              {/* Fork / Clone Actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isMaxForkReached ? (
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "#ef4444",
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      padding: "5px 10px",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <GitFork size={13} /> Max Fork Level (5) Reached
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => handleCloneTurn("single")}
                      disabled={cloning}
                      title={`Fork ONLY this selected turn into a new Level ${forkLevel + 1} conversation`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        borderRadius: 6,
                        background: "rgba(37, 99, 235, 0.1)",
                        border: "1px solid var(--accent)",
                        color: "var(--accent)",
                        cursor: cloning ? "not-allowed" : "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!cloning) e.currentTarget.style.background = "rgba(37, 99, 235, 0.2)";
                      }}
                      onMouseLeave={(e) => {
                        if (!cloning) e.currentTarget.style.background = "rgba(37, 99, 235, 0.1)";
                      }}
                    >
                      <GitFork size={14} />
                      {cloning ? "Cloning..." : `Fork Turn #${selectedTurnIndex} (Level ${forkLevel + 1})`}
                    </button>

                    {turns.length > 1 && (
                      <button
                        onClick={() => handleCloneTurn("up_to")}
                        disabled={cloning}
                        title={`Fork all turns up to Turn #${selectedTurnIndex} into a new Level ${forkLevel + 1} conversation`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 14px",
                          borderRadius: 6,
                          background: "var(--accent)",
                          border: "none",
                          color: "#fff",
                          cursor: cloning ? "not-allowed" : "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                          transition: "opacity 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!cloning) e.currentTarget.style.opacity = "0.9";
                        }}
                        onMouseLeave={(e) => {
                          if (!cloning) e.currentTarget.style.opacity = "1";
                        }}
                      >
                        <GitFork size={14} />
                        {cloning ? "Cloning..." : `Fork Up To #${selectedTurnIndex} (Level ${forkLevel + 1})`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Attachments Selection Bar (if the parent conversation has attachments) */}
            {attachedDocs.length > 0 && (
              <div
                style={{
                  padding: "10px 18px",
                  backgroundColor: "rgba(37, 99, 235, 0.04)",
                  borderBottom: "1px solid var(--border-color)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Paperclip size={13} color="var(--accent)" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)" }}>
                      Include Attachments in Forked Session ({selectedDocHashes.length}/{attachedDocs.length} selected)
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() => setSelectedDocHashes(attachedDocs.map((d) => d.hash))}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent)",
                        fontSize: 11,
                        cursor: "pointer",
                        padding: "2px 6px",
                      }}
                    >
                      Select All
                    </button>
                    <span style={{ color: "var(--border-color)", fontSize: 11 }}>|</span>
                    <button
                      onClick={() => setSelectedDocHashes([])}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        fontSize: 11,
                        cursor: "pointer",
                        padding: "2px 6px",
                      }}
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {/* Document Pill Checkboxes */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {attachedDocs.map((doc) => {
                    const isChecked = selectedDocHashes.includes(doc.hash);
                    return (
                      <div
                        key={doc.hash}
                        onClick={() => toggleDocSelection(doc.hash)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          cursor: "pointer",
                          backgroundColor: isChecked ? "rgba(37, 99, 235, 0.12)" : "var(--bg-primary)",
                          border: isChecked ? "1px solid var(--accent)" : "1px solid var(--border-color)",
                          color: isChecked ? "var(--accent)" : "var(--text-muted)",
                          transition: "all 0.15s ease",
                          userSelect: "none",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Handled by div onClick
                          style={{ cursor: "pointer", accentColor: "var(--accent)" }}
                        />
                        {doc.extension === "xlsx" || doc.extension === "csv" ? (
                          <FileSpreadsheet size={12} color={isChecked ? "var(--accent)" : "var(--text-muted)"} />
                        ) : (
                          <FileText size={12} color={isChecked ? "var(--accent)" : "var(--text-muted)"} />
                        )}
                        <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {doc.originalName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Scrollable Turn Content View */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              {currentTurn ? (
                <>
                  {/* User Question Block */}
                  <div
                    style={{
                      backgroundColor: "var(--bg-primary)",
                      borderRadius: 10,
                      border: "1px solid var(--border-color)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 14px",
                        backgroundColor: "rgba(37, 99, 235, 0.08)",
                        borderBottom: "1px solid var(--border-color)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <User size={14} color="var(--accent)" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)" }}>
                          User Prompt
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopy(currentTurn.userPrompt, 1)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                        }}
                      >
                        {copiedIndex === 1 ? (
                          <>
                            <Check size={12} color="#10b981" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy size={12} /> Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div
                      style={{
                        padding: "14px",
                        fontSize: 13,
                        color: "var(--text-main)",
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.5,
                      }}
                    >
                      {currentTurn.userPrompt || "(No user prompt recorded)"}
                    </div>
                  </div>

                  {/* Tool Calls Summary (if any) */}
                  {currentTurn.toolCalls && currentTurn.toolCalls.length > 0 && (
                    <div
                      style={{
                        backgroundColor: "var(--bg-primary)",
                        borderRadius: 10,
                        border: "1px solid var(--border-color)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          padding: "8px 14px",
                          backgroundColor: "rgba(16, 185, 129, 0.08)",
                          borderBottom: "1px solid var(--border-color)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Wrench size={14} color="#10b981" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)" }}>
                          MCP Tool Invocations ({currentTurn.toolCalls.length})
                        </span>
                      </div>
                      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                        {currentTurn.toolCalls.map((tc, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: 12,
                              fontFamily: "ui-monospace, monospace",
                              padding: "6px 10px",
                              borderRadius: 6,
                              backgroundColor: "var(--bg-secondary)",
                              border: "1px solid var(--border-color)",
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <span style={{ color: "var(--accent)" }}>{tc.toolName}</span>
                            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                              {tc.serverName || "tool"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assistant Synthesized Answer */}
                  <div
                    style={{
                      backgroundColor: "var(--bg-primary)",
                      borderRadius: 10,
                      border: "1px solid var(--border-color)",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 14px",
                        backgroundColor: "rgba(37, 99, 235, 0.08)",
                        borderBottom: "1px solid var(--border-color)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Bot size={14} color="var(--accent)" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)" }}>
                          Assistant Answer
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopy(currentTurn.assistantAnswer, 2)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                        }}
                      >
                        {copiedIndex === 2 ? (
                          <>
                            <Check size={12} color="#10b981" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy size={12} /> Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div
                      style={{
                        padding: "16px",
                        fontSize: 13,
                        color: "var(--text-main)",
                        lineHeight: 1.6,
                      }}
                    >
                      {(() => {
                        const raw = currentTurn.assistantAnswer || "";
                        let thoughtText = "";
                        let mainText = raw;

                        const thinkMatch = raw.match(/<think>([\s\S]*?)<\/think>/i);
                        if (thinkMatch) {
                          thoughtText = thinkMatch[1].trim();
                          mainText = raw.replace(/<think>[\s\S]*?<\/think>/i, "").trim();
                        } else if (raw.startsWith("<think>")) {
                          thoughtText = raw.replace("<think>", "").trim();
                          mainText = "";
                        }

                        return (
                          <>
                            {thoughtText && (
                              <ThoughtBlock
                                thoughtText={thoughtText}
                                viewMode="full"
                                defaultExpanded={true}
                              />
                            )}
                            <MarkdownRenderer content={mainText || (thoughtText ? "" : "(No response content)")} />
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
                  Select a sub conversation from the left to view its details.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
