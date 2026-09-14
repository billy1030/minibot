import React, { useState, useEffect } from "react";
import { Wrench, X, RefreshCw, Plus, Trash2, CheckCircle2, AlertCircle, Box } from "lucide-react";

export interface ToolItem {
  serverName: string;
  name: string;
  description?: string;
  inputSchema?: any;
}

interface ToolHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  tools: ToolItem[];
  onRefreshTools: () => Promise<void>;
  onInstallServer: (serverData: { name: string; command?: string; args?: string[]; url?: string; description?: string }) => Promise<{ success: boolean; error?: string }>;
  onDeleteServer: (serverName: string) => Promise<{ success: boolean; error?: string }>;
}

export const ToolHubModal: React.FC<ToolHubModalProps> = ({
  isOpen,
  onClose,
  tools,
  onRefreshTools,
  onInstallServer,
  onDeleteServer,
}) => {
  const [activeTab, setActiveTab] = useState<"installed" | "install">("installed");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Form states for installing an MCP server
  const [serverName, setServerName] = useState("");
  const [installType, setInstallType] = useState<"stdio" | "url">("stdio");
  const [command, setCommand] = useState("npx");
  const [argsText, setArgsText] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (isOpen) {
      setMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Group tools by serverName
  const groupedTools = tools.reduce((acc, tool) => {
    const sName = tool.serverName || "built-in";
    if (!acc[sName]) acc[sName] = [];
    acc[sName].push(tool);
    return acc;
  }, {} as Record<string, ToolItem[]>);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setMessage(null);
    try {
      await onRefreshTools();
      setMessage({ text: "Tools refreshed successfully!", isError: false });
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to refresh tools", isError: true });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverName.trim()) {
      setMessage({ text: "Server name is required", isError: true });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const parsedArgs = argsText.trim()
      ? argsText.split("\n").map((s) => s.trim()).filter(Boolean)
      : [];

    const res = await onInstallServer({
      name: serverName.trim(),
      command: installType === "stdio" ? command.trim() : undefined,
      args: installType === "stdio" ? parsedArgs : undefined,
      url: installType === "url" ? url.trim() : undefined,
      description: description.trim() || undefined,
    });

    setIsSubmitting(false);
    if (res.success) {
      setMessage({ text: `Server "${serverName}" registered successfully!`, isError: false });
      setServerName("");
      setArgsText("");
      setUrl("");
      setDescription("");
      await onRefreshTools();
      setActiveTab("installed");
    } else {
      setMessage({ text: res.error || "Installation failed", isError: true });
    }
  };

  const handleDelete = async (sName: string) => {
    if (confirm(`Are you sure you want to unregister server "${sName}"?`)) {
      const res = await onDeleteServer(sName);
      if (res.success) {
        await onRefreshTools();
      } else {
        alert(res.error || "Failed to remove server");
      }
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
        zIndex: 9999,
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 820,
          maxHeight: "88vh",
          backgroundColor: "var(--bg-card, #1e2433)",
          color: "var(--text-main, #f8fafc)",
          borderRadius: 14,
          border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color, rgba(255, 255, 255, 0.08))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Wrench size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                Agentic Tools & Skills Hub
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: "rgba(59, 130, 246, 0.2)",
                    color: "#60a5fa",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                  }}
                >
                  {tools.length} Active Tools
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted, #94a3b8)" }}>
                Hot-reloadable Model Context Protocol (MCP) servers & autonomous document tools
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh tools from active servers"
              style={{
                background: "transparent",
                border: "1px solid var(--border-color, rgba(255,255,255,0.15))",
                color: "var(--text-main)",
                borderRadius: 7,
                padding: "6px 12px",
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <RefreshCw size={13} className={isRefreshing ? "spin" : ""} />
              Refresh
            </button>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted, #94a3b8)",
                cursor: "pointer",
                padding: 4,
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            gap: 12,
            padding: "10px 20px 0 20px",
            borderBottom: "1px solid var(--border-color, rgba(255, 255, 255, 0.08))",
          }}
        >
          <button
            onClick={() => setActiveTab("installed")}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === "installed" ? "2px solid #3b82f6" : "2px solid transparent",
              color: activeTab === "installed" ? "#60a5fa" : "var(--text-muted, #94a3b8)",
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Active Servers & Capabilities ({Object.keys(groupedTools).length})
          </button>
          <button
            onClick={() => setActiveTab("install")}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === "install" ? "2px solid #3b82f6" : "2px solid transparent",
              color: activeTab === "install" ? "#60a5fa" : "var(--text-muted, #94a3b8)",
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Plus size={14} /> Add / Connect MCP Server
          </button>
        </div>

        {/* Notification / Feedback Bar */}
        {message && (
          <div
            style={{
              margin: "12px 20px 0 20px",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 12.5,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: message.isError ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)",
              color: message.isError ? "#f87171" : "#4ade80",
              border: `1px solid ${message.isError ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.3)"}`,
            }}
          >
            {message.isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            {message.text}
          </div>
        )}

        {/* Modal Body */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          {activeTab === "installed" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {Object.entries(groupedTools).map(([sName, sTools]) => (
                <div
                  key={sName}
                  style={{
                    borderRadius: 10,
                    border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
                    background: "var(--bg-surface, rgba(255, 255, 255, 0.03))",
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Box size={16} color="#3b82f6" />
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{sName}</span>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 7px",
                          borderRadius: 6,
                          background: "rgba(34, 197, 94, 0.15)",
                          color: "#4ade80",
                          fontWeight: 600,
                        }}
                      >
                        ● Connected ({sTools.length} tools)
                      </span>
                    </div>

                    {!["web-search", "minimax-multimodal"].includes(sName) && (
                      <button
                        onClick={() => handleDelete(sName)}
                        title="Unregister MCP Server"
                        style={{
                          background: "rgba(239, 68, 68, 0.1)",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          color: "#f87171",
                          borderRadius: 6,
                          padding: "4px 8px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11.5,
                        }}
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    )}
                  </div>

                  {/* List of tools */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 8 }}>
                    {sTools.map((t) => (
                      <div
                        key={t.name}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: "rgba(0, 0, 0, 0.2)",
                          border: "1px solid rgba(255, 255, 255, 0.05)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <span style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 600, color: "#93c5fd" }}>
                            {t.name}
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--text-muted, #94a3b8)", lineHeight: 1.4 }}>
                          {t.description || "No description provided."}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "install" && (
            <form onSubmit={handleInstall} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                  Server Identifier / Name:
                </label>
                <input
                  type="text"
                  placeholder="e.g. sqlite-db, github-tools, weather-mcp"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 7,
                    border: "1px solid var(--border-color, rgba(255,255,255,0.15))",
                    background: "rgba(0,0,0,0.25)",
                    color: "#fff",
                    fontSize: 13,
                    outline: "none",
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                  Transport Type:
                </label>
                <div style={{ display: "flex", gap: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="transportType"
                      checked={installType === "stdio"}
                      onChange={() => setInstallType("stdio")}
                    />
                    Stdio (Local Process / npx / python)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="transportType"
                      checked={installType === "url"}
                      onChange={() => setInstallType("url")}
                    />
                    Remote HTTP / SSE
                  </label>
                </div>
              </div>

              {installType === "stdio" ? (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                      Command / Executable:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. npx, node, python, uvx"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 7,
                        border: "1px solid var(--border-color, rgba(255,255,255,0.15))",
                        background: "rgba(0,0,0,0.25)",
                        color: "#fff",
                        fontSize: 13,
                        outline: "none",
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                      Arguments (one per line):
                    </label>
                    <textarea
                      placeholder={"-y\n@modelcontextprotocol/server-sqlite\n--db-path\ntest.db"}
                      value={argsText}
                      onChange={(e) => setArgsText(e.target.value)}
                      rows={4}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 7,
                        border: "1px solid var(--border-color, rgba(255,255,255,0.15))",
                        background: "rgba(0,0,0,0.25)",
                        color: "#fff",
                        fontSize: 13,
                        fontFamily: "monospace",
                        outline: "none",
                      }}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                    MCP Server URL:
                  </label>
                  <input
                    type="url"
                    placeholder="https://my-mcp-server.internal/mcp"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 7,
                      border: "1px solid var(--border-color, rgba(255,255,255,0.15))",
                      background: "rgba(0,0,0,0.25)",
                      color: "#fff",
                      fontSize: 13,
                      outline: "none",
                    }}
                    required
                  />
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                  Description / Purpose (Optional):
                </label>
                <input
                  type="text"
                  placeholder="Provides SQLite local database queries"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 7,
                    border: "1px solid var(--border-color, rgba(255,255,255,0.15))",
                    background: "rgba(0,0,0,0.25)",
                    color: "#fff",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab("installed")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 7,
                    border: "1px solid var(--border-color, rgba(255,255,255,0.15))",
                    background: "transparent",
                    color: "var(--text-main)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 7,
                    border: "none",
                    background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {isSubmitting ? <RefreshCw size={14} className="spin" /> : <Plus size={14} />}
                  Connect & Hot-Reload
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
