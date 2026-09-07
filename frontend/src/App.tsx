import { useState, useEffect, useRef } from "react";
import {
  Send,
  Cpu,
  Globe,
  Activity,
  ChevronDown,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Search,
  Eye,
  EyeOff,
  Server,
  Info,
  PlusCircle,
  History,
  MessageSquare,
  Loader2,
  Trash2,
  Download,
  Paperclip,
  Edit2,
  Check,
  X,
  GitFork,
  Folder,
  FolderPlus,
  Brain,
  Shield,
  Users,
  LogOut,
  KeyRound,
  Type,
  GripVertical,
  GitBranch,
  Palette,
  Sliders,
} from "lucide-react";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import { generateStandaloneExportHtml, downloadHtmlFile } from "./utils/htmlExport";
import { AlertModal, type ModalAlertProps } from "./components/AlertModal";
import { UploadDocModal } from "./components/UploadDocModal";
import { SubConversationModal } from "./components/SubConversationModal";
import { ThoughtBlock } from "./components/ThoughtBlock";
import { useAuth } from "./contexts/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { TwoFactorSetupModal } from "./components/TwoFactorSetupModal";
import { UserManagementModal } from "./components/UserManagementModal";
import { ChangePasswordModal } from "./components/ChangePasswordModal";

interface ToolCallLog {
  id: string;
  toolName: string;
  serverName?: string;
  args: any;
  result?: string;
  timestamp: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallLog[];
  isStreaming?: boolean;
  iterations?: number;
  duration?: number;
  tokensPerSec?: number;
  timestamp?: number;
  turnIndex?: number;
}

interface ConfigState {
  llm: {
    baseUrl: string;
    apiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  prompts: {
    systemPrompt: string;
    skillsPrompt: string;
  };
  mcpServers: Record<string, any>;
  maxLoopIterations: number;
  tools?: any[];
  discoveredTools?: {
    serverName: string;
    name: string;
    description?: string;
    inputSchema: any;
  }[];
}

interface WorkspaceInfo {
  name: string;
  sessionCount: number;
}

export function App() {
  const { currentUser, isLoading: isAuthLoading, logout } = useAuth();
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showUserMgmtModal, setShowUserMgmtModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [fontPreference, setFontPreference] = useState<"segoe-ui" | "roboto">(() => {
    return (localStorage.getItem("font_preference") as "segoe-ui" | "roboto") || "roboto";
  });
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Sync font preference to HTML root element
  useEffect(() => {
    document.documentElement.setAttribute("data-font", fontPreference);
    localStorage.setItem("font_preference", fontPreference);
  }, [fontPreference]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I am your Mini Chat Bot. I can run multi-step reasoning loops and fetch real-time data from the web using MCP tools. What would you like to research or build today?",
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [selectedToolDetail, setSelectedToolDetail] = useState<any | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<string>(() => {
    return localStorage.getItem("active_workspace") || "default";
  });
  const [isCreatingWs, setIsCreatingWs] = useState<boolean>(false);
  const [newWsName, setNewWsName] = useState<string>("");
  const [isRenamingWs, setIsRenamingWs] = useState<boolean>(false);
  const [renameWsInput, setRenameWsInput] = useState<string>("");
  const [savedSessions, setSavedSessions] = useState<any[]>([]);
  const [activeSessionFile, setActiveSessionFile] = useState<string | null>(null);
  const [showModelPanel, setShowModelPanel] = useState<boolean>(false);
  const [showPastSessions, setShowPastSessions] = useState<boolean>(true);
  const [mcpViewMode, setMcpViewMode] = useState<"full" | "minimize" | "hide">("full");
  const [thinkingViewMode, setThinkingViewMode] = useState<"full" | "minimize" | "hide">("full");
  const [mcpJsonText, setMcpJsonText] = useState<string>("");
  const [mcpJsonError, setMcpJsonError] = useState<string | null>(null);
  const [showDocModal, setShowDocModal] = useState<boolean>(false);
  const [activeDocHashes, setActiveDocHashes] = useState<string[]>([]);
  const [alertPrompt, setAlertPrompt] = useState<Omit<ModalAlertProps, "onClose"> | null>(null);
  const [editingSessionFile, setEditingSessionFile] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const [subConvModalFile, setSubConvModalFile] = useState<string | null>(null);
  const [draggedSessionKey, setDraggedSessionKey] = useState<string | null>(null);
  const [dragOverSessionKey, setDragOverSessionKey] = useState<string | null>(null);
  const [deletingSessionFile, setDeletingSessionFile] = useState<string | null>(null);
  const [isDeletingWs, setIsDeletingWs] = useState<boolean>(false);
  const [showMermaidMenu, setShowMermaidMenu] = useState<boolean>(false);
  const mermaidMenuRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // 🎨 是否顯示 Mermaid 圖表頂部操作列按鈕群組 (預設 false 隱藏，遵循 SLS hide-mermaid-tools 設計)
  const [showMermaidTools, setShowMermaidTools] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("minibot_show_mermaid_tools");
      return saved === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.classList.toggle("hide-mermaid-tools", !showMermaidTools);
    }
  }, [showMermaidTools]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mermaidMenuRef.current && !mermaidMenuRef.current.contains(e.target as Node)) {
        setShowMermaidMenu(false);
      }
    };
    if (showMermaidMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMermaidMenu]);

  const handleInsertMermaid = (snippet: string, isSnippetOnly?: boolean) => {
    if (isSnippetOnly) {
      setInputPrompt((prev) => (prev ? `${prev}\n\n${snippet}` : snippet));
    } else {
      if (inputPrompt.trim()) {
        setInputPrompt((prev) => `${prev}\n\n${snippet}`);
      } else {
        setInputPrompt(snippet);
      }
    }
    setShowMermaidMenu(false);
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 50);
  };

  const handleReorderSessions = async (newOrderedSessions: any[]) => {
    setSavedSessions(newOrderedSessions);
    try {
      const orderedFilenames = newOrderedSessions.map((s) => s.filename);
      await fetch("/api/logs/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderedFilenames,
          workspace: currentWorkspace,
        }),
      });
    } catch (err) {
      console.error("Failed to save reordered sessions:", err);
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch("/api/workspaces", { signal: AbortSignal.timeout(6000) });
      const data = await res.json();
      if (data.workspaces) {
        setWorkspaces(data.workspaces);
      }
    } catch (err) {
      console.error("Failed to fetch workspaces:", err);
    }
  };

  const handleCreateWorkspace = async () => {
    const clean = newWsName.trim();
    if (!clean) return;
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clean }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewWsName("");
        setIsCreatingWs(false);
        await fetchWorkspaces();
        switchWorkspace(data.name);
        showAlert(`Workspace "${data.name}" created successfully!`, "success");
      } else {
        showAlert(`Failed to create workspace: ${data.error || "Unknown error"}`, "error");
      }
    } catch (err: any) {
      showAlert(`Error creating workspace: ${err.message || err}`, "error");
    }
  };

  const handleRenameWorkspace = async () => {
    const clean = renameWsInput.trim();
    if (!clean || clean === currentWorkspace) {
      setIsRenamingWs(false);
      return;
    }
    try {
      const res = await fetch(`/api/workspaces/${encodeURIComponent(currentWorkspace)}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName: clean }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsRenamingWs(false);
        await fetchWorkspaces();
        switchWorkspace(data.name);
        showAlert(`Workspace renamed to "${data.name}"!`, "success");
      } else {
        showAlert(`Failed to rename workspace: ${data.error || "Unknown error"}`, "error");
      }
    } catch (err: any) {
      showAlert(`Error renaming workspace: ${err.message || err}`, "error");
    }
  };

  const switchWorkspace = (wsName: string) => {
    setCurrentWorkspace(wsName);
    localStorage.setItem("active_workspace", wsName);
    startNewChat();
    fetchLogs(wsName);
  };

  const handleDeleteWorkspace = async (e: React.MouseEvent, wsName: string) => {
    e.stopPropagation();
    if (wsName === "default") {
      showAlert("The default workspace cannot be deleted.", "warning");
      return;
    }
    showConfirm(
      `Are you sure you want to delete workspace "${wsName}" and all its saved sessions?`,
      async () => {
        setIsDeletingWs(true);
        try {
          const res = await fetch(`/api/workspaces/${encodeURIComponent(wsName)}`, {
            method: "DELETE",
          });
          const data = await res.json();
          if (res.ok && data.success) {
            await fetchWorkspaces();
            if (currentWorkspace === wsName) {
              switchWorkspace("default");
            }
          } else {
            showAlert(`Failed to delete workspace: ${data.error}`, "error");
          }
        } catch (err: any) {
          showAlert(`Error deleting workspace: ${err.message || err}`, "error");
        } finally {
          setIsDeletingWs(false);
        }
      },
      "Delete Workspace"
    );
  };

  const handleRenameSession = async (filename: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch(`/api/logs/${encodeURIComponent(filename)}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTitle: newTitle.trim(), workspace: currentWorkspace }),
      });
      if (res.ok) {
        setSavedSessions((prev) =>
          prev.map((s) => (s.filename === filename ? { ...s, customTitle: newTitle.trim() } : s))
        );
        setEditingSessionFile(null);
        await fetchLogs(currentWorkspace);
      } else {
        const data = await res.json();
        showAlert(`Rename failed: ${data.error || "Unknown error"}`, "error");
      }
    } catch (err: any) {
      showAlert(`Rename failed: ${err.message || err}`, "error");
    }
  };

  const addDocHash = (hash: string) => {
    setActiveDocHashes((prev) => (prev.includes(hash) ? prev : [...prev, hash]));
  };

  const removeDocHash = (hash: string) => {
    setActiveDocHashes((prev) => prev.filter((h) => h !== hash));
  };

  const showAlert = (message: string, type: "success" | "error" | "warning" | "info" = "info", title?: string) => {
    setAlertPrompt({
      message,
      type,
      title,
      isConfirm: false,
    });
  };

  const showConfirm = (
    message: string,
    onConfirm: () => void,
    title?: string,
    confirmLabel?: string
  ) => {
    setAlertPrompt({
      message,
      type: "warning",
      title: title || "Confirmation",
      isConfirm: true,
      confirmLabel: confirmLabel || "Confirm",
      onConfirm,
    });
  };

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch initial configuration, workspaces, and active MCP tools
  useEffect(() => {
    fetchConfig();
    fetchWorkspaces();
    fetchLogs(currentWorkspace);
  }, []);

  const fetchLogs = async (wsName?: string) => {
    const ws = wsName || currentWorkspace;
    try {
      const res = await fetch(`/api/logs?workspace=${encodeURIComponent(ws)}`, { signal: AbortSignal.timeout(6000) });
      const data = await res.json();
      if (data.logs) {
        setSavedSessions(data.logs);
      }
    } catch (err) {
      console.error("Failed to load logs:", err);
    }
  };

  const startNewChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Hello! I am your Mini Chat Bot. I can run multi-step reasoning loops and fetch real-time data from the web using MCP tools. What would you like to research or build today?",
      },
    ]);
    setActiveSessionFile(null);
    setInputPrompt("");
    setCurrentStep(null);
    // Reset attachments strictly for new session
    setActiveDocHashes([]);
  };

  const loadSession = async (filename: string, wsName?: string) => {
    const ws = wsName || currentWorkspace;
    try {
      setLoading(true);
      const res = await fetch(`/api/logs/${encodeURIComponent(filename)}?workspace=${encodeURIComponent(ws)}`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
        setActiveSessionFile(filename);
        // Strictly restore only the attachments associated with this specific loaded session
        setActiveDocHashes(data.attachedDocHashes || []);
      }
    } catch (err: any) {
      showAlert(`Failed to load session:\n${err.message || err}`, "error", "Load Session Failed");
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation(); // prevent triggering loadSession
    showConfirm(
      `Are you sure you want to permanently delete this conversation history?\nWorkspace: ${currentWorkspace}\nFilename: ${filename}\n\nThis action will remove it permanently from disk and cannot be undone!`,
      async () => {
        // Set deletion waiting state so the session card displays a spinner icon
        setDeletingSessionFile(filename);

        // If the deleted session is currently active on screen, clear it immediately
        if (activeSessionFile === filename) {
          startNewChat();
        }

        try {
          const res = await fetch(
            `/api/logs/${encodeURIComponent(filename)}?workspace=${encodeURIComponent(currentWorkspace)}`,
            { 
              method: "DELETE",
              signal: AbortSignal.timeout(6000), // 🛡️ Prevent any hanging socket connections
            }
          );

          if (res.ok) {
            // Optimistically remove session from sidebar with 0 latency
            setSavedSessions((prev) => prev.filter((s) => s.filename !== filename));

            // Re-sync logs and workspaces in parallel in the background
            await Promise.all([
              fetchLogs(currentWorkspace),
              fetchWorkspaces(),
            ]);
          } else {
            const data = await res.json();
            // Revert list on failure
            await fetchLogs(currentWorkspace);
            showAlert(`Delete failed: ${data.error || "Unknown error"}`, "error", "Delete Failed");
          }
        } catch (err: any) {
          await fetchLogs(currentWorkspace);
          showAlert(`Delete request error: ${err.message}`, "error", "Request Error");
        } finally {
          setDeletingSessionFile(null);
        }
      },
      "Permanent Delete Confirmation",
      "Confirm Delete"
    );
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentStep]);

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      setConfig(data);
      if (data?.mcpServers) {
        setMcpJsonText(JSON.stringify(data.mcpServers, null, 2));
      }

      // If no valid LLM API key is configured yet, directly pop up the LLM setup screen
      const apiKey = data?.llm?.apiKey;
      const isConfigured = apiKey && apiKey.trim().length > 0 && !apiKey.startsWith("${");
      if (!isConfigured) {
        setShowConfig(true);
      }
    } catch (err) {
      console.error("Failed to load config:", err);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    let updatedMcpServers = config.mcpServers;
    if (mcpJsonText) {
      try {
        updatedMcpServers = JSON.parse(mcpJsonText);
        setMcpJsonError(null);
      } catch (jsonErr: any) {
        setMcpJsonError(jsonErr.message);
        showAlert(`Invalid MCP JSON syntax, please correct it before saving:\n${jsonErr.message}`, "error", "JSON Syntax Error");
        return;
      }
    }

    const payload = {
      ...config,
      mcpServers: updatedMcpServers,
    };

    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setConfig(payload);
        showAlert("Configuration and MCP servers saved and hot-reloaded successfully!", "success", "Configuration Saved");
        setShowConfig(false);
      }
    } catch (err: any) {
      showAlert(`Failed to save settings: ${err.message || "Network error"}`, "error", "Save Failed");
    }
  };

  const toggleTool = (id: string) => {
    setExpandedTools((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSend = async () => {
    if (!inputPrompt.trim() || loading) return;

    const userMessageId = "user-" + Date.now();
    const assistantMessageId = "asst-" + Date.now();
    const query = inputPrompt.trim();
    const now = Date.now();

    // Calculate next turn index based on existing assistant responses
    const nextTurn = messages.filter((m) => m.role === "assistant" && m.id !== "welcome").length + 1;

    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: "user", content: query, timestamp: now, turnIndex: nextTurn },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        toolCalls: [],
        isStreaming: true,
        timestamp: now,
        turnIndex: nextTurn,
      },
    ]);

    setInputPrompt("");
    setLoading(true);
    setCurrentStep(1);

    // Format previous messages as multi-turn history (excluding welcome prompt)
    const history = messages
      .filter((m) => m.id !== "welcome" && m.content)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    const requestStartTime = Date.now();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          history,
          attachedDocHashes: activeDocHashes,
          sessionFile: activeSessionFile,
          workspace: currentWorkspace,
        }),
      });

      if (!response.body) throw new Error("No response body from server");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      let activeTools: ToolCallLog[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const eventMatch = line.match(/^event:\s*(\w+)/m);
          const dataMatch = line.match(/^data:\s*(.*)/m);

          const event = eventMatch ? eventMatch[1] : "message";
          let data: any = {};
          if (dataMatch) {
            try {
              data = JSON.parse(dataMatch[1]);
            } catch {
              data = { raw: dataMatch[1] };
            }
          }

          if (event === "step_start") {
            setCurrentStep(data.iteration);
          } else if (event === "tool_call") {
            const toolId = `tool-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
            const newTool: ToolCallLog = {
              id: toolId,
              toolName: data.toolName,
              serverName: data.serverName,
              args: data.args,
              timestamp: data.timestamp || Date.now(),
            };
            activeTools.push(newTool);
            setExpandedTools((prev) => ({ ...prev, [toolId]: true }));
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, toolCalls: [...activeTools] }
                  : m
              )
            );
          } else if (event === "tool_result") {
            activeTools = activeTools.map((t) =>
              t.toolName === data.toolName && !t.result
                ? { ...t, result: data.result, serverName: data.serverName || t.serverName }
                : t
            );
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, toolCalls: [...activeTools] }
                  : m
              )
            );
          } else if (event === "complete") {
            const totalDurationSec = Math.max(0.1, (Date.now() - requestStartTime) / 1000);
            const estTokens = Math.round((data.answer?.length || 0) / 3.5);
            const tokensPerSec = Math.round(estTokens / totalDurationSec);

            if (data.sessionFile) {
              setActiveSessionFile(data.sessionFile);
            }

            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? {
                      ...m,
                      content: data.answer,
                      iterations: data.iterations,
                      duration: parseFloat(totalDurationSec.toFixed(1)),
                      tokensPerSec,
                      isStreaming: false,
                    }
                  : m
              )
            );
            fetchLogs(currentWorkspace); // refresh saved logs list
            fetchWorkspaces();
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: `[Loop Error]: ${err.message}`,
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setLoading(false);
      setCurrentStep(null);
    }
  };

  if (isAuthLoading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary, #0f172a)", color: "#fff" }}>
        <Loader2 size={32} className="animate-spin" color="var(--accent, #2563eb)" />
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLoginSuccess={() => {
      fetchWorkspaces();
      fetchLogs(currentWorkspace);
    }} />;
  }

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: "var(--bg-primary)" }}>
      {/* Sidebar Navigation (Widened and optimized padding to show maximum title information) */}
      <div
        style={{
          width: 370,
          minWidth: 350,
          flexShrink: 0,
          background: "var(--bg-secondary)",
          borderRight: "1px solid var(--border-color)",
          display: "flex",
          flexDirection: "column",
          padding: "16px 8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "linear-gradient(135deg, var(--accent), var(--accent-purple))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Cpu size={20} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>Mini Chat Bot</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  color: "var(--accent)",
                }}
              >
                Port 7009
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>MCP Protocol</span>
            </div>
          </div>
        </div>

        {/* Workspace Selector & Folder Management Card */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 8,
            border: "1px solid var(--border-color)",
            padding: "10px 12px",
            marginBottom: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Folder size={14} color="var(--accent)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)" }}>
                Workspace
              </span>
            </div>
            <button
              onClick={() => setIsCreatingWs(!isCreatingWs)}
              title="Create new Workspace folder"
              style={{
                background: isCreatingWs ? "rgba(37, 99, 235, 0.15)" : "transparent",
                border: "1px solid var(--border-color)",
                color: "var(--text-main)",
                borderRadius: 4,
                padding: "2px 6px",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                transition: "all 0.15s ease",
              }}
            >
              <FolderPlus size={12} color="var(--accent)" /> New
            </button>
          </div>

          {/* New Workspace Input Field */}
          {isCreatingWs && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="text"
                placeholder="Folder name (e.g. BigFix-Audit)"
                value={newWsName}
                autoFocus
                onChange={(e) => setNewWsName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateWorkspace();
                  else if (e.key === "Escape") setIsCreatingWs(false);
                }}
                style={{
                  flex: 1,
                  fontSize: 11,
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "1px solid var(--accent)",
                  background: "var(--bg-primary)",
                  color: "var(--text-main)",
                  outline: "none",
                }}
              />
              <button
                onClick={handleCreateWorkspace}
                title="Create"
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  color: "#10b981",
                  borderRadius: 4,
                  padding: "4px 6px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <Check size={12} />
              </button>
              <button
                onClick={() => setIsCreatingWs(false)}
                title="Cancel"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-muted)",
                  borderRadius: 4,
                  padding: "4px 6px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Rename Workspace Input Field */}
          {isRenamingWs && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="text"
                placeholder="New workspace name"
                value={renameWsInput}
                autoFocus
                onChange={(e) => setRenameWsInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameWorkspace();
                  else if (e.key === "Escape") setIsRenamingWs(false);
                }}
                style={{
                  flex: 1,
                  fontSize: 11,
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "1px solid var(--accent)",
                  background: "var(--bg-primary)",
                  color: "var(--text-main)",
                  outline: "none",
                }}
              />
              <button
                onClick={handleRenameWorkspace}
                title="Save"
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  color: "#10b981",
                  borderRadius: 4,
                  padding: "4px 6px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <Check size={12} />
              </button>
              <button
                onClick={() => setIsRenamingWs(false)}
                title="Cancel"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-muted)",
                  borderRadius: 4,
                  padding: "4px 6px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Workspace Dropdown Select */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <select
              value={currentWorkspace}
              onChange={(e) => switchWorkspace(e.target.value)}
              style={{
                flex: 1,
                fontSize: 11,
                fontWeight: 600,
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid var(--border-color)",
                background: "var(--bg-secondary)",
                color: "var(--text-main)",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {workspaces.map((ws) => (
                <option key={ws.name} value={ws.name}>
                  📁 {ws.name} ({ws.sessionCount} sessions)
                </option>
              ))}
            </select>

            {currentWorkspace !== "default" && (
              <>
                {/* Rename Workspace Icon Button */}
                <button
                  onClick={() => {
                    setIsRenamingWs(!isRenamingWs);
                    setRenameWsInput(currentWorkspace);
                    setIsCreatingWs(false);
                  }}
                  title="Rename current workspace"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: "4px",
                    borderRadius: 4,
                    display: "inline-flex",
                    alignItems: "center",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  <Edit2 size={13} />
                </button>

                {/* Delete Workspace Icon Button */}
                <button
                  onClick={(e) => handleDeleteWorkspace(e, currentWorkspace)}
                  disabled={isDeletingWs}
                  title={isDeletingWs ? "Deleting workspace..." : "Delete current workspace folder"}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: isDeletingWs ? "#ef4444" : "var(--text-muted)",
                    cursor: isDeletingWs ? "not-allowed" : "pointer",
                    padding: "4px",
                    borderRadius: 4,
                    display: "inline-flex",
                    alignItems: "center",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isDeletingWs) e.currentTarget.style.color = "#ef4444";
                  }}
                  onMouseLeave={(e) => {
                    if (!isDeletingWs) e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  {isDeletingWs ? (
                    <Loader2 size={13} className="spin" color="#ef4444" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* New Chat Primary Action Button */}
        <button
          onClick={startNewChat}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--accent)",
            color: "#ffffff",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 16,
            transition: "opacity 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <PlusCircle size={16} /> New Chat
        </button>

        {/* Collapsible Past Sessions Section (Matching Active Model Card Style) */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 8,
            border: "1px solid var(--border-color)",
            marginBottom: 12,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: showPastSessions ? 140 : "auto",
            transition: "flex 0.2s ease, min-height 0.2s ease",
          }}
        >
          {/* Collapsible Header bar: Matches Active Model Header Style */}
          <div
            onClick={() => setShowPastSessions(!showPastSessions)}
            style={{
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              background: showPastSessions ? "var(--bg-secondary)" : "transparent",
              userSelect: "none",
              borderBottom: showPastSessions ? "1px solid var(--border-color)" : "none",
            }}
            title="Click to collapse / expand past sessions"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <History size={14} color="var(--accent)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main)" }}>
                Past Sessions
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Refresh icon button on the left of Logs badge */}
              <span
                style={{
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px",
                  borderRadius: 4,
                  color: "var(--text-muted)",
                  transition: "color 0.15s",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  fetchLogs();
                }}
                title="Refresh saved sessions"
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                <RefreshCw size={11} />
              </span>

              <span
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "rgba(37, 99, 235, 0.1)",
                  color: "var(--accent)",
                  fontWeight: 600,
                }}
              >
                {savedSessions.length} Logs
              </span>

              {showPastSessions ? (
                <ChevronDown size={15} color="var(--text-muted)" />
              ) : (
                <ChevronRight size={15} color="var(--text-muted)" />
              )}
            </div>
          </div>

          {/* Collapsible Sessions Body (Tree View Hierarchy) */}
          {showPastSessions && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 5,
                overflowY: "auto",
                flex: 1,
                padding: "8px 5px",
              }}
            >
              {savedSessions.length === 0 ? (
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", padding: "4px 0" }}>
                  No past logs yet.
                </div>
              ) : (() => {
                // Build Tree: Identify Root Sessions vs Sub-Conversations (Forks)
                const sessionMap = new Map<string, any>();
                const childrenMap = new Map<string, any[]>();
                const rootSessions: any[] = [];

                savedSessions.forEach((s) => {
                  sessionMap.set(s.filename, s);
                });

                savedSessions.forEach((s) => {
                  const parent = s.clonedFrom?.parentFilename;
                  if (parent && sessionMap.has(parent)) {
                    if (!childrenMap.has(parent)) {
                      childrenMap.set(parent, []);
                    }
                    childrenMap.get(parent)!.push(s);
                  } else {
                    rootSessions.push(s);
                  }
                });

                // Render session card with multi-level depth support (Level 0: Root, Level 1: Sub, Level 2: Sub-sub/3rd level, etc.)
                const renderSessionCard = (session: any, depth: number = 0) => {
                  const isActive = activeSessionFile === session.filename;
                  const children = childrenMap.get(session.filename) || [];
                  const hasChildren = children.length > 0;
                  const isChild = depth > 0;

                  // Branch colors according to depth level (Max Level 5)
                  const branchColors = [
                    "var(--accent)",             // Root (0)
                    "rgba(168, 85, 247, 0.6)",   // Level 1 (Purple)
                    "rgba(236, 72, 153, 0.6)",   // Level 2 (Pink)
                    "rgba(20, 184, 166, 0.6)",   // Level 3 (Teal)
                    "rgba(245, 158, 11, 0.6)",   // Level 4 (Amber)
                    "rgba(239, 68, 68, 0.6)",    // Level 5 (Red / Max)
                  ];
                  const branchBorderColor = branchColors[Math.min(depth, 5)];

                  const isDraggingThis = draggedSessionKey === session.filename;
                  const isDragOverThis = dragOverSessionKey === session.filename;
                  const isDeletingThis = deletingSessionFile === session.filename;

                  return (
                    <div
                      key={session.filename}
                      draggable={editingSessionFile !== session.filename && !isDeletingThis}
                      onDragStart={(e) => {
                        if (editingSessionFile === session.filename || isDeletingThis) return;
                        setDraggedSessionKey(session.filename);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", session.filename);
                      }}
                      onDragOver={(e) => {
                        if (!draggedSessionKey || draggedSessionKey === session.filename || isDeletingThis) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverSessionKey !== session.filename) {
                          setDragOverSessionKey(session.filename);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverSessionKey === session.filename) {
                          setDragOverSessionKey(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!draggedSessionKey || draggedSessionKey === session.filename || isDeletingThis) {
                          setDraggedSessionKey(null);
                          setDragOverSessionKey(null);
                          return;
                        }

                        const currentList = [...savedSessions];
                        const sourceIdx = currentList.findIndex((s) => s.filename === draggedSessionKey);
                        const targetIdx = currentList.findIndex((s) => s.filename === session.filename);

                        if (sourceIdx !== -1 && targetIdx !== -1) {
                          const [movedItem] = currentList.splice(sourceIdx, 1);
                          currentList.splice(targetIdx, 0, movedItem);
                          handleReorderSessions(currentList);
                        }
                        setDraggedSessionKey(null);
                        setDragOverSessionKey(null);
                      }}
                      onDragEnd={() => {
                        setDraggedSessionKey(null);
                        setDragOverSessionKey(null);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        opacity: isDeletingThis ? 0.45 : isDraggingThis ? 0.4 : 1,
                        pointerEvents: isDeletingThis ? "none" : "auto",
                        transition: "opacity 0.15s ease",
                      }}
                    >
                      <div
                        onClick={() => loadSession(session.filename)}
                        title={`Click to load: ${session.filename}${depth > 0 ? ` (Fork Level ${depth} / 5)` : ""}`}
                        style={{
                          padding: isChild ? "4px 6px" : "6px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          cursor: "pointer",
                          background: isActive
                            ? "rgba(37, 99, 235, 0.14)"
                            : isChild
                            ? "var(--bg-primary)"
                            : "var(--bg-secondary)",
                          border: isDragOverThis
                            ? "2px dashed var(--accent)"
                            : isActive
                            ? "1px solid var(--accent)"
                            : "1px solid var(--border-color)",
                          transition: "all 0.15s ease",
                          position: "relative",
                          boxShadow: isActive ? "0 0 0 1px var(--accent)" : "none",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive && !isDragOverThis) e.currentTarget.style.borderColor = "var(--text-muted)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive && !isDragOverThis) e.currentTarget.style.borderColor = "var(--border-color)";
                        }}
                      >
                        {/* First Line: Title Only (Full Width) */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                          {editingSessionFile === session.filename ? (
                            <div
                              style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editingTitle}
                                autoFocus
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleRenameSession(session.filename, editingTitle);
                                  } else if (e.key === "Escape") {
                                    setEditingSessionFile(null);
                                  }
                                }}
                                style={{
                                  flex: 1,
                                  fontSize: 11,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  border: "1px solid var(--accent)",
                                  background: "var(--bg-card)",
                                  color: "var(--text-main)",
                                  outline: "none",
                                }}
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleRenameSession(session.filename, editingTitle);
                                }}
                                title="Save Title"
                                style={{
                                  background: "rgba(16, 185, 129, 0.15)",
                                  border: "1px solid rgba(16, 185, 129, 0.4)",
                                  color: "#10b981",
                                  borderRadius: 4,
                                  padding: "2px 4px",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                              >
                                <Check size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setEditingSessionFile(null);
                                }}
                                title="Cancel"
                                style={{
                                  background: "transparent",
                                  border: "1px solid var(--border-color)",
                                  color: "var(--text-muted)",
                                  borderRadius: 4,
                                  padding: "2px 4px",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 600, color: "var(--text-main)", flex: 1, minWidth: 0 }}>
                              {/* Drag Handle Grip */}
                              <span
                                style={{
                                  cursor: "grab",
                                  color: "var(--text-muted)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  opacity: 0.6,
                                  flexShrink: 0,
                                }}
                                title="Drag to reorder session"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <GripVertical size={11} />
                              </span>
                              {depth === 0 ? (
                                <MessageSquare size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
                              ) : depth === 1 ? (
                                <GitFork size={13} color="#a855f7" style={{ flexShrink: 0 }} />
                              ) : depth === 2 ? (
                                <GitFork size={13} color="#ec4899" style={{ flexShrink: 0 }} />
                              ) : depth === 3 ? (
                                <GitFork size={13} color="#14b8a6" style={{ flexShrink: 0 }} />
                              ) : depth === 4 ? (
                                <GitFork size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
                              ) : (
                                <GitFork size={13} color="#ef4444" style={{ flexShrink: 0 }} />
                              )}
                              <span
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  fontSize: isChild ? 11.5 : 12.5,
                                  letterSpacing: "0.2px",
                                }}
                              >
                                {session.customTitle || session.preview || "Untitled Conversation"}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Second Line: Metadata (Timestamp on Far Left, Badges & Action Icons on Far Right) */}
                        <div
                          style={{
                            fontSize: 9.5,
                            color: "var(--text-muted)",
                            marginTop: 4,
                            paddingLeft: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 2,
                          }}
                        >
                          {/* Left Side: Timestamp */}
                          <div style={{ display: "flex", alignItems: "center", minWidth: 0, overflow: "hidden" }}>
                            <span
                              style={{
                                fontFamily: "ui-monospace, monospace",
                                fontSize: 9.5,
                                whiteSpace: "nowrap",
                                color: "var(--text-muted)",
                                letterSpacing: "-0.2px",
                              }}
                            >
                              {session.filename.replace(".md", "")}
                            </span>
                          </div>

                          {/* Right Side: Attachment Badge & Action Icons */}
                          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                            {/* Attachment Badge if session has documents */}
                            {session.attachedDocCount && session.attachedDocCount > 0 ? (
                              <span
                                title={`${session.attachedDocCount} attached document(s)`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 2,
                                  padding: "1px 4px",
                                  borderRadius: 4,
                                  fontSize: 9,
                                  fontWeight: 600,
                                  backgroundColor: "rgba(37, 99, 235, 0.12)",
                                  color: "var(--accent)",
                                  border: "1px solid rgba(37, 99, 235, 0.25)",
                                }}
                              >
                                <Paperclip size={9.5} />
                                {session.attachedDocCount}
                              </span>
                            ) : null}

                            {/* Action Icon Buttons Grouped on the Right */}
                            {editingSessionFile !== session.filename && (
                              <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
                                {/* Sub-Conversation Inspector / Fork Icon Button (Dimmed & Disabled when max fork level 5+ reached) */}
                                <button
                                  disabled={depth >= 5}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (depth >= 5) return;
                                    setSubConvModalFile(session.filename);
                                  }}
                                  title={depth >= 5 ? "Max fork depth reached (Level 5) - cannot fork deeper" : "Inspect Sub-Conversations & Fork/Clone"}
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    cursor: depth >= 5 ? "not-allowed" : "pointer",
                                    opacity: depth >= 5 ? 0.3 : 1,
                                    padding: "2px 3px",
                                    borderRadius: 4,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: depth >= 5 ? "var(--text-muted)" : "var(--text-muted)",
                                    transition: "color 0.15s, background-color 0.15s, opacity 0.15s",
                                  }}
                                  onMouseEnter={(e) => {
                                    if (depth < 5) {
                                      e.currentTarget.style.color = "var(--accent)";
                                      e.currentTarget.style.backgroundColor = "rgba(37, 99, 235, 0.1)";
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (depth < 5) {
                                      e.currentTarget.style.color = "var(--text-muted)";
                                      e.currentTarget.style.backgroundColor = "transparent";
                                    }
                                  }}
                                >
                                  <GitFork size={11.5} />
                                </button>

                                {/* Edit / Rename Icon Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingSessionFile(session.filename);
                                    setEditingTitle(session.customTitle || session.preview || "");
                                  }}
                                  title="Rename this session"
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: "2px 3px",
                                    borderRadius: 4,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "var(--text-muted)",
                                    transition: "color 0.15s, background-color 0.15s",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.color = "var(--accent)";
                                    e.currentTarget.style.backgroundColor = "rgba(37, 99, 235, 0.1)";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.color = "var(--text-muted)";
                                    e.currentTarget.style.backgroundColor = "transparent";
                                  }}
                                >
                                  <Edit2 size={11.5} />
                                </button>

                                {/* Delete Icon Button */}
                                <button
                                  onClick={(e) => deleteSession(e, session.filename)}
                                  disabled={isDeletingThis}
                                  title={isDeletingThis ? "Deleting session..." : "Delete this session"}
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    cursor: isDeletingThis ? "not-allowed" : "pointer",
                                    padding: "2px 3px",
                                    borderRadius: 4,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: isDeletingThis ? "#ef4444" : "var(--text-muted)",
                                    transition: "color 0.15s, background-color 0.15s",
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isDeletingThis) {
                                      e.currentTarget.style.color = "#ef4444";
                                      e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isDeletingThis) {
                                      e.currentTarget.style.color = "var(--text-muted)";
                                      e.currentTarget.style.backgroundColor = "transparent";
                                    }
                                  }}
                                >
                                  {isDeletingThis ? (
                                    <Loader2 size={11.5} className="spin" color="#ef4444" />
                                  ) : (
                                    <Trash2 size={11.5} />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tree Branch Line & Sub-Conversations (Recursive for unlimited levels) */}
                      {hasChildren && (
                        <div
                          style={{
                            marginLeft: 6,
                            paddingLeft: 4,
                            borderLeft: `2px solid ${branchBorderColor}`,
                            display: "flex",
                            flexDirection: "column",
                            marginBottom: 3,
                          }}
                        >
                          {children.map((child) => renderSessionCard(child, depth + 1))}
                        </div>
                      )}
                    </div>
                  );
                };

                return rootSessions.map((root) => renderSessionCard(root, 0));
              })()}
            </div>
          )}
        </div>

        {/* Collapsible Active Model & Tools Container at Bottom */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 8,
            border: "1px solid var(--border-color)",
            marginBottom: 0,
            marginTop: "auto",
            overflow: "hidden",
            transition: "flex 0.2s ease",
            display: "flex",
            flexDirection: "column",
            flex: showModelPanel ? 1 : "0 0 auto",
          }}
        >
          {/* Collapsible Header bar: Shows 'Active Model' when collapsed */}
          <div
            onClick={() => setShowModelPanel(!showModelPanel)}
            style={{
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              background: showModelPanel ? "var(--bg-secondary)" : "transparent",
              userSelect: "none",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
              <Sparkles size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-main)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={config?.llm.model}
              >
                Model {showModelPanel ? "" : `(${config?.llm.model || "Loading..."})`}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {!showModelPanel && (
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: "rgba(37, 99, 235, 0.1)",
                    color: "var(--accent)",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {config?.tools?.length || 0} Tools
                </span>
              )}
              {showModelPanel ? <ChevronDown size={15} color="var(--text-muted)" /> : <ChevronRight size={15} color="var(--text-muted)" />}
            </div>
          </div>

          {/* Expanded Content: Model Details + Active MCP Tools */}
          {showModelPanel && (
            <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border-color)", display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>CURRENT LLM MODEL</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <Cpu size={14} /> {config?.llm.model || "Loading..."}
              </div>

              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                <span>ACTIVE MCP SERVERS</span>
                <span style={{ color: "var(--accent-emerald)", fontWeight: 600 }}>{config?.tools?.length || 0} Tools</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", flex: 1 }}>
                {config?.mcpServers &&
                  Object.entries(config.mcpServers).map(([serverKey, serverDef]: [string, any]) => {
                    const serverTools = (config.discoveredTools || []).filter(
                      (t) => t.serverName === serverKey
                    );

                    return (
                      <div
                        key={serverKey}
                        style={{
                          background: "var(--bg-secondary)",
                          border: "1px solid var(--border-color)",
                          borderRadius: 6,
                          padding: "6px 8px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 4,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <Server size={12} color="var(--accent)" />
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-main)" }}>
                              {serverKey}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: 9,
                              padding: "1px 4px",
                              borderRadius: 3,
                              background: serverDef.enabled ? "rgba(22, 163, 74, 0.15)" : "var(--bg-card)",
                              color: serverDef.enabled ? "var(--accent-emerald)" : "var(--text-muted)",
                              fontWeight: 600,
                            }}
                          >
                            {serverDef.enabled ? "Active" : "Off"}
                          </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {serverTools.length > 0 ? (
                            serverTools.map((t) => (
                              <div
                                key={t.name}
                                onClick={() =>
                                  setSelectedToolDetail({
                                    ...t,
                                    serverDef,
                                  })
                                }
                                title="Click to view tool details"
                                style={{
                                  fontSize: 10,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 4,
                                  color: "var(--text-main)",
                                  background: "var(--bg-card)",
                                  padding: "2px 5px",
                                  borderRadius: 4,
                                  cursor: "pointer",
                                }}
                              >
                                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <Globe size={10} color="var(--accent-emerald)" />
                                  <code>{t.name}</code>
                                </span>
                                <Info size={11} color="var(--text-muted)" />
                              </div>
                            ))
                          ) : (
                            <div style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>
                              No tools loaded
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat & Loop Trace Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", minWidth: 0, overflow: "hidden", position: "relative" }}>
        {/* Header */}
        <header
          style={{
            height: 60,
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            background: "var(--bg-secondary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--accent-emerald)",
                boxShadow: "0 0 8px rgba(22, 163, 74, 0.6)",
              }}
              title="Agent Engine Online"
            />
            <Activity size={16} color="var(--accent-emerald)" />
            {currentStep && (
              <span
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  padding: "2px 8px",
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Iterating: Step {currentStep}
              </span>
            )}
          </div>

          {/* MCP & Thinking Response View Mode Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* Thinking Response Segmented Switch */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "var(--bg-card)",
                padding: "3px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                gap: 2,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", padding: "0 6px", display: "flex", alignItems: "center", gap: 4 }}>
                <Brain size={12} color="#a855f7" /> Thinking:
              </span>

              {/* 1. Hide */}
              <button
                type="button"
                onClick={() => setThinkingViewMode("hide")}
                title="Hide model thinking (<think>) completely"
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: thinkingViewMode === "hide" ? 700 : 500,
                  background: thinkingViewMode === "hide" ? "var(--bg-secondary)" : "transparent",
                  color: thinkingViewMode === "hide" ? "var(--text-main)" : "var(--text-muted)",
                  boxShadow: thinkingViewMode === "hide" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <EyeOff size={11} /> Hide
              </button>

              {/* 2. Minimize */}
              <button
                type="button"
                onClick={() => setThinkingViewMode("minimize")}
                title="Show thinking as a compact single-line preview snippet"
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: thinkingViewMode === "minimize" ? 700 : 500,
                  background: thinkingViewMode === "minimize" ? "var(--bg-secondary)" : "transparent",
                  color: thinkingViewMode === "minimize" ? "#a855f7" : "var(--text-muted)",
                  boxShadow: thinkingViewMode === "minimize" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <ChevronDown size={11} /> Minimize
              </button>

              {/* 3. Full */}
              <button
                type="button"
                onClick={() => setThinkingViewMode("full")}
                title="Show full collapsible thinking block"
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: thinkingViewMode === "full" ? 700 : 500,
                  background: thinkingViewMode === "full" ? "var(--bg-secondary)" : "transparent",
                  color: thinkingViewMode === "full" ? "#a855f7" : "var(--text-muted)",
                  boxShadow: thinkingViewMode === "full" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Eye size={11} /> Full
              </button>
            </div>

            {/* MCP Response View Mode Segmented Switch */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "var(--bg-card)",
                padding: "3px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                gap: 2,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", padding: "0 6px" }}>
                MCP Response:
              </span>

              {/* 1. Hide */}
              <button
                type="button"
                onClick={() => setMcpViewMode("hide")}
                title="Hide all MCP tool calls completely"
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: mcpViewMode === "hide" ? 700 : 500,
                  background: mcpViewMode === "hide" ? "var(--bg-secondary)" : "transparent",
                  color: mcpViewMode === "hide" ? "var(--text-main)" : "var(--text-muted)",
                  boxShadow: mcpViewMode === "hide" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <EyeOff size={11} /> Hide
              </button>

              {/* 2. Minimize */}
              <button
                type="button"
                onClick={() => setMcpViewMode("minimize")}
                title="Show only tool summary pill / single line"
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: mcpViewMode === "minimize" ? 700 : 500,
                  background: mcpViewMode === "minimize" ? "var(--bg-secondary)" : "transparent",
                  color: mcpViewMode === "minimize" ? "var(--accent-amber)" : "var(--text-muted)",
                  boxShadow: mcpViewMode === "minimize" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <ChevronDown size={11} /> Minimize
              </button>

              {/* 3. Full */}
              <button
                type="button"
                onClick={() => setMcpViewMode("full")}
                title="Show full collapsible tool call cards with parameters and raw observations"
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: mcpViewMode === "full" ? 700 : 500,
                  background: mcpViewMode === "full" ? "var(--bg-secondary)" : "transparent",
                  color: mcpViewMode === "full" ? "var(--accent)" : "var(--text-muted)",
                  boxShadow: mcpViewMode === "full" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Eye size={11} /> Full
              </button>
            </div>

            {/* Sub-Conversation / Turns Inspector Button */}
            {activeSessionFile && (
              <button
                onClick={() => setSubConvModalFile(activeSessionFile)}
                title="Inspect Sub-Conversations / Fork a turn from current session"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  background: "rgba(37, 99, 235, 0.1)",
                  border: "1px solid var(--accent)",
                  color: "var(--accent)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(37, 99, 235, 0.18)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(37, 99, 235, 0.1)";
                }}
              >
                <GitFork size={13} /> Sub Conversations
              </button>
            )}

            {/* 🎨 Toggle Mermaid Diagram Buttons (SLS Parity: icon-only button, default hidden) */}
            <button
              onClick={() => {
                const nextVal = !showMermaidTools;
                setShowMermaidTools(nextVal);
                try {
                  localStorage.setItem("minibot_show_mermaid_tools", nextVal ? "1" : "0");
                } catch {}
              }}
              title={showMermaidTools ? "Hide Mermaid diagram toolbar buttons" : "Show Mermaid diagram toolbar buttons"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 8,
                background: showMermaidTools ? "rgba(2, 132, 199, 0.15)" : "var(--bg-card)",
                border: showMermaidTools ? "1px solid var(--accent, #0284c7)" : "1px solid var(--border-color)",
                color: showMermaidTools ? "var(--accent, #0284c7)" : "var(--text-muted)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!showMermaidTools) {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.color = "var(--accent)";
                }
              }}
              onMouseLeave={(e) => {
                if (!showMermaidTools) {
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  e.currentTarget.style.color = "var(--text-muted)";
                }
              }}
            >
              <Palette size={15} />
            </button>

            {/* Export Entire Conversation as HTML (Icon-Only, 32x32) */}
            <button
              onClick={() => {
                const combinedMarkdown = messages
                  .map((m) => `### ${m.role === "user" ? "👤 User Query" : "🤖 Assistant Response"}\n\n${m.content}`)
                  .join("\n\n---\n\n");
                const html = generateStandaloneExportHtml(
                  combinedMarkdown,
                  activeSessionFile ? activeSessionFile.replace(".md", "") : "Chat Session Export"
                );
                downloadHtmlFile(
                  html,
                  activeSessionFile ? `${activeSessionFile.replace(".md", "")}.html` : `chat-session-${Date.now()}.html`
                );
              }}
              title="Export complete chat session as standalone offline HTML report"
              style={{
                width: 32,
                height: 32,
                padding: 0,
                borderRadius: 8,
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                color: "var(--text-muted)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.color = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-color)";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              <Download size={15} />
            </button>

            {/* ⚙️ Parameters & AI Configuration Icon Button */}
            <button
              onClick={() => setShowConfig(true)}
              title="Parameters & AI Configuration (Max Loop Iterations, Temperature, Max Tokens, Model, MCP)"
              style={{
                width: 32,
                height: 32,
                padding: 0,
                borderRadius: 8,
                background: showConfig ? "rgba(2, 132, 199, 0.15)" : "var(--bg-card)",
                border: showConfig ? "1px solid var(--accent, #0284c7)" : "1px solid var(--border-color)",
                color: showConfig ? "var(--accent, #0284c7)" : "var(--text-muted)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.color = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                if (!showConfig) {
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  e.currentTarget.style.color = "var(--text-muted)";
                }
              }}
            >
              <Sliders size={15} />
            </button>

            {/* Separator */}
            <div style={{ width: 1, height: 20, background: "var(--border-color)" }} />

            {/* SLS-Style User Dropdown Menu */}
            <div style={{ position: "relative" }} ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 10px 4px 6px",
                  borderRadius: 20,
                  background: isUserMenuOpen ? "var(--bg-card)" : "var(--bg-card)",
                  border: isUserMenuOpen ? "1px solid var(--accent)" : "1px solid var(--border-color)",
                  color: "var(--text-main)",
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  outline: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isUserMenuOpen) e.currentTarget.style.borderColor = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  if (!isUserMenuOpen) e.currentTarget.style.borderColor = "var(--border-color)";
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--accent, #2563eb), #7c3aed)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#fff",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                  }}
                >
                  {currentUser?.username.slice(0, 1).toUpperCase()}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.1 }}>
                  <span style={{ fontWeight: 600, fontSize: 12 }}>
                    {currentUser?.displayName || currentUser?.username}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
                    #{currentUser?.userNumber}
                  </span>
                </div>
                <ChevronDown
                  size={13}
                  color="var(--text-muted)"
                  style={{
                    transform: isUserMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>

              {/* Dropdown Popover Card */}
              {isUserMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    width: 240,
                    background: "var(--bg-secondary, #1e293b)",
                    border: "1px solid var(--border-color, #334155)",
                    borderRadius: 12,
                    boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
                    zIndex: 1000,
                    padding: "8px 0",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* User Profile Header */}
                  <div style={{ padding: "8px 14px 10px", borderBottom: "1px solid var(--border-color)" }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-main)" }}>
                      {currentUser?.displayName || currentUser?.username}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 3 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>@{currentUser?.username}</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: currentUser?.role === "admin" ? "rgba(124, 58, 237, 0.15)" : "rgba(37, 99, 235, 0.15)",
                          color: currentUser?.role === "admin" ? "#a78bfa" : "var(--accent)",
                          textTransform: "uppercase",
                        }}
                      >
                        {currentUser?.role}
                      </span>
                    </div>
                  </div>

                  {/* Admin Functions Section (if Admin) */}
                  {currentUser?.role === "admin" && (
                    <>
                      <div style={{ padding: "6px 14px 2px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.5px" }}>
                        ADMIN FUNCTIONS
                      </div>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setShowUserMgmtModal(true);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "7px 14px",
                          background: "transparent",
                          border: "none",
                          color: "var(--text-main)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <Users size={13} color="#a78bfa" />
                        <span>User Management</span>
                      </button>
                      <div style={{ height: 1, background: "var(--border-color)", margin: "4px 0" }} />
                    </>
                  )}

                  {/* User Functions Section */}
                  <div style={{ padding: "6px 14px 2px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.5px" }}>
                    USER FUNCTIONS
                  </div>

                  {/* 2FA Setup */}
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setShow2FAModal(true);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "7px 14px",
                      background: "transparent",
                      border: "none",
                      color: "var(--text-main)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Shield size={13} color={currentUser?.totpEnabled ? "#10b981" : "#f59e0b"} />
                      <span>2FA Authentication</span>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 5px",
                        borderRadius: 4,
                        background: currentUser?.totpEnabled ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                        color: currentUser?.totpEnabled ? "#10b981" : "#f59e0b",
                      }}
                    >
                      {currentUser?.totpEnabled ? "ON" : "OFF"}
                    </span>
                  </button>

                  {/* Change Password */}
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setShowChangePasswordModal(true);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 14px",
                      background: "transparent",
                      border: "none",
                      color: "var(--text-main)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <KeyRound size={13} color="var(--accent)" />
                    <span>Change Password</span>
                  </button>

                  {/* Font Selection (Segoe UI / Roboto) */}
                  <button
                    onClick={() => {
                      setFontPreference((prev) => (prev === "segoe-ui" ? "roboto" : "segoe-ui"));
                    }}
                    title="Toggle between Segoe UI (System) and Roboto (Google Font)"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "7px 14px",
                      background: "transparent",
                      border: "none",
                      color: "var(--text-main)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Type size={13} color="#0284c7" />
                      <span>Font</span>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: fontPreference === "segoe-ui" ? "rgba(2, 132, 199, 0.12)" : "rgba(124, 58, 237, 0.12)",
                        color: fontPreference === "segoe-ui" ? "#0284c7" : "#7c3aed",
                      }}
                    >
                      {fontPreference === "segoe-ui" ? "Segoe UI" : "Roboto"}
                    </span>
                  </button>

                  <div style={{ height: 1, background: "var(--border-color)", margin: "4px 0" }} />

                  {/* Logout */}
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 14px",
                      background: "transparent",
                      border: "none",
                      color: "#ef4444",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <LogOut size={13} color="#ef4444" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Message Thread */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "24px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* Constrained 80% Content Column: Takes 80% of (Screen Width - Left Menu Bar) */}
          <div
            style={{
              width: "100%",
              maxWidth: "calc((100vw - 370px) * 0.8)",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            {messages.map((m, mIdx) => {
              const isUser = m.role === "user";
              // Calculate a display turn index if not present
              const turnNumber = m.turnIndex || Math.floor(mIdx / 2) + 1;
              const timeString = m.timestamp
                ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                : "";

              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isUser ? "flex-end" : "flex-start",
                    width: "100%",
                    minWidth: 0,
                  }}
                >
                  {/* Header Tag: Turn Number & Time */}
                  {m.id !== "welcome" && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginBottom: 5,
                        padding: "0 4px",
                      }}
                    >
                      <span
                        style={{
                          padding: "1px 7px",
                          borderRadius: 10,
                          background: isUser ? "rgba(31, 111, 235, 0.15)" : "rgba(16, 185, 129, 0.15)",
                          color: isUser ? "var(--accent)" : "#10b981",
                          fontWeight: 700,
                          fontSize: 10,
                        }}
                      >
                        #{turnNumber} {isUser ? "User" : "Response"}
                      </span>
                      {timeString && <span>• {timeString}</span>}
                    </div>
                  )}

                  {isUser ? (
                    <div
                      style={{
                        background: "linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%)",
                        color: "#0369a1",
                        border: "1px solid #bae6fd",
                        boxShadow: "0 2px 6px rgba(186, 230, 253, 0.35)",
                        padding: "12px 18px",
                        borderRadius: "16px 16px 2px 16px",
                        maxWidth: "85%",
                        fontSize: 14,
                        lineHeight: 1.5,
                        wordBreak: "break-word",
                        overflowWrap: "anywhere",
                      }}
                    >
                      <MarkdownRenderer content={m.content} />
                    </div>
                  ) : (
                    <div style={{ maxWidth: "100%", width: "100%", minWidth: 0 }}>
                      {/* Tool Invocations Section governed by mcpViewMode */}
                  {m.toolCalls && m.toolCalls.length > 0 && mcpViewMode !== "hide" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                      {/* If Minimize mode: show a compact summary bar */}
                      {mcpViewMode === "minimize" ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 12px",
                            borderRadius: 20,
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-color)",
                            fontSize: 11,
                            color: "var(--text-muted)",
                            width: "fit-content",
                          }}
                        >
                          <Activity size={12} color="var(--accent-amber)" />
                          <span style={{ fontWeight: 600, color: "var(--text-main)" }}>
                            {m.toolCalls.length} MCP Tool Call(s) Executed
                          </span>
                          <span style={{ color: "var(--text-muted)" }}>•</span>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {m.toolCalls.map((t, idx) => (
                              <span
                                key={idx}
                                style={{
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "var(--bg-secondary)",
                                  border: "1px solid var(--border-color)",
                                  fontSize: 10,
                                  fontFamily: "monospace",
                                  color: "var(--accent-amber)",
                                }}
                              >
                                {t.toolName}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        /* If Full mode: render interactive collapsible tool cards */
                        m.toolCalls.map((t) => {
                          const isExpanded = !!expandedTools[t.id];
                          return (
                            <div
                              key={t.id}
                              style={{
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-color)",
                                borderRadius: 8,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                onClick={() => toggleTool(t.id)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "10px 14px",
                                  cursor: "pointer",
                                  background: "var(--bg-secondary)",
                                  borderBottom: isExpanded ? "1px solid var(--border-color)" : "none",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <Search size={15} color="var(--accent-amber)" />
                                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-amber)" }}>
                                    Tool Call: {t.toolName}
                                  </span>
                                  {t.serverName && (
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 600,
                                        padding: "1px 6px",
                                        borderRadius: 4,
                                        background: "rgba(2, 132, 199, 0.12)",
                                        color: "var(--accent)",
                                        border: "1px solid rgba(2, 132, 199, 0.25)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                      }}
                                    >
                                      <Server size={10} /> {t.serverName}
                                    </span>
                                  )}
                                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                    args: {JSON.stringify(t.args)}
                                  </span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  {t.result ? (
                                    <span style={{ fontSize: 11, color: "var(--accent-emerald)", display: "flex", alignItems: "center", gap: 4 }}>
                                      <CheckCircle2 size={13} /> Completed
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 11, color: "var(--accent)", display: "flex", alignItems: "center", gap: 4 }}>
                                      <RefreshCw size={12} className="spin" /> Executing...
                                    </span>
                                  )}
                                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </div>
                              </div>

                              {isExpanded && (
                                <div style={{ padding: "12px 14px", background: "var(--bg-card)" }}>
                                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>PARAMETERS:</div>
                                  <pre style={{ fontSize: 12, color: "var(--accent)", marginBottom: 10, overflowX: "auto", background: "var(--bg-primary)", padding: 8, borderRadius: 6, border: "1px solid var(--border-color)" }}>
                                    {JSON.stringify(t.args, null, 2)}
                                  </pre>
                                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>OBSERVATION (MCP RESPONSE):</div>
                                  <pre
                                    style={{
                                      fontSize: 12,
                                      color: "var(--text-main)",
                                      maxHeight: 200,
                                      overflowY: "auto",
                                      whiteSpace: "pre-wrap",
                                      wordBreak: "break-word",
                                      background: "var(--bg-primary)",
                                      padding: 8,
                                      borderRadius: 6,
                                      border: "1px solid var(--border-color)",
                                    }}
                                  >
                                    {t.result || "Awaiting MCP response..."}
                                  </pre>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Main Assistant Content */}
                  <div
                    style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "16px 16px 16px 2px",
                      padding: "16px 20px",
                      color: "var(--text-main)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      minWidth: 0,
                      maxWidth: "100%",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                      overflow: "hidden",
                    }}
                  >
                    {m.content ? (() => {
                      // Extract thinking process if wrapped in <think>...</think>
                      let thoughtText = "";
                      let mainText = m.content;

                      const thinkMatch = m.content.match(/<think>([\s\S]*?)<\/think>/i);
                      if (thinkMatch) {
                        thoughtText = thinkMatch[1].trim();
                        mainText = m.content.replace(/<think>[\s\S]*?<\/think>/i, "").trim();
                      } else if (m.content.startsWith("<think>")) {
                        // In-flight streaming thinking tag before closing
                        thoughtText = m.content.replace("<think>", "").trim();
                        mainText = "";
                      }

                      return (
                        <>
                          {/* Dedicated Thinking Block */}
                          {thoughtText && (
                            <ThoughtBlock
                              thoughtText={thoughtText}
                              viewMode={thinkingViewMode}
                              defaultExpanded={thinkingViewMode === "full"}
                            />
                          )}

                          {/* Synthesized Response Content */}
                          {mainText ? (
                            <MarkdownRenderer content={mainText} />
                          ) : thoughtText && m.isStreaming ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 13, fontStyle: "italic", padding: "4px 0" }}>
                              <Loader2 size={13} className="spin" color="#a855f7" /> Thinking in progress...
                            </div>
                          ) : null}

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              marginTop: 12,
                              paddingTop: 8,
                              borderTop: "1px solid var(--border-color)",
                              fontSize: 11,
                              color: "var(--text-muted)",
                              flexWrap: "wrap",
                            }}
                          >
                          <span>Tokens: ~{Math.round(m.content.length / 3.5)}</span>
                          <span>Length: {m.content.length} chars</span>
                          {m.duration !== undefined && (
                            <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                              ⏱️ Time: {m.duration}s
                            </span>
                          )}
                          {m.tokensPerSec !== undefined && (
                            <span style={{ color: "#8b5cf6", fontWeight: 600 }}>
                              ⚡ Speed: ~{m.tokensPerSec} T/s
                            </span>
                          )}
                          {m.iterations && (
                            <span style={{ color: "var(--accent-emerald)", fontWeight: 600 }}>
                              Resolved in {m.iterations} iteration(s)
                            </span>
                          )}

                          <button
                            onClick={() => {
                              const title = m.content.slice(0, 40).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "-") || "Answer";
                              const html = generateStandaloneExportHtml(m.content, title);
                              downloadHtmlFile(html, `${title}.html`);
                            }}
                            title="Export this specific answer as standalone HTML"
                            style={{
                              marginLeft: "auto",
                              background: "transparent",
                              border: "1px solid var(--border-color)",
                              borderRadius: 4,
                              padding: "2px 8px",
                              fontSize: 10,
                              fontWeight: 600,
                              color: "var(--text-muted)",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "var(--accent)";
                              e.currentTarget.style.color = "var(--accent)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "var(--border-color)";
                              e.currentTarget.style.color = "var(--text-muted)";
                            }}
                          >
                            <Download size={11} /> Export HTML
                          </button>
                        </div>
                      </>
                    );
                  })() : m.isStreaming ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontStyle: "italic", fontSize: 13 }}>
                        <Loader2 size={16} className="spin" color="var(--accent)" />
                        <span>Reasoning through tool outputs...</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          );
        })}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input Bar */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--border-color)",
            background: "var(--bg-secondary)",
            display: "flex",
            justifyContent: "center",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "calc((100vw - 370px) * 0.8)",
              display: "flex",
              gap: 12,
              alignItems: "center",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
          <button
            type="button"
            onClick={() => setShowDocModal(true)}
            title="Attach Multi-Tab Excel, PDF, Word, or Text Files"
            style={{
              padding: "11px 14px",
              borderRadius: 8,
              background: activeDocHashes.length > 0 ? "rgba(16, 185, 129, 0.12)" : "var(--bg-card)",
              border: activeDocHashes.length > 0 ? "1px solid rgba(16, 185, 129, 0.5)" : "1px solid var(--border-color)",
              color: activeDocHashes.length > 0 ? "#10b981" : "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
              transition: "all 0.15s ease",
            }}
          >
            <Paperclip size={16} />
            <span>Attachment</span>
            {activeDocHashes.length > 0 && (
              <span
                style={{
                  background: "#10b981",
                  color: "#ffffff",
                  borderRadius: "10px",
                  padding: "1px 7px",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 18,
                  height: 18,
                  lineHeight: 1,
                }}
              >
                {activeDocHashes.length}
              </span>
            )}
          </button>

          {/* 📊 Mermaid Architecture Diagram Quick Action */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowMermaidMenu((v) => !v)}
              title="Insert or request Mermaid architecture diagram"
              style={{
                padding: "11px 14px",
                borderRadius: 8,
                background: showMermaidMenu ? "rgba(16, 185, 129, 0.15)" : "var(--bg-card)",
                border: showMermaidMenu ? "1px solid #10b981" : "1px solid var(--border-color)",
                color: showMermaidMenu ? "#10b981" : "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 7,
                fontSize: 13,
                fontWeight: 600,
                transition: "all 0.15s ease",
              }}
            >
              <GitBranch size={16} color="#10b981" />
              <span>Mermaid</span>
            </button>

            {showMermaidMenu && (
              <div
                ref={mermaidMenuRef}
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: 0,
                  zIndex: 1100,
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 12,
                  padding: 8,
                  boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
                  minWidth: 280,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    padding: "4px 8px 6px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    borderBottom: "1px solid var(--border-color)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>📊 Mermaid Diagram Generator</span>
                  <span
                    style={{
                      fontSize: 10,
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#10b981",
                      padding: "1px 6px",
                      borderRadius: 4,
                      fontWeight: 700,
                    }}
                  >
                    Quick Apply
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleInsertMermaid(
                      "Please draw the system architecture using Mermaid flowchart syntax (flowchart TD), including detailed node branches, step descriptions, and processing logic."
                    )
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    background: "transparent",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    color: "var(--text-main)",
                    fontSize: 12.5,
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: 16 }}>🔀</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>Architecture Flowchart</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Node branching and logic flows</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleInsertMermaid(
                      "Please draw the interaction flow using Mermaid sequence diagram syntax (sequenceDiagram), showing sequence handshakes and call chains between services."
                    )
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    background: "transparent",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    color: "var(--text-main)",
                    fontSize: 12.5,
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: 16 }}>⏱️</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>Sequence Diagram</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Service handshakes and call chains</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleInsertMermaid(
                      "Please draw the cluster architecture using Mermaid syntax, including subgraph partition boundaries and data flows."
                    )
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    background: "transparent",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    color: "var(--text-main)",
                    fontSize: 12.5,
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: 16 }}>🏛️</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>Cluster Topology</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Subgraph boundaries and data flows</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleInsertMermaid(
                      "Please break down core concepts, module responsibilities, and technical key points using Mermaid mindmap syntax."
                    )
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    background: "transparent",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    color: "var(--text-main)",
                    fontSize: 12.5,
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: 16 }}>🧠</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>Concept Mindmap</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Hierarchical technical structure</div>
                  </div>
                </button>

                <div style={{ borderTop: "1px solid var(--border-color)", margin: "3px 0" }} />

                <button
                  type="button"
                  onClick={() =>
                    handleInsertMermaid(
                      '```mermaid\nflowchart TD\n  Client["Client"] --> GW["API Gateway"]\n  GW --> S1["Service A"]\n  GW --> S2["Service B"]\n  S1 --> DB[("Database")]\n```\n',
                      true
                    )
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    background: "transparent",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    color: "var(--text-main)",
                    fontSize: 12.5,
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: 16 }}>📋</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>Insert Code Snippet</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Directly insert complete Mermaid code</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <input
            ref={chatInputRef}
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask anything or query attached Excel / PDF / Word documents..."
            disabled={loading}
            style={{
              flex: 1,
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              padding: "12px 16px",
              color: "var(--text-main)",
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !inputPrompt.trim()}
            style={{
              padding: "0 22px",
              height: 44,
              borderRadius: 8,
              background: loading ? "#94a3b8" : "#1f6feb",
              color: "#ffffff",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 600,
              boxShadow: loading ? "none" : "0 2px 4px rgba(31, 111, 235, 0.25)",
              transition: "background 0.2s, box-shadow 0.2s",
              flexShrink: 0,
            }}
          >
            <Send size={16} /> Send
          </button>
          </div>
        </div>
      </div>

      {/* Configuration Modal */}
      {showConfig && config && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "min(1160px, 95vw)",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: 14,
              padding: 28,
              maxHeight: "92vh",
              overflowY: "auto",
              boxShadow: "0 15px 35px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 19, fontWeight: 700, color: "var(--text-main)" }}>Configuration & AI Skills</h3>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  Adjust Model parameters, prompt instructions, and hot-reload MCP tools in real-time.
                </div>
              </div>
              <button
                onClick={() => setShowConfig(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 20,
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* 2-Column Split: Left = System Prompts & LLM Settings | Right = MCP Servers JSON */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 24,
                alignItems: "stretch",
              }}
            >
              {/* Left Column: LLM Settings & System Prompts */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                      LLM Base URL
                    </label>
                    <input
                      type="text"
                      value={config.llm.baseUrl}
                      onChange={(e) =>
                        setConfig({ ...config, llm: { ...config.llm, baseUrl: e.target.value } })
                      }
                      style={{
                        width: "100%",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        padding: "8px 12px",
                        borderRadius: 6,
                        color: "var(--text-main)",
                        fontSize: 13,
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                      LLM Model Name
                    </label>
                    <input
                      type="text"
                      value={config.llm.model}
                      onChange={(e) =>
                        setConfig({ ...config, llm: { ...config.llm, model: e.target.value } })
                      }
                      style={{
                        width: "100%",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        padding: "8px 12px",
                        borderRadius: 6,
                        color: "var(--text-main)",
                        fontSize: 13,
                      }}
                    />
                  </div>
                </div>

                {/* API Key Input with Eye Toggle */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                    API Key (MiniMax / LLM Secret)
                  </label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={config.llm.apiKey || ""}
                      onChange={(e) =>
                        setConfig({ ...config, llm: { ...config.llm, apiKey: e.target.value } })
                      }
                      placeholder="sk-cp-..."
                      style={{
                        width: "100%",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        padding: "8px 40px 8px 12px",
                        borderRadius: 6,
                        color: "var(--text-main)",
                        fontSize: 13,
                        fontFamily: showApiKey ? "ui-monospace, monospace" : "inherit",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((prev) => !prev)}
                      title={showApiKey ? "Hide API Key" : "Show API Key"}
                      style={{
                        position: "absolute",
                        right: 8,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 4,
                        borderRadius: 4,
                      }}
                    >
                      {showApiKey ? <EyeOff size={16} color="var(--accent)" /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Loop Execution & Model Parameters (Guardrail & Limits) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, background: "var(--bg-primary)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-color)" }}>
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent)", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <Activity size={12} /> Max Loop Steps
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={config.maxLoopIterations ?? 10}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          maxLoopIterations: Math.max(1, parseInt(e.target.value, 10) || 10),
                        })
                      }
                      style={{
                        width: "100%",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        padding: "6px 8px",
                        borderRadius: 6,
                        color: "var(--text-main)",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    />
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
                      Guardrail limit (default: 10). Increase to 20-30 for multi-step MCP tasks.
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <Sparkles size={12} color="#a855f7" /> Temperature
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min={0}
                      max={2}
                      value={config.llm.temperature ?? 0.7}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          llm: { ...config.llm, temperature: parseFloat(e.target.value) || 0 },
                        })
                      }
                      style={{
                        width: "100%",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        padding: "6px 8px",
                        borderRadius: 6,
                        color: "var(--text-main)",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    />
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
                      Randomness (0 = precise, 1 = creative).
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <Cpu size={12} color="#10b981" /> Max Tokens
                    </label>
                    <input
                      type="number"
                      step="512"
                      min={512}
                      max={65536}
                      value={config.llm.maxTokens ?? 4096}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          llm: { ...config.llm, maxTokens: parseInt(e.target.value, 10) || 4096 },
                        })
                      }
                      style={{
                        width: "100%",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        padding: "6px 8px",
                        borderRadius: 6,
                        color: "var(--text-main)",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    />
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
                      Max completion tokens per call.
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                    System Prompt
                  </label>
                  <textarea
                    rows={5}
                    value={config.prompts.systemPrompt}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        prompts: { ...config.prompts, systemPrompt: e.target.value },
                      })
                    }
                    placeholder="Enter the system behavior instructions..."
                    style={{
                      width: "100%",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                      padding: 10,
                      borderRadius: 6,
                      color: "var(--text-main)",
                      fontSize: 13,
                      lineHeight: 1.5,
                      resize: "vertical",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                    AI Skills & Protocols Prompt
                  </label>
                  <textarea
                    rows={6}
                    value={config.prompts.skillsPrompt}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        prompts: { ...config.prompts, skillsPrompt: e.target.value },
                      })
                    }
                    placeholder="Enter skills and reasoning protocols..."
                    style={{
                      width: "100%",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                      padding: 10,
                      borderRadius: 6,
                      color: "var(--text-main)",
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 12,
                      lineHeight: 1.5,
                      resize: "vertical",
                    }}
                  />
                </div>
              </div>

              {/* Right Column: Active MCP Servers Registry JSON */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                    Active MCP Servers Registry (Flexible JSON)
                  </label>
                  <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>Hot-reloaded automatically</span>
                </div>
                <textarea
                  value={mcpJsonText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMcpJsonText(val);
                    try {
                      JSON.parse(val);
                      setMcpJsonError(null);
                    } catch (err: any) {
                      setMcpJsonError(err.message);
                    }
                  }}
                  placeholder='{\n  "server-name": {\n    "command": "node",\n    "args": [...],\n    "enabled": true\n  }\n}'
                  spellCheck={false}
                  style={{
                    flex: 1,
                    minHeight: 330,
                    width: "100%",
                    background: "var(--bg-primary)",
                    border: mcpJsonError ? "1px solid var(--accent-rose, #ef4444)" : "1px solid var(--border-color)",
                    padding: 12,
                    borderRadius: 6,
                    color: "var(--accent-emerald)",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    resize: "vertical",
                  }}
                />
                {mcpJsonError ? (
                  <div style={{ fontSize: 11, color: "#f87171", marginTop: 6, lineHeight: 1.3 }}>
                    ⚠️ Syntax error: {mcpJsonError}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.4 }}>
                    💡 Plug in any MCP server here (e.g. SQLite, GitHub, Brave Search, Filesystem, or Custom Python/Node scripts).
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
              <button
                onClick={() => setShowConfig(false)}
                style={{
                  padding: "9px 18px",
                  borderRadius: 6,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-main)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveConfig}
                style={{
                  padding: "9px 20px",
                  borderRadius: 6,
                  background: "#1f6feb",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  boxShadow: "0 2px 4px rgba(31, 111, 235, 0.25)",
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tool & Server Config Inspector Modal */}
      {selectedToolDetail && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
          }}
        >
          <div
            style={{
              width: "min(680px, 90vw)",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              padding: 24,
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 15px 35px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Globe size={18} color="var(--accent-emerald)" />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>
                  {selectedToolDetail.name}
                </h3>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: "rgba(2, 132, 199, 0.15)",
                    color: "var(--accent)",
                    fontWeight: 600,
                  }}
                >
                  Server: {selectedToolDetail.serverName}
                </span>
              </div>
              <button
                onClick={() => setSelectedToolDetail(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 18,
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                DESCRIPTION
              </div>
              <div style={{ fontSize: 13, color: "var(--text-main)", background: "var(--bg-card)", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border-color)" }}>
                {selectedToolDetail.description || "No description provided."}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                HOST MCP SERVER CONFIGURATION
              </div>
              <pre
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  padding: 10,
                  fontSize: 12,
                  color: "var(--accent)",
                  fontFamily: "ui-monospace, monospace",
                  overflowX: "auto",
                }}
              >
                {JSON.stringify(selectedToolDetail.serverDef, null, 2)}
              </pre>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                INPUT SCHEMA (PARAMETERS DEFINITION)
              </div>
              <pre
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  padding: 10,
                  fontSize: 12,
                  color: "var(--accent-emerald)",
                  fontFamily: "ui-monospace, monospace",
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                {JSON.stringify(selectedToolDetail.inputSchema, null, 2)}
              </pre>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <button
                onClick={() => setSelectedToolDetail(null)}
                style={{
                  padding: "7px 18px",
                  borderRadius: 6,
                  background: "#1f6feb",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SLS Style Alert / Confirm Dialog */}
      {alertPrompt && (
        <AlertModal
          {...alertPrompt}
          onClose={() => setAlertPrompt(null)}
        />
      )}

      {/* Multi-Tab Excel / PDF / Word Document Attachment Modal (Session Scoped) */}
      <UploadDocModal
        isOpen={showDocModal}
        onClose={() => setShowDocModal(false)}
        activeDocHashes={activeDocHashes}
        onAddDocHash={addDocHash}
        onRemoveDocHash={removeDocHash}
        showAlert={showAlert}
        showConfirm={showConfirm}
      />

      {/* Sub-Conversation / Turn Inspector & Clone Modal */}
      <SubConversationModal
        isOpen={!!subConvModalFile}
        onClose={() => setSubConvModalFile(null)}
        sessionFilename={subConvModalFile}
        workspace={currentWorkspace}
        onCloneSuccess={async (newFilename) => {
          await fetchLogs(currentWorkspace);
          await fetchWorkspaces();
          await loadSession(newFilename, currentWorkspace);
        }}
        showAlert={showAlert}
      />

      {/* Two-Factor Authentication Setup Modal */}
      <TwoFactorSetupModal
        isOpen={show2FAModal}
        onClose={() => setShow2FAModal(false)}
      />

      {/* User Management Modal (Admin Only) */}
      <UserManagementModal
        isOpen={showUserMgmtModal}
        currentUser={currentUser}
        onClose={() => setShowUserMgmtModal(false)}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        showAlert={showAlert}
      />
    </div>
  );
}

export default App;
