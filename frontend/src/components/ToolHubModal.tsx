import React, { useState, useEffect } from "react";
import { Wrench, X, RefreshCw, Plus, Trash2, CheckCircle2, AlertCircle, Box, BookOpen, Globe, Folder, Code } from "lucide-react";

export interface ToolItem {
  serverName: string;
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface SkillItem {
  name: string;
  description: string;
  scope: "global" | "workspace";
  workspace?: string;
  dirPath: string;
  filePath: string;
  triggers?: string[];
}

interface ToolHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  tools: ToolItem[];
  onRefreshTools: () => Promise<void>;
  onInstallServer: (serverData: { name: string; command?: string; args?: string[]; url?: string; description?: string }) => Promise<{ success: boolean; error?: string }>;
  onDeleteServer: (serverName: string) => Promise<{ success: boolean; error?: string }>;
  currentWorkspace?: string;
}

export const ToolHubModal: React.FC<ToolHubModalProps> = ({
  isOpen,
  onClose,
  tools,
  onRefreshTools,
  onInstallServer,
  onDeleteServer,
  currentWorkspace = "default",
}) => {
  const [activeTab, setActiveTab] = useState<"installed" | "skills" | "install">("installed");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Skills state
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [selectedSkillContent, setSelectedSkillContent] = useState<{ name: string; content: string } | null>(null);
  const [isLoadingSkills, setIsLoadingSkills] = useState<boolean>(false);
  const [isCreatingSkill, setIsCreatingSkill] = useState<boolean>(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillScope, setNewSkillScope] = useState<"global" | "workspace">("workspace");
  const [newSkillContent, setNewSkillContent] = useState("");

  // Form states for installing an MCP server
  const [serverName, setServerName] = useState("");
  const [installType, setInstallType] = useState<"stdio" | "url">("stdio");
  const [command, setCommand] = useState("npx");
  const [argsText, setArgsText] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  const fetchSkills = async () => {
    setIsLoadingSkills(true);
    try {
      const res = await fetch(`/api/skills?workspace=${encodeURIComponent(currentWorkspace)}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.skills) {
        setSkills(data.skills);
      }
    } catch (e) {
      console.error("Failed to load skills:", e);
    } finally {
      setIsLoadingSkills(false);
    }
  };

  const loadSkillContent = async (skillName: string) => {
    if (selectedSkillContent?.name === skillName) {
      setSelectedSkillContent(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/skills/content?name=${encodeURIComponent(skillName)}&workspace=${encodeURIComponent(currentWorkspace)}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (data.success && data.content) {
        setSelectedSkillContent({ name: skillName, content: data.content });
      }
    } catch (err: any) {
      alert("Failed to fetch skill content: " + err.message);
    }
  };

  const handleSaveSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim() || !newSkillContent.trim()) {
      setMessage({ text: "Skill name and markdown content are required", isError: true });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newSkillName.trim(),
          content: newSkillContent.trim(),
          scope: newSkillScope,
          workspace: currentWorkspace,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ text: `Skill "${newSkillName}" created successfully!`, isError: false });
        setIsCreatingSkill(false);
        setNewSkillName("");
        setNewSkillContent("");
        await fetchSkills();
      } else {
        setMessage({ text: data.error || "Failed to save skill", isError: true });
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Network error", isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setMessage(null);
      fetchSkills();
    }
  }, [isOpen, currentWorkspace]);

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
      await Promise.all([onRefreshTools(), fetchSkills()]);
      setMessage({ text: "Tools and Skills refreshed successfully!", isError: false });
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to refresh", isError: true });
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
          width: "82vw",
          maxWidth: "82vw",
          maxHeight: "90vh",
          backgroundColor: "var(--bg-secondary, #ffffff)",
          color: "var(--text-main, #0f172a)",
          borderRadius: 14,
          border: "1px solid var(--border-color, #cbd5e1)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--border-color, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-card, #f8fafc)",
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
                    background: "rgba(59, 130, 246, 0.2)",
                    color: "#60a5fa",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontWeight: 600,
                  }}
                >
                  {tools.length} Tools Active • {skills.length} Skills
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)", marginTop: 2 }}>
                Dual-Scope MCP Hot-Reloading & Persistent Agent Skills (Workspace: <code>{currentWorkspace}</code>)
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh tools and skills"
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
            gap: 8,
            padding: "8px 24px 0 24px",
            borderBottom: "1px solid var(--border-color, #e2e8f0)",
            background: "var(--bg-secondary, #ffffff)",
          }}
        >
          <button
            onClick={() => setActiveTab("installed")}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === "installed" ? "2px solid #1d4ed8" : "2px solid transparent",
              color: activeTab === "installed" ? "#1d4ed8" : "var(--text-muted, #64748b)",
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Active MCP Servers ({Object.keys(groupedTools).length})
          </button>
          <button
            onClick={() => setActiveTab("skills")}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === "skills" ? "2px solid #1d4ed8" : "2px solid transparent",
              color: activeTab === "skills" ? "#1d4ed8" : "var(--text-muted, #64748b)",
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <BookOpen size={15} /> Skills Library ({skills.length})
          </button>
          <button
            onClick={() => setActiveTab("install")}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === "install" ? "2px solid #1d4ed8" : "2px solid transparent",
              color: activeTab === "install" ? "#1d4ed8" : "var(--text-muted, #64748b)",
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Plus size={15} /> Connect MCP Server
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
              {Object.keys(groupedTools).length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                  No active tools mounted.
                </div>
              ) : (
                Object.entries(groupedTools).map(([sName, sTools]) => (
                  <div
                    key={sName}
                    style={{
                      borderRadius: 10,
                      border: "1px solid var(--border-color, #e2e8f0)",
                      background: "var(--bg-secondary, #ffffff)",
                      overflow: "hidden",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div
                      style={{
                        padding: "14px 18px",
                        background: "var(--bg-card, #f8fafc)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottom: "1px solid var(--border-color, #e2e8f0)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Box size={18} color="#1d4ed8" />
                        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main, #0f172a)" }}>{sName}</span>
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "rgba(22, 163, 74, 0.12)",
                            color: "#15803d",
                            border: "1px solid rgba(22, 163, 74, 0.3)",
                            fontWeight: 600,
                          }}
                        >
                          {sTools.length} tools
                        </span>
                      </div>

                      {sName !== "web-search" && sName !== "minimax-multimodal" && (
                        <button
                          onClick={() => handleDelete(sName)}
                          title="Unregister this server"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#dc2626",
                            cursor: "pointer",
                            padding: 6,
                            borderRadius: 6,
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                      {sTools.map((tool) => (
                        <div
                          key={tool.name}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            padding: "12px 16px",
                            borderRadius: 8,
                            background: "var(--bg-card, #f8fafc)",
                            border: "1px solid var(--border-color, #e2e8f0)",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <code
                              style={{
                                fontSize: 13.5,
                                color: "#0f172a",
                                fontWeight: 800,
                                background: "rgba(2, 132, 199, 0.12)",
                                padding: "2px 8px",
                                borderRadius: 5,
                                border: "1px solid rgba(2, 132, 199, 0.25)",
                                letterSpacing: "0.2px",
                              }}
                            >
                              {tool.name}
                            </code>
                          </div>
                          {tool.description && (
                            <div
                              style={{
                                fontSize: 13,
                                color: "var(--text-main, #1e293b)",
                                lineHeight: 1.6,
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                marginTop: 2,
                              }}
                            >
                              {tool.description}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "skills" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  Skills are automatically resolved and injected when relevant prompts or triggers are detected.
                </div>
                <button
                  onClick={() => setIsCreatingSkill(!isCreatingSkill)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: "var(--accent, #2563eb)",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Plus size={13} /> {isCreatingSkill ? "Cancel" : "Add New Skill"}
                </button>
              </div>

              {isCreatingSkill && (
                <form
                  onSubmit={handleSaveSkill}
                  style={{
                    padding: 18,
                    borderRadius: 10,
                    background: "#fff1f2", // 非常淺的粉紅色 (Very light pink)
                    border: "1px solid #fecdd3", // 淺粉紅邊框
                    boxShadow: "0 2px 6px rgba(244, 63, 94, 0.06)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#881337", marginBottom: 6 }}>
                        Skill Name:
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. data-analyst, code-reviewer"
                        value={newSkillName}
                        onChange={(e) => setNewSkillName(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: 7,
                          border: "1px solid #fda4af",
                          background: "#ffffff",
                          color: "#0f172a",
                          fontSize: 13,
                          outline: "none",
                        }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#881337", marginBottom: 6 }}>
                        Scope:
                      </label>
                      <select
                        value={newSkillScope}
                        onChange={(e) => setNewSkillScope(e.target.value as any)}
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: 7,
                          border: "1px solid #fda4af",
                          background: "#ffffff",
                          color: "#0f172a",
                          fontSize: 13,
                          fontWeight: 600,
                          outline: "none",
                        }}
                      >
                        <option value="workspace">Per-Workspace ({currentWorkspace})</option>
                        <option value="global">Global (Available Everywhere)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#881337", marginBottom: 6 }}>
                      Markdown Recipe / SKILL.md Content:
                    </label>
                    <textarea
                      rows={8}
                      placeholder={`---\nname: my-skill\ndescription: How to accomplish task X\ntriggers: ["analyze", "review"]\n---\n\n## Instructions\nWhen the user asks...`}
                      value={newSkillContent}
                      onChange={(e) => setNewSkillContent(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 7,
                        border: "1px solid #fda4af",
                        background: "#ffffff",
                        color: "#0f172a",
                        fontSize: 12.5,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        outline: "none",
                        lineHeight: 1.5,
                      }}
                      required
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setIsCreatingSkill(false)}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 6,
                        border: "1px solid #fda4af",
                        background: "#ffffff",
                        color: "#881337",
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      style={{
                        padding: "7px 18px",
                        borderRadius: 6,
                        border: "none",
                        background: "linear-gradient(135deg, #e11d48, #be123c)",
                        color: "#fff",
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: "0 2px 4px rgba(225, 29, 72, 0.25)",
                      }}
                    >
                      {isSubmitting ? "Saving..." : "Save Skill"}
                    </button>
                  </div>
                </form>
              )}

              {isLoadingSkills ? (
                <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>Loading skills...</div>
              ) : skills.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>No skills discovered.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {skills.map((skill) => {
                    const isExpanded = selectedSkillContent?.name === skill.name;
                    return (
                      <div
                        key={skill.name}
                        style={{
                          borderRadius: 10,
                          background: "var(--bg-card, #f8fafc)",
                          border: isExpanded ? "1px solid #16a34a" : "1px solid var(--border-color, #e2e8f0)",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                          overflow: "hidden",
                          transition: "border-color 0.2s ease",
                        }}
                      >
                        <div
                          style={{
                            padding: "16px 20px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: 16,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span
                                style={{
                                  fontSize: 14,
                                  fontWeight: 800,
                                  color: "#0f172a",
                                  background: "rgba(2, 132, 199, 0.12)",
                                  padding: "2px 8px",
                                  borderRadius: 5,
                                  border: "1px solid rgba(2, 132, 199, 0.25)",
                                }}
                              >
                                {skill.name}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: "2px 7px",
                                  borderRadius: 4,
                                  background: skill.scope === "global" ? "rgba(37, 99, 235, 0.12)" : "rgba(124, 58, 237, 0.12)",
                                  color: skill.scope === "global" ? "#1d4ed8" : "#6d28d9",
                                  border: `1px solid ${skill.scope === "global" ? "rgba(37, 99, 235, 0.25)" : "rgba(124, 58, 237, 0.25)"}`,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                {skill.scope === "global" ? <Globe size={11} /> : <Folder size={11} />}
                                {skill.scope.toUpperCase()}{skill.workspace ? ` (${skill.workspace})` : ""}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                color: "var(--text-main, #1e293b)",
                                marginTop: 8,
                                lineHeight: 1.6,
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                              }}
                            >
                              {skill.description || "No description provided."}
                            </div>
                            {skill.triggers && skill.triggers.length > 0 && (
                              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                                {skill.triggers.map((trig) => (
                                  <span
                                    key={trig}
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      background: "rgba(0,0,0,0.06)",
                                      color: "var(--text-main, #334155)",
                                      border: "1px solid rgba(0,0,0,0.08)",
                                    }}
                                  >
                                    #{trig}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => loadSkillContent(skill.name)}
                            style={{
                              padding: "7px 14px",
                              borderRadius: 7,
                              border: isExpanded ? "1px solid #16a34a" : "1px solid var(--border-color, #cbd5e1)",
                              background: isExpanded ? "rgba(22, 163, 74, 0.12)" : "var(--bg-secondary, #ffffff)",
                              color: isExpanded ? "#15803d" : "var(--text-main, #0f172a)",
                              fontSize: 12.5,
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              flexShrink: 0,
                              transition: "all 0.15s ease",
                            }}
                          >
                            <Code size={14} /> {isExpanded ? "Hide Recipe" : "View Recipe"}
                          </button>
                        </div>

                        {/* Inline Recipe Preview (Right under this skill card, very light green bg, black text) */}
                        {isExpanded && (
                          <div
                            style={{
                              borderTop: "1px solid #bbf7d0",
                              background: "#f0fdf4", // 非常淺的綠色 (Very light green)
                              padding: "16px 20px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 10,
                              }}
                            >
                              <span style={{ fontWeight: 800, fontSize: 13, color: "#166534" }}>
                                📄 {selectedSkillContent.name} (SKILL.md Recipe Preview)
                              </span>
                              <button
                                onClick={() => setSelectedSkillContent(null)}
                                title="Close Recipe"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#166534",
                                  cursor: "pointer",
                                  padding: 4,
                                  borderRadius: 4,
                                }}
                              >
                                <X size={16} />
                              </button>
                            </div>
                            <pre
                              style={{
                                fontSize: 12.5,
                                color: "#09090b", // 黑色字 (Black text)
                                background: "#ffffff",
                                border: "1px solid #bbf7d0",
                                borderRadius: 8,
                                padding: 14,
                                maxHeight: 280,
                                overflowY: "auto",
                                whiteSpace: "pre-wrap",
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                margin: 0,
                                lineHeight: 1.6,
                                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.03)",
                              }}
                            >
                              {selectedSkillContent.content}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "install" && (
            <form onSubmit={handleInstall} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-main, #0f172a)", marginBottom: 6 }}>
                  Server Identifier / Name:
                </label>
                <input
                  type="text"
                  placeholder="e.g. sqlite-db, github-tools, weather-mcp"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color, #cbd5e1)",
                    background: "var(--bg-card, #f8fafc)",
                    color: "var(--text-main, #0f172a)",
                    fontSize: 13,
                    outline: "none",
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-main, #0f172a)", marginBottom: 6 }}>
                  Transport Type:
                </label>
                <div style={{ display: "flex", gap: 20 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-main, #1e293b)", cursor: "pointer", fontWeight: 600 }}>
                    <input
                      type="radio"
                      name="transportType"
                      checked={installType === "stdio"}
                      onChange={() => setInstallType("stdio")}
                    />
                    Stdio (Local Process / npx / python)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-main, #1e293b)", cursor: "pointer", fontWeight: 600 }}>
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
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-main, #0f172a)", marginBottom: 6 }}>
                      Command / Executable:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. npx, node, python, uvx"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid var(--border-color, #cbd5e1)",
                        background: "var(--bg-card, #f8fafc)",
                        color: "var(--text-main, #0f172a)",
                        fontSize: 13,
                        outline: "none",
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-main, #0f172a)", marginBottom: 6 }}>
                      Command Arguments (one per line):
                    </label>
                    <textarea
                      rows={3}
                      placeholder={`-y\n@modelcontextprotocol/server-sqlite\n--db-path\nstorage/mydata.db`}
                      value={argsText}
                      onChange={(e) => setArgsText(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid var(--border-color, #cbd5e1)",
                        background: "var(--bg-card, #f8fafc)",
                        color: "var(--text-main, #0f172a)",
                        fontSize: 13,
                        fontFamily: "monospace",
                        outline: "none",
                        lineHeight: 1.5,
                      }}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-main, #0f172a)", marginBottom: 6 }}>
                    Server URL (HTTP/SSE):
                  </label>
                  <input
                    type="url"
                    placeholder="https://my-mcp-server.com/sse"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color, #cbd5e1)",
                      background: "var(--bg-card, #f8fafc)",
                      color: "var(--text-main, #0f172a)",
                      fontSize: 13,
                      outline: "none",
                    }}
                    required
                  />
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-main, #0f172a)", marginBottom: 6 }}>
                  Description (optional):
                </label>
                <input
                  type="text"
                  placeholder="Optional brief description of what this server provides"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color, #cbd5e1)",
                    background: "var(--bg-card, #f8fafc)",
                    color: "var(--text-main, #0f172a)",
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
                    padding: "9px 18px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color, #cbd5e1)",
                    background: "var(--bg-card, #f8fafc)",
                    color: "var(--text-main, #0f172a)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "9px 22px",
                    borderRadius: 8,
                    border: "none",
                    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 2px 4px rgba(37, 99, 235, 0.25)",
                  }}
                >
                  {isSubmitting ? <RefreshCw size={15} className="spin" /> : <Plus size={15} />}
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
