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
  Mic,
  MicOff,
  Copy,
  ClipboardCheck,
  ClipboardPaste,
  Volume2,
  VolumeX,
  Square,
  Play,
  Pause,
  RotateCcw,
  ArrowUp,
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
  voice?: {
    baseUrl: string;
    apiKey: string;
    model: string;
    voiceId: string;
    speed: number;
    enabled: boolean;
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
  const [showVoiceApiKey, setShowVoiceApiKey] = useState(false);
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
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // 🎨 是否顯示 Mermaid 圖表頂部操作列按鈕群組 (預設 false 隱藏，遵循 SLS hide-mermaid-tools 設計)
  const [showMermaidTools, setShowMermaidTools] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("minibot_show_mermaid_tools");
      return saved === "1";
    } catch {
      return false;
    }
  });

  // 🎙️ Voice-to-Text (STT) 狀態與參照（支援 zh-HK 粵語、zh-CN 國語、en-US 英語）
  const [isListening, setIsListening] = useState<boolean>(false);
  const [sttLang, setSttLang] = useState<"zh-HK" | "zh-CN" | "en-US">(() => {
    try {
      return (localStorage.getItem("minibot_stt_lang") as "zh-HK" | "zh-CN" | "en-US") || "zh-HK";
    } catch {
      return "zh-HK";
    }
  });
  const [sttStatusText, setSttStatusText] = useState<string>("");
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const isStoppingVoiceRef = useRef<boolean>(false);
  const speechBuffersRef = useRef<{
    previousFinal: string;
    currentFinal: string;
    currentInterim: string;
  }>({
    previousFinal: "",
    currentFinal: "",
    currentInterim: "",
  });

  // 🔊 Text-to-Speech (TTS) 狀態與音訊參照（廣東話 / Cantonese）
  // 1: local TTS (瀏覽器原生 Web Speech Synthesis - zh-HK)
  // 2: minimax (MiniMax Speech-2.8-HD 神經網絡語音 API)
  // 語言選擇：粵語 (cantonese) / 國語 (mandarin) / 英語 (english)
  const [ttsLang, setTtsLang] = useState<"cantonese" | "mandarin" | "english">(() => {
    try {
      return (localStorage.getItem("minibot_tts_lang") as "cantonese" | "mandarin" | "english") || "cantonese";
    } catch {
      return "cantonese";
    }
  });
  const [ttsEngine, setTtsEngine] = useState<"local" | "minimax">(() => {
    try {
      return (localStorage.getItem("minibot_tts_engine") as "local" | "minimax") || "local";
    } catch {
      return "local";
    }
  });
  const [ttsVoiceId, setTtsVoiceId] = useState<string>(() => {
    try {
      return localStorage.getItem("minibot_tts_voice_id") || "Cantonese_CuteGirl";
    } catch {
      return "Cantonese_CuteGirl";
    }
  });
  // Local TTS 專屬自選聲線 URI (例如系統中的男聲 Danny、女聲 Sin-ji / Tracy 等)
  const [localTtsVoiceURI, setLocalTtsVoiceURI] = useState<string>(() => {
    try {
      return localStorage.getItem("minibot_local_tts_voice_uri") || "";
    } catch {
      return "";
    }
  });
  // 語音朗讀速度 (0.75x ~ 1.75x，預設 1.0x)
  const [ttsSpeed, setTtsSpeed] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("minibot_tts_speed");
      return saved ? parseFloat(saved) : 1.0;
    } catch {
      return 1.0;
    }
  });
  // MiniMax 大模型語音合成超時限制 (秒，預設 30s)
  const [ttsTimeout, setTtsTimeout] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("minibot_tts_timeout");
      return saved ? parseInt(saved, 10) : 30;
    } catch {
      return 30;
    }
  });
  // 系統已安裝的中文/粵語可用語音清單
  const [availableLocalVoices, setAvailableLocalVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isTtsPaused, setIsTtsPaused] = useState<boolean>(false);
  const [isTtsLoading, setIsTtsLoading] = useState<boolean>(false);
  const [showTtsMenu, setShowTtsMenu] = useState<boolean>(false);
  const ttsMenuRef = useRef<HTMLDivElement>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAudioBlobUrlRef = useRef<string | null>(null);
  const ttsAbortControllerRef = useRef<AbortController | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const ttsSpeakingTimeoutRef = useRef<any>(null);
  // 快取最後一次合成/播放的音訊資訊，支援免重新生成立即重播 (Repeat without regeneration)
  const lastTtsPlaybackRef = useRef<{
    messageId: string;
    text: string;
    engine: "local" | "minimax";
    audioBlobUrl: string | null;
  } | null>(null);
  const [showVoiceKeyEditor, setShowVoiceKeyEditor] = useState<boolean>(false);
  const [customVoiceApiKey, setCustomVoiceApiKey] = useState<string>("");
  const [isSavingVoiceKey, setIsSavingVoiceKey] = useState<boolean>(false);

  // 載入瀏覽器原生語音庫 (Web Speech API)
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const updateVoices = () => {
      const all = window.speechSynthesis.getVoices();
      // 篩選粵語 (zh-HK / yue)、國語 (zh-CN / zh-TW) 與英語 (en) 聲音
      const filtered = all.filter((v) => {
        const l = v.lang.toLowerCase();
        return l.startsWith("zh") || l.startsWith("yue") || l.startsWith("en");
      });
      setAvailableLocalVoices(filtered.length > 0 ? filtered : all);
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

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

  useEffect(() => {
    const handleClickOutsideTts = (e: MouseEvent) => {
      if (ttsMenuRef.current && !ttsMenuRef.current.contains(e.target as Node)) {
        setShowTtsMenu(false);
      }
    };
    if (showTtsMenu) {
      document.addEventListener("mousedown", handleClickOutsideTts);
      return () => document.removeEventListener("mousedown", handleClickOutsideTts);
    }
  }, [showTtsMenu]);

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
        credentials: "include",
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
      const res = await fetch("/api/workspaces", {
        credentials: "include",
        signal: AbortSignal.timeout(6000),
      });
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
        credentials: "include",
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
        credentials: "include",
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
            credentials: "include",
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
        credentials: "include",
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
  const lastGeneratedTurnRef = useRef<HTMLDivElement>(null);

  const scrollToLastGeneratedTurn = () => {
    if (lastGeneratedTurnRef.current) {
      lastGeneratedTurnRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Fetch initial configuration, workspaces, and active MCP tools
  useEffect(() => {
    fetchConfig();
    fetchWorkspaces();
    fetchLogs(currentWorkspace);
  }, []);

  const fetchLogs = async (wsName?: string) => {
    const ws = wsName || currentWorkspace;
    try {
      const res = await fetch(`/api/logs?workspace=${encodeURIComponent(ws)}`, {
        credentials: "include",
        signal: AbortSignal.timeout(6000),
      });
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
      const res = await fetch(`/api/logs/${encodeURIComponent(filename)}?workspace=${encodeURIComponent(ws)}`, {
        credentials: "include",
      });
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
              credentials: "include",
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
      const res = await fetch("/api/config", { credentials: "include" });
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
        credentials: "include",
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

  // 🎙️ Save Voice LLM API Key Only (Directly updates voice.apiKey without touching other settings)
  const saveVoiceApiKeyOnly = async (newKey: string) => {
    setIsSavingVoiceKey(true);
    try {
      const payload = {
        voice: {
          apiKey: newKey.trim(),
        },
      };
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        if (config) {
          setConfig({
            ...config,
            voice: {
              ...config.voice,
              apiKey: newKey.trim() ? (newKey.trim().length > 8 ? `${newKey.trim().slice(0, 6)}...****` : "****") : "",
            },
          });
        }
        showAlert(
          ttsLang === "cantonese"
            ? "MiniMax 語音 API Key 已成功儲存！"
            : ttsLang === "mandarin"
            ? "MiniMax 語音 API Key 已成功保存！"
            : "Voice API Key saved successfully!",
          "success",
          ttsLang === "cantonese" || ttsLang === "mandarin" ? "設定已更新" : "Voice Settings Updated"
        );
        setShowVoiceKeyEditor(false);
        setCustomVoiceApiKey("");
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
    } catch (err: any) {
      showAlert(
        `Failed to save Voice API Key: ${err.message || err}`,
        "error",
        "Save Failed"
      );
    } finally {
      setIsSavingVoiceKey(false);
    }
  };

  const toggleTool = (id: string) => {
    setExpandedTools((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // 🎙️ voicemate 核心連接詞與語氣詞字典（用於延長未完句子的安靜檢測期）
  const isIncompleteSentence = (text: string): boolean => {
    if (!text) return false;
    const clean = text.trim();
    const cantoneseConnectives = [
      "同埋", "因為", "但係", "即係", "如果", "仲有", "咁樣", "然後", "或者", "諗緊",
      "所以", "其實", "即", "而", "而且", "仲未", "只要", "不過", "可能", "特別係",
      "另外", "跟住", "仲話", "先至", "咁", "呢", "啊", "呀", "喎", "嘅時候", "同"
    ];
    const mandarinConnectives = [
      "而且", "因為", "但是", "如果", "然後", "還有", "就是", "所以", "其實", "不過", "並且"
    ];
    const englishConnectives = [
      "and", "or", "because", "but", "so", "then", "if", "when", "while", "like",
      "um", "uh", "well", "although", "however", "also", "actually", "meanwhile"
    ];

    for (const c of [...cantoneseConnectives, ...mandarinConnectives]) {
      if (clean.endsWith(c)) return true;
    }
    const lower = clean.toLowerCase();
    for (const w of englishConnectives) {
      if (lower.endsWith(" " + w) || lower === w) return true;
    }
    return false;
  };

  const stopVoiceRecognition = (providedTranscript?: string) => {
    if (!recognitionRef.current && !isListening) return;
    isStoppingVoiceRef.current = true;
    setIsListening(false);

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    const buffers = speechBuffersRef.current;
    const candidateText =
      (providedTranscript && typeof providedTranscript === "string" && providedTranscript.trim()) ||
      (buffers.previousFinal + " " + buffers.currentFinal + " " + buffers.currentInterim).trim();

    // 重設語音緩衝區
    speechBuffersRef.current = {
      previousFinal: "",
      currentFinal: "",
      currentInterim: "",
    };

    if (candidateText) {
      setInputPrompt(candidateText);
      setSttStatusText(`語音已轉為文字：${candidateText.slice(0, 20)}${candidateText.length > 20 ? "..." : ""}`);
      setTimeout(() => setSttStatusText(""), 3500);
      setTimeout(() => chatInputRef.current?.focus(), 100);
    } else {
      setSttStatusText("未偵測到清晰語音");
      setTimeout(() => setSttStatusText(""), 2500);
    }
    isStoppingVoiceRef.current = false;
  };

  const startVoiceRecognition = () => {
    // 檢查瀏覽器原生 SpeechRecognition 支援
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showAlert(
        "您的瀏覽器暫未支援 Web Speech API。請使用 Chrome 或 Edge 瀏覽器以使用語音轉文字功能。",
        "warning",
        "瀏覽器不支援語音輸入"
      );
      return;
    }

    // 若正在錄音中，點擊即為立即停止
    if (isListening) {
      stopVoiceRecognition();
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      speechBuffersRef.current = {
        previousFinal: "",
        currentFinal: "",
        currentInterim: "",
      };
      isStoppingVoiceRef.current = false;

      const recognition = new SpeechRecognition();
      recognition.lang = sttLang;
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        const langName = sttLang === "zh-HK" ? "🇭🇰 粵語" : sttLang === "zh-CN" ? "🇨🇳 國語" : "🇺🇸 English";
        setSttStatusText(`🎙️ 正在聆聽【${langName}】...`);
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";
        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        speechBuffersRef.current.currentFinal = final;
        speechBuffersRef.current.currentInterim = interim;

        const fullSpoken = (
          speechBuffersRef.current.previousFinal +
          " " +
          speechBuffersRef.current.currentFinal +
          " " +
          speechBuffersRef.current.currentInterim
        ).trim();

        if (fullSpoken) {
          // 即時同步顯示在輸入框內，所見即所得
          setInputPrompt(fullSpoken);

          const incomplete = isIncompleteSentence(fullSpoken);
          const baseDelay = 2000; // 基礎安靜停頓 2 秒
          const effectiveDelay = incomplete ? baseDelay + 1200 : baseDelay; // 連接詞智能延長 +1.2s
          const suffix = incomplete ? " (語氣未完，聆聽中...)" : ` (${(effectiveDelay / 1000).toFixed(1)}s 後自動停止)`;

          const preview = fullSpoken.length > 25 ? "..." + fullSpoken.slice(-25) : fullSpoken;
          setSttStatusText(`🎙️ "${preview}"${suffix}`);

          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            stopVoiceRecognition(fullSpoken);
          }, effectiveDelay);
        }
      };

      recognition.onerror = (e: any) => {
        console.warn("SpeechRecognition error:", e);
        if (e.error !== "no-speech") {
          setSttStatusText(`語音辨識提示: ${e.error}`);
        }
      };

      recognition.onend = () => {
        // 如果處於錄音狀態但非主動停止，則進行 keep-alive 自動續接重啟
        if (!isStoppingVoiceRef.current && isListening) {
          speechBuffersRef.current.previousFinal = (
            speechBuffersRef.current.previousFinal +
            " " +
            speechBuffersRef.current.currentFinal
          ).trim();
          speechBuffersRef.current.currentFinal = "";
          speechBuffersRef.current.currentInterim = "";
          try {
            recognition.start();
          } catch {}
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
      showAlert(`啟動語音辨識失敗: ${err.message || err}`, "error", "語音啟動失敗");
    }
  };

  // 🔊 Text-to-Speech (TTS) playback control (supports Local browser TTS and MiniMax Voice API)
  const stopTtsPlayback = () => {
    // Abort pending TTS fetch request if still in flight
    if (ttsAbortControllerRef.current) {
      try {
        ttsAbortControllerRef.current.abort();
      } catch {}
      ttsAbortControllerRef.current = null;
    }

    // Clear speaking keepalive interval if any
    if (ttsSpeakingTimeoutRef.current) {
      clearInterval(ttsSpeakingTimeoutRef.current);
      ttsSpeakingTimeoutRef.current = null;
    }
    // Clear active utterance ref
    if (activeUtteranceRef.current) {
      activeUtteranceRef.current.onend = null;
      activeUtteranceRef.current.onerror = null;
      activeUtteranceRef.current = null;
    }
    // Stop MiniMax audio element without triggering onerror
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.onerror = null;
        ttsAudioRef.current.onended = null;
        ttsAudioRef.current.pause();
        ttsAudioRef.current.currentTime = 0;
        ttsAudioRef.current.removeAttribute("src");
        ttsAudioRef.current.load();
      } catch {}
      ttsAudioRef.current = null;
    }
    // Stop browser native speech synthesis
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setPlayingMessageId(null);
    setIsTtsPaused(false);
    setIsTtsLoading(false);
  };

  // ⏸️ Pause / On-Hold current TTS playback
  const pauseTtsPlayback = () => {
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.pause();
      } catch {}
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.pause();
      } catch {}
    }
    setIsTtsPaused(true);
  };

  // ▶️ Resume current on-hold TTS playback
  const resumeTtsPlayback = async () => {
    if (ttsAudioRef.current) {
      try {
        await ttsAudioRef.current.play();
      } catch (err) {
        console.error("Failed to resume audio:", err);
      }
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.resume();
      } catch {}
    }
    setIsTtsPaused(false);
  };

  // 🔁 Repeat last played voice without regeneration (免重新生成立即重播)
  const repeatTtsPlayback = async () => {
    const cached = lastTtsPlaybackRef.current;
    if (!cached) {
      // If nothing played yet, fall back to playing the latest assistant response
      const assistantMsgs = messages.filter((m) => m.role === "assistant" && m.content.trim());
      if (assistantMsgs.length > 0) {
        const lastMsg = assistantMsgs[assistantMsgs.length - 1];
        playCantoneseTts(lastMsg.content, lastMsg.id);
      }
      return;
    }

    // If currently playing, stop it first
    stopTtsPlayback();

    // Mode A: MiniMax with cached audio blob URL - replay instantly without re-generating!
    if (cached.engine === "minimax" && cached.audioBlobUrl) {
      try {
        setPlayingMessageId(cached.messageId);
        setIsTtsPaused(false);
        const audio = new Audio();
        ttsAudioRef.current = audio;
        ttsAudioBlobUrlRef.current = cached.audioBlobUrl;

        audio.onended = () => {
          setPlayingMessageId(null);
          setIsTtsPaused(false);
        };

        audio.onerror = (e) => {
          if (!ttsAudioRef.current) return;
          console.error("Audio playback error during repeat:", e);
          setPlayingMessageId(null);
          setIsTtsPaused(false);
        };

        audio.src = cached.audioBlobUrl;
        audio.currentTime = 0;
        await audio.play();
        return;
      } catch (err) {
        console.warn("Replay from cached blob failed, re-fetching:", err);
      }
    }

    // Mode B: Local Web Speech API or fallback - replay clean text directly without regeneration
    playCantoneseTts(cached.text, cached.messageId);
  };

  const playCantoneseTts = async (text: string, messageId: string) => {
    // If clicking on currently playing message, stop playback
    if (playingMessageId === messageId) {
      stopTtsPlayback();
      return;
    }

    // Stop any previous playback
    stopTtsPlayback();

    // Clean markdown, HTML and thinking tags to extract clean readable text
    const cleanText = text
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/```[\s\S]*?```/g, " [Code Block] ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/\[([^\]]+)\]\(.*?\)/g, "$1")
      .replace(/[#*_\->~|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // If AI is still streaming, prompt user to wait
    const targetMsg = messages.find((m) => m.id === messageId);
    if ((targetMsg && targetMsg.isStreaming) || (loading && targetMsg && targetMsg.role === "assistant" && !targetMsg.content.trim())) {
      showAlert("Waiting for AI response to finish generating... Please wait a moment before reading aloud.", "info", "Waiting for AI response");
      return;
    }

    if (!cleanText) {
      if (loading || (targetMsg && targetMsg.isStreaming)) {
        showAlert("Waiting for AI to generate content... (Waiting for response)", "info", "Preparing Voice");
      } else {
        showAlert("This message does not contain readable text yet. (TTS composing)", "info", "TTS Queued");
      }
      return;
    }

    // Mode 1: Local Browser Native TTS (supports Cantonese / Mandarin / English / multi-voice / speed)
    if (ttsEngine === "local") {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        showAlert("Your browser does not support Web Speech Synthesis API.", "warning", "TTS Unavailable");
        return;
      }

      setPlayingMessageId(messageId);
      lastTtsPlaybackRef.current = {
        messageId,
        text: cleanText,
        engine: "local",
        audioBlobUrl: null,
      };

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const targetLang = ttsLang === "cantonese" ? "zh-HK" : ttsLang === "mandarin" ? "zh-CN" : "en-US";
      utterance.rate = ttsSpeed || 1.0;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      // 1. If user explicitly picked a voice URI, apply it
      let selectedVoice: SpeechSynthesisVoice | undefined;
      if (localTtsVoiceURI) {
        selectedVoice = voices.find((v) => v.voiceURI === localTtsVoiceURI);
      }
      // 2. Otherwise find best match for current language
      if (!selectedVoice) {
        if (ttsLang === "cantonese") {
          selectedVoice =
            voices.find((v) => v.lang === "zh-HK" || v.lang === "yue-Hant-HK" || v.lang.startsWith("zh-HK")) ||
            voices.find((v) => v.lang === "zh-TW" || v.lang === "zh-CN");
        } else if (ttsLang === "mandarin") {
          selectedVoice =
            voices.find((v) => v.lang === "zh-CN" || v.lang === "zh-TW" || (v.lang.startsWith("zh") && !v.lang.includes("HK"))) ||
            voices.find((v) => v.lang.startsWith("zh"));
        } else {
          selectedVoice =
            voices.find((v) => v.lang.startsWith("en-US") || v.lang.startsWith("en-GB") || v.lang.startsWith("en"));
        }
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang || targetLang;
      } else {
        utterance.lang = targetLang;
      }

      const cleanupUtterance = () => {
        if (ttsSpeakingTimeoutRef.current) {
          clearInterval(ttsSpeakingTimeoutRef.current);
          ttsSpeakingTimeoutRef.current = null;
        }
        activeUtteranceRef.current = null;
        setPlayingMessageId(null);
        setIsTtsPaused(false);
      };

      utterance.onend = () => {
        cleanupUtterance();
      };
      utterance.onerror = (e) => {
        console.warn("Local TTS error:", e);
        cleanupUtterance();
      };

      // Keep reference to avoid Chromium garbage collection bug during speech
      activeUtteranceRef.current = utterance;

      // Chrome speech synthesis paused bug workaround: keep resume pulsing during playback
      if (ttsSpeakingTimeoutRef.current) {
        clearInterval(ttsSpeakingTimeoutRef.current);
      }
      ttsSpeakingTimeoutRef.current = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else {
          if (ttsSpeakingTimeoutRef.current) {
            clearInterval(ttsSpeakingTimeoutRef.current);
            ttsSpeakingTimeoutRef.current = null;
          }
        }
      }, 10000);

      // In Chrome/Edge, calling cancel() immediately followed by speak() in the same microtask
      // can cancel network-based voices like Google voice. A slight delay avoids this race.
      try {
        window.speechSynthesis.cancel();
      } catch {}
      setTimeout(() => {
        try {
          window.speechSynthesis.resume();
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.error("speechSynthesis.speak error:", err);
          cleanupUtterance();
        }
      }, 40);
      return;
    }

    // Mode 2: MiniMax Speech-2.8-HD Neural Voice API
    const abortController = new AbortController();
    ttsAbortControllerRef.current = abortController;

    try {
      setIsTtsLoading(true);
      setPlayingMessageId(messageId);
      showAlert(`語音模型生成中，請稍候... (限時 ${ttsTimeout}s)`, "info", "生成語音中 (Generating Voice)");

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: abortController.signal,
        body: JSON.stringify({
          text: cleanText.slice(0, 3000),
          voiceId: ttsVoiceId || "Cantonese_CuteGirl",
          speed: ttsSpeed || 1.0,
          vol: 1.0,
          pitch: 0,
          timeout: ttsTimeout || 30,
        }),
      });

      // If aborted while waiting for response, return quietly
      if (abortController.signal.aborted) {
        return;
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server response error (${response.status})`);
      }

      const audioBlob = await response.blob();
      if (abortController.signal.aborted) {
        return;
      }
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error("Received empty audio from voice model");
      }

      // Revoke older blob URL if replacing
      if (lastTtsPlaybackRef.current?.audioBlobUrl) {
        try {
          URL.revokeObjectURL(lastTtsPlaybackRef.current.audioBlobUrl);
        } catch {}
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      ttsAudioBlobUrlRef.current = audioUrl;

      // Cache for instant zero-latency Repeat button!
      lastTtsPlaybackRef.current = {
        messageId,
        text: cleanText,
        engine: "minimax",
        audioBlobUrl: audioUrl,
      };

      const audio = new Audio();
      ttsAudioRef.current = audio;

      audio.onended = () => {
        setPlayingMessageId(null);
        setIsTtsPaused(false);
      };

      audio.onerror = (e) => {
        // If aborted or cleared by user stopping, do not popup error
        if (abortController.signal.aborted || !ttsAudioRef.current) {
          return;
        }
        console.error("Audio playback error:", e);
        setPlayingMessageId(null);
        setIsTtsPaused(false);
        showAlert("語音模型回應未及時或音訊解碼失敗，請稍候重試。(Voice model timed out or audio failed to decode)", "warning", "Audio Playback Failed");
      };

      audio.src = audioUrl;
      try {
        await audio.play();
      } catch (playErr: any) {
        // If play() was aborted or interrupted by user clicking pause/stop, ignore
        if (playErr.name === "AbortError" || abortController.signal.aborted) {
          return;
        }
        throw playErr;
      }
    } catch (err: any) {
      if (err.name === "AbortError" || abortController.signal.aborted) {
        return;
      }
      console.error("MiniMax TTS error:", err);
      setPlayingMessageId(null);
      showAlert(`語音大模型未及時反應或生成失敗 (${err.message || err})。建議稍候再試。`, "warning", "Voice Generation Failed");
    } finally {
      if (ttsAbortControllerRef.current === abortController) {
        ttsAbortControllerRef.current = null;
      }
      setIsTtsLoading(false);
    }
  };

  const handleSend = async (textOverride?: string) => {
    const rawQuery = textOverride !== undefined ? textOverride : inputPrompt;
    if (!rawQuery.trim() || loading) return;

    // 若送出時仍在錄音，先行停止
    if (isListening) {
      stopVoiceRecognition();
    }

    const userMessageId = "user-" + Date.now();
    const assistantMessageId = "asst-" + Date.now();
    const query = rawQuery.trim();
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
        credentials: "include",
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

            {/* 🔊 Group of 4 Voice Controls: 1. Speak | 2. On-Hold/Resume | 3. Stop | 4. Setup */}
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }} ref={ttsMenuRef}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  borderRadius: 8,
                  border: playingMessageId ? "1px solid #10b981" : "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  overflow: "hidden",
                }}
              >
                {/* 1. Speak Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (playingMessageId) {
                      if (isTtsPaused) {
                        resumeTtsPlayback();
                      }
                    } else {
                      // Speak the latest assistant response
                      const assistantMsgs = messages.filter((m) => m.role === "assistant" && m.content.trim());
                      if (assistantMsgs.length > 0) {
                        const lastMsg = assistantMsgs[assistantMsgs.length - 1];
                        playCantoneseTts(lastMsg.content, lastMsg.id);
                      } else {
                        showAlert(
                          ttsLang === "cantonese"
                            ? "目前對話中尚無助理回答可供朗讀"
                            : ttsLang === "mandarin"
                            ? "目前對話中尚無助理回答可供朗讀"
                            : "No assistant response available in current conversation.",
                          "info",
                          ttsLang === "cantonese" || ttsLang === "mandarin" ? "無法朗讀" : "Nothing to Speak"
                        );
                      }
                    }
                  }}
                  title={
                    playingMessageId
                      ? isTtsPaused ? "Resume Playback" : "Currently Playing"
                      : ttsLang === "cantonese"
                      ? `播放最新回答 (粵語 | ${ttsSpeed}x)`
                      : ttsLang === "mandarin"
                      ? `播放最新回答 (國語 | ${ttsSpeed}x)`
                      : `Play latest answer (English | ${ttsSpeed}x)`
                  }
                  style={{
                    height: 32,
                    padding: "0 10px",
                    background: playingMessageId && !isTtsPaused ? "rgba(16, 185, 129, 0.2)" : "transparent",
                    border: "none",
                    color: playingMessageId && !isTtsPaused ? "#10b981" : "var(--text-main)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {isTtsLoading ? (
                    <Loader2 size={15} className="spin" color="#10b981" />
                  ) : playingMessageId && !isTtsPaused ? (
                    <Volume2 size={15} color="#10b981" className="animate-pulse" />
                  ) : (
                    <Play size={15} color="var(--accent, #0284c7)" fill="var(--accent, #0284c7)" />
                  )}
                </button>

                {/* 2. On-Hold / Resume Button */}
                <button
                  type="button"
                  disabled={!playingMessageId}
                  onClick={() => {
                    if (!playingMessageId) return;
                    if (isTtsPaused) {
                      resumeTtsPlayback();
                    } else {
                      pauseTtsPlayback();
                    }
                  }}
                  title={
                    !playingMessageId
                      ? "No active audio playback"
                      : isTtsPaused
                      ? "點擊繼續播放 (Resume)"
                      : "點擊暫停保留 (On-Hold)"
                  }
                  style={{
                    height: 32,
                    padding: "0 10px",
                    background: isTtsPaused ? "rgba(245, 158, 11, 0.2)" : "transparent",
                    border: "none",
                    borderLeft: "1px solid var(--border-color)",
                    color: !playingMessageId ? "var(--text-muted)" : isTtsPaused ? "#f59e0b" : "var(--text-main)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: !playingMessageId ? "not-allowed" : "pointer",
                    opacity: !playingMessageId ? 0.45 : 1,
                    transition: "all 0.15s ease",
                  }}
                >
                  {isTtsPaused ? (
                    <Play size={14} color="#f59e0b" fill="#f59e0b" />
                  ) : (
                    <Pause size={14} color={playingMessageId ? "var(--text-main)" : "var(--text-muted)"} />
                  )}
                </button>

                {/* 3. Repeat Button (No re-generation) */}
                <button
                  type="button"
                  onClick={repeatTtsPlayback}
                  title={
                    ttsLang === "cantonese"
                      ? "重播 (免重新生成)"
                      : ttsLang === "mandarin"
                      ? "重播 (免重新生成)"
                      : "Repeat last speech (Instant zero-latency replay without regeneration)"
                  }
                  style={{
                    height: 32,
                    padding: "0 10px",
                    background: "transparent",
                    border: "none",
                    borderLeft: "1px solid var(--border-color)",
                    color: "var(--text-main)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--accent, #0284c7)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-main)";
                  }}
                >
                  <RotateCcw size={14} color="var(--accent, #0284c7)" />
                </button>

                {/* 4. Stop Button */}
                <button
                  type="button"
                  disabled={!playingMessageId && !isTtsLoading}
                  onClick={stopTtsPlayback}
                  title="點擊停止播放 (Stop)"
                  style={{
                    height: 32,
                    padding: "0 10px",
                    background: "transparent",
                    border: "none",
                    borderLeft: "1px solid var(--border-color)",
                    color: playingMessageId || isTtsLoading ? "#ef4444" : "var(--text-muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: !playingMessageId && !isTtsLoading ? "not-allowed" : "pointer",
                    opacity: !playingMessageId && !isTtsLoading ? 0.45 : 1,
                    transition: "all 0.15s ease",
                  }}
                >
                  <Square size={13} fill={playingMessageId || isTtsLoading ? "#ef4444" : "var(--text-muted)"} />
                </button>

                {/* 5. Setup Dropdown Trigger */}
                <button
                  type="button"
                  onClick={() => setShowTtsMenu(!showTtsMenu)}
                  title={
                    ttsLang === "cantonese"
                      ? `語音設定 (語言: 粵語 | ${ttsEngine === "local" ? "本機語音" : "MiniMax 雲端"} | 限時: ${ttsTimeout}s | ${ttsSpeed}x)`
                      : ttsLang === "mandarin"
                      ? `語音設定 (語言: 國語 | ${ttsEngine === "local" ? "本機語音" : "MiniMax 雲端"} | 限時: ${ttsTimeout}s | ${ttsSpeed}x)`
                      : `Voice Setup (Language: English | ${ttsEngine === "local" ? "Local" : "MiniMax"} | Timeout: ${ttsTimeout}s | ${ttsSpeed}x)`
                  }
                  style={{
                    height: 32,
                    padding: "0 8px",
                    background: showTtsMenu ? "rgba(16, 185, 129, 0.15)" : "transparent",
                    border: "none",
                    borderLeft: "1px solid var(--border-color)",
                    color: showTtsMenu ? "#10b981" : "var(--text-muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 600,
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{ttsLang === "cantonese" ? "粵語" : ttsLang === "mandarin" ? "國語" : "English"}</span>
                  <ChevronDown
                    size={12}
                    style={{
                      transform: showTtsMenu ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    }}
                  />
                </button>
              </div>

              {/* TTS Voice Setup Dropdown Popover */}
              {showTtsMenu && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    width: 320,
                    background: "var(--bg-secondary, #1e293b)",
                    border: "1px solid var(--border-color, #334155)",
                    borderRadius: 12,
                    boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
                    zIndex: 1000,
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.5px" }}>
                      {ttsLang === "cantonese" ? "語音設定 (VOICE SETUP)" : ttsLang === "mandarin" ? "語音設定 (VOICE SETUP)" : "VOICE SETUP"}
                    </span>
                    {playingMessageId && (
                      <button
                        type="button"
                        onClick={stopTtsPlayback}
                        style={{
                          background: "rgba(239, 68, 68, 0.15)",
                          border: "1px solid #ef4444",
                          color: "#ef4444",
                          borderRadius: 4,
                          padding: "1px 6px",
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <Square size={9} fill="#ef4444" /> {ttsLang === "cantonese" || ttsLang === "mandarin" ? "停止播放" : "Stop"}
                      </button>
                    )}
                  </div>

                  {/* Engine Selection: Option 1 vs Option 2 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {/* Option 1: Local Browser TTS */}
                    <div
                      onClick={() => {
                        setTtsEngine("local");
                        try {
                          localStorage.setItem("minibot_tts_engine", "local");
                        } catch {}
                      }}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: ttsEngine === "local" ? "1px solid #10b981" : "1px solid var(--border-color)",
                        background: ttsEngine === "local" ? "rgba(16, 185, 129, 0.12)" : "var(--bg-card)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: ttsEngine === "local" ? "#10b981" : "var(--text-main)" }}>
                          {ttsLang === "cantonese" ? "1. 本地瀏覽器語音 (Local Browser TTS)" : ttsLang === "mandarin" ? "1. 本地瀏覽器語音 (Local Browser TTS)" : "1. Local Browser TTS"}
                        </span>
                        {ttsEngine === "local" && <Check size={14} color="#10b981" />}
                      </div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {ttsLang === "cantonese"
                          ? "本機 Web Speech API (支援系統聲線與 Google 聲線，離線零延遲)"
                          : ttsLang === "mandarin"
                          ? "本機 Web Speech API (支援系統聲線與 Google 聲線，離線零延遲)"
                          : "System Web Speech API (Local & Google voices, zero latency)"}
                      </span>
                    </div>

                    {/* Option 2: MiniMax Neural Voice API */}
                    <div
                      onClick={() => {
                        setTtsEngine("minimax");
                        try {
                          localStorage.setItem("minibot_tts_engine", "minimax");
                        } catch {}
                      }}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: ttsEngine === "minimax" ? "1px solid #10b981" : "1px solid var(--border-color)",
                        background: ttsEngine === "minimax" ? "rgba(16, 185, 129, 0.12)" : "var(--bg-card)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: ttsEngine === "minimax" ? "#10b981" : "var(--text-main)" }}>
                          {ttsLang === "cantonese" ? "2. MiniMax 雲端大模型語音 (Voice API)" : ttsLang === "mandarin" ? "2. MiniMax 雲端大模型語音 (Voice API)" : "2. MiniMax Voice API"}
                        </span>
                        {ttsEngine === "minimax" && <Check size={14} color="#10b981" />}
                      </div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {ttsLang === "cantonese"
                          ? "MiniMax Speech-2.8-HD 超逼真磁性真人語音"
                          : ttsLang === "mandarin"
                          ? "MiniMax Speech-2.8-HD 超逼真磁性真人語音"
                          : "Speech-2.8-HD Neural AI voices with expressive tones"}
                      </span>
                    </div>
                  </div>

                  {/* Language Selector: Cantonese / Mandarin / English */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--bg-card)", padding: 8, borderRadius: 8, border: "1px solid var(--border-color)" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>
                      {ttsLang === "cantonese" || ttsLang === "mandarin" ? "語音語言 (Voice Language):" : "Voice Language:"}
                    </span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[
                        { id: "cantonese", label: ttsLang === "cantonese" || ttsLang === "mandarin" ? "🇭🇰 粵語" : "🇭🇰 Cantonese", defaultVoice: "Cantonese_CuteGirl" },
                        { id: "mandarin", label: ttsLang === "cantonese" || ttsLang === "mandarin" ? "🇨🇳 國語" : "🇨🇳 Mandarin", defaultVoice: "female-yujie" },
                        { id: "english", label: ttsLang === "cantonese" || ttsLang === "mandarin" ? "🇬🇧 英語" : "🇬🇧 English", defaultVoice: "English_Trustworthy_Man" }
                      ].map((item) => {
                        const isSelected = ttsLang === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              const newLang = item.id as "cantonese" | "mandarin" | "english";
                              setTtsLang(newLang);
                              try {
                                localStorage.setItem("minibot_tts_lang", newLang);
                              } catch {}
                              setTtsVoiceId(item.defaultVoice);
                              try {
                                localStorage.setItem("minibot_tts_voice_id", item.defaultVoice);
                              } catch {}
                              setLocalTtsVoiceURI("");
                              try {
                                localStorage.removeItem("minibot_local_tts_voice_uri");
                              } catch {}
                            }}
                            style={{
                              flex: 1,
                              padding: "5px 2px",
                              borderRadius: 6,
                              border: isSelected ? "1px solid #10b981" : "1px solid var(--border-color)",
                              background: isSelected ? "rgba(16, 185, 129, 0.15)" : "var(--bg-secondary)",
                              color: isSelected ? "#10b981" : "var(--text-main)",
                              fontSize: 11,
                              fontWeight: isSelected ? 700 : 500,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Local Voice Selector (When Local TTS is selected) */}
                  {ttsEngine === "local" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "var(--bg-card)", padding: 8, borderRadius: 8, border: "1px solid var(--border-color)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>
                          {ttsLang === "cantonese"
                            ? "選擇本機聲音 (Voice Profile):"
                            : ttsLang === "mandarin"
                            ? "選擇本機聲音 (Voice Profile):"
                            : `Voice Profile (${ttsLang === "cantonese" ? "Cantonese" : ttsLang === "mandarin" ? "Mandarin" : "English"}):`}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {availableLocalVoices.length} {ttsLang === "cantonese" || ttsLang === "mandarin" ? "款可用" : "available"}
                        </span>
                      </div>
                      <select
                        value={localTtsVoiceURI}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLocalTtsVoiceURI(val);
                          try {
                            localStorage.setItem("minibot_local_tts_voice_uri", val);
                          } catch {}
                        }}
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: 6,
                          background: "var(--bg-secondary)",
                          border: "1px solid var(--border-color)",
                          color: "var(--text-main)",
                          fontSize: 11,
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        <option value="">
                          {ttsLang === "cantonese"
                            ? "⚙️ 系統自動判定最佳粵語聲音"
                            : ttsLang === "mandarin"
                            ? "⚙️ 系統自動判定最佳國語聲音"
                            : `⚙️ Auto (Best match for ${ttsLang === "cantonese" ? "Cantonese" : ttsLang === "mandarin" ? "Mandarin" : "English"})`}
                        </option>
                        {(() => {
                          const filtered = availableLocalVoices.filter((v) => {
                            const l = v.lang.toLowerCase();
                            if (ttsLang === "cantonese") return l.includes("hk") || l.includes("yue");
                            if (ttsLang === "mandarin") return (l.startsWith("zh") && !l.includes("hk")) || l.includes("tw") || l.includes("cn");
                            return l.startsWith("en");
                          });
                          const listToShow = filtered.length > 0 ? filtered : availableLocalVoices;
                          return listToShow.map((v) => {
                            const isMale = v.name.toLowerCase().includes("danny") || v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("man") || v.name.toLowerCase().includes("david");
                            const isFemale = v.name.toLowerCase().includes("sin-ji") || v.name.toLowerCase().includes("tracy") || v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("zira") || v.name.toLowerCase().includes("woman");
                            const tag = isMale
                              ? (ttsLang === "cantonese" || ttsLang === "mandarin" ? " [男聲]" : " [Male]")
                              : isFemale
                              ? (ttsLang === "cantonese" || ttsLang === "mandarin" ? " [女聲]" : " [Female]")
                              : "";
                            return (
                              <option key={v.voiceURI} value={v.voiceURI}>
                                {v.name} ({v.lang}){tag}
                              </option>
                            );
                          });
                        })()}
                      </select>
                    </div>
                  )}

                  {/* MiniMax Persona Selector (When MiniMax is selected) */}
                  {ttsEngine === "minimax" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "var(--bg-card)", padding: 8, borderRadius: 8, border: "1px solid var(--border-color)" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>
                        {ttsLang === "cantonese"
                          ? "人格聲線 (Voice Persona):"
                          : ttsLang === "mandarin"
                          ? "人格聲線 (Voice Persona):"
                          : `Voice Persona (${ttsLang === "cantonese" ? "Cantonese" : ttsLang === "mandarin" ? "Mandarin" : "English"}):`}
                      </span>
                      <select
                        value={ttsVoiceId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTtsVoiceId(val);
                          try {
                            localStorage.setItem("minibot_tts_voice_id", val);
                          } catch {}
                        }}
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: 6,
                          background: "var(--bg-secondary)",
                          border: "1px solid var(--border-color)",
                          color: "var(--text-main)",
                          fontSize: 11,
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        {ttsLang === "cantonese" && (
                          <>
                            <option value="Cantonese_CuteGirl">🌟 Cute Girl (元氣輕快女孩)</option>
                            <option value="Cantonese_KindWoman">🌸 Kind Woman (溫暖親切大姐姐)</option>
                            <option value="Cantonese_ProfessionalHost（F)">🎙️ Professional Host (知性幹練女主播)</option>
                            <option value="Cantonese_GentleLady">☕ Gentle Lady (溫柔磁性熟女)</option>
                            <option value="Cantonese_LivelyYouth">⚡ Lively Youth (活潑靈動少女)</option>
                            <option value="presenter_male">👔 Presenter Male (沉穩男主持)</option>
                          </>
                        )}
                        {ttsLang === "mandarin" && (
                          <>
                            <option value="female-yujie">🌟 Female Yujie (溫柔知性御姐)</option>
                            <option value="female-tianmei">🌸 Female Tianmei (甜美親切少女)</option>
                            <option value="presenter_male">🎙️ Presenter Male (沉穩專業播音員)</option>
                            <option value="presenter_female">📻 Presenter Female (專業新聞女主播)</option>
                            <option value="male-qn-qingse">⚡ Male Youth (陽光青澀少年)</option>
                            <option value="male-qn-jingying">👔 Elite Male (商務菁英男聲)</option>
                          </>
                        )}
                        {ttsLang === "english" && (
                          <>
                            <option value="English_Trustworthy_Man">💼 Trustworthy Man</option>
                            <option value="English_Graceful_Lady">🌸 Graceful Lady</option>
                            <option value="English_Energetic_Female">⚡ Energetic Female</option>
                            <option value="English_Warm_Friend">☕ Warm Friend</option>
                            <option value="English_Inspiring_Speaker">🎙️ Inspiring Speaker</option>
                          </>
                        )}
                      </select>
                    </div>
                  )}

                  {/* Speed Adjustment Slider & Presets */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--bg-card)", padding: 8, borderRadius: 8, border: "1px solid var(--border-color)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>
                        {ttsLang === "cantonese" || ttsLang === "mandarin" ? "播放速度 (Playback Speed):" : "Playback Speed:"}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>
                        {ttsSpeed.toFixed(2)}x
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.05"
                      value={ttsSpeed}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setTtsSpeed(val);
                        try {
                          localStorage.setItem("minibot_tts_speed", String(val));
                        } catch {}
                      }}
                      style={{ width: "100%", cursor: "pointer" }}
                    />

                    {/* Quick Speed Pills */}
                    <div style={{ display: "flex", gap: 4, justifyContent: "space-between" }}>
                      {[0.8, 1.0, 1.25, 1.5].map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => {
                            setTtsSpeed(spd);
                            try {
                              localStorage.setItem("minibot_tts_speed", String(spd));
                            } catch {}
                          }}
                          style={{
                            flex: 1,
                            padding: "3px 0",
                            borderRadius: 4,
                            border: ttsSpeed === spd ? "1px solid var(--accent)" : "1px solid var(--border-color)",
                            background: ttsSpeed === spd ? "rgba(2, 132, 199, 0.15)" : "var(--bg-secondary)",
                            color: ttsSpeed === spd ? "var(--accent)" : "var(--text-muted)",
                            fontSize: 10,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ⏱️ TTS Timeout Setting */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                        {ttsLang === "cantonese" || ttsLang === "mandarin" ? "合成超時上限 (TIMEOUT)" : "TTS TIMEOUT LIMIT"}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>
                        {ttsTimeout}s
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      {[5, 10, 15, 30, 60].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => {
                            setTtsTimeout(sec);
                            try {
                              localStorage.setItem("minibot_tts_timeout", String(sec));
                            } catch {}
                          }}
                          style={{
                            flex: 1,
                            padding: "3px 0",
                            borderRadius: 4,
                            border: ttsTimeout === sec ? "1px solid var(--accent)" : "1px solid var(--border-color)",
                            background: ttsTimeout === sec ? "rgba(2, 132, 199, 0.15)" : "var(--bg-secondary)",
                            color: ttsTimeout === sec ? "var(--accent)" : "var(--text-muted)",
                            fontSize: 10,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 🔊 Test Voice Role / Persona Button */}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      disabled={isTtsLoading && playingMessageId === "__tts_test_preview__"}
                      onClick={() => {
                        let testSampleText = "你好！呢個係本地瀏覽器粵語聲音測試，速度同聲線設定正常運作。";
                        if (ttsLang === "cantonese") {
                          testSampleText = ttsEngine === "local"
                            ? "你好！呢個係本地瀏覽器粵語聲音測試，速度同聲線設定正常運作。"
                            : "你好！我係你嘅 MiniMax 粵語語音助手，呢個係聲線角色測試。";
                        } else if (ttsLang === "mandarin") {
                          testSampleText = ttsEngine === "local"
                            ? "您好！這是本地瀏覽器國語聲音測試，語速與聲線設定正常運作。"
                            : "您好！我是您的 MiniMax 國語語音助手，這是聲線角色測試。";
                        } else {
                          testSampleText = ttsEngine === "local"
                            ? "Hello! This is a test of the local browser English voice synthesizer."
                            : "Hello! I am your MiniMax neural voice assistant. This is a voice persona test.";
                        }
                        playCantoneseTts(testSampleText, "__tts_test_preview__");
                      }}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: 6,
                        background: playingMessageId === "__tts_test_preview__" ? "rgba(16, 185, 129, 0.15)" : "var(--bg-card)",
                        border: playingMessageId === "__tts_test_preview__" ? "1px solid #10b981" : "1px solid var(--border-color)",
                        color: playingMessageId === "__tts_test_preview__" ? "#10b981" : "var(--text-main)",
                        fontSize: 11,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {isTtsLoading && playingMessageId === "__tts_test_preview__" ? (
                        <>
                          <Loader2 size={12} className="spin" color="#10b981" />
                          <span>{ttsLang === "cantonese" || ttsLang === "mandarin" ? "合成音訊中..." : "Composing..."}</span>
                        </>
                      ) : playingMessageId === "__tts_test_preview__" ? (
                        <>
                          <Square size={11} fill="#10b981" />
                          <span>{ttsLang === "cantonese" || ttsLang === "mandarin" ? "正在測試 (點擊停止)" : "Testing (Click to stop)"}</span>
                        </>
                      ) : (
                        <>
                          <Play size={12} fill="currentColor" />
                          <span>{ttsLang === "cantonese" || ttsLang === "mandarin" ? "測試聲音角色" : "Test Voice"}</span>
                        </>
                      )}
                    </button>

                    {/* Quick Stop Button */}
                    {playingMessageId && (
                      <button
                        type="button"
                        onClick={() => stopTtsPlayback()}
                        title={ttsLang === "cantonese" || ttsLang === "mandarin" ? "停止播放" : "Stop playback"}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: "rgba(239, 68, 68, 0.15)",
                          border: "1px solid #ef4444",
                          color: "#ef4444",
                          fontSize: 11,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                          cursor: "pointer",
                        }}
                      >
                        <Square size={11} fill="#ef4444" />
                        <span>{ttsLang === "cantonese" || ttsLang === "mandarin" ? "停止" : "Stop"}</span>
                      </button>
                    )}
                  </div>

                  {/* 🔑 Voice LLM Settings: Change API Key Only */}
                  <div style={{ marginTop: 2, paddingTop: 8, borderTop: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}>
                        <Volume2 size={12} color="#10b981" />
                        {ttsLang === "cantonese"
                          ? "Voice LLM 設定 (金鑰變更)"
                          : ttsLang === "mandarin"
                          ? "Voice LLM 設定 (金鑰變更)"
                          : "Voice LLM Setting"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowVoiceKeyEditor(!showVoiceKeyEditor);
                          if (!showVoiceKeyEditor && config?.voice?.apiKey) {
                            setCustomVoiceApiKey(config.voice.apiKey.includes("****") ? "" : config.voice.apiKey);
                          }
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: showVoiceKeyEditor ? "#10b981" : "var(--accent)",
                          cursor: "pointer",
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: 0,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 2,
                        }}
                      >
                        {showVoiceKeyEditor
                          ? (ttsLang === "cantonese" || ttsLang === "mandarin" ? "收起" : "Hide")
                          : (ttsLang === "cantonese" || ttsLang === "mandarin" ? "變更 API Key" : "Change API Key")}
                      </button>
                    </div>

                    {showVoiceKeyEditor && (
                      <div style={{ background: "var(--bg-card)", padding: 8, borderRadius: 8, border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.3 }}>
                          {ttsLang === "cantonese"
                            ? "輸入 MiniMax Voice API Key（若留空將自動沿用主 LLM 金鑰）："
                            : ttsLang === "mandarin"
                            ? "輸入 MiniMax Voice API Key（若留空將自動沿用主 LLM 金鑰）："
                            : "Enter MiniMax Voice API Key (leave empty to inherit main LLM key):"}
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <input
                            type="password"
                            value={customVoiceApiKey}
                            onChange={(e) => setCustomVoiceApiKey(e.target.value)}
                            placeholder={config?.voice?.apiKey || "sk-cp-..."}
                            style={{
                              flex: 1,
                              background: "var(--bg-secondary)",
                              border: "1px solid var(--border-color)",
                              borderRadius: 4,
                              padding: "5px 8px",
                              fontSize: 11,
                              color: "var(--text-main)",
                              outline: "none",
                              fontFamily: "monospace",
                            }}
                          />
                          <button
                            type="button"
                            disabled={isSavingVoiceKey}
                            onClick={() => saveVoiceApiKeyOnly(customVoiceApiKey)}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 4,
                              background: "#10b981",
                              border: "none",
                              color: "#ffffff",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: isSavingVoiceKey ? "not-allowed" : "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isSavingVoiceKey ? <Loader2 size={11} className="spin" /> : <Check size={11} />}
                            <span>{ttsLang === "cantonese" || ttsLang === "mandarin" ? "儲存" : "Save"}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

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
              // Identify if this is the last assistant response or thread end
              const lastAssistantIdx = messages.map((item) => item.role).lastIndexOf("assistant");
              const targetIdx = lastAssistantIdx !== -1 ? lastAssistantIdx : messages.length - 1;
              const isTargetTurn = mIdx === targetIdx;

              // Calculate a display turn index if not present
              const turnNumber = m.turnIndex || Math.floor(mIdx / 2) + 1;
              const timeString = m.timestamp
                ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                : "";

              return (
                <div
                  key={m.id}
                  ref={isTargetTurn ? lastGeneratedTurnRef : undefined}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isUser ? "flex-end" : "flex-start",
                    width: "100%",
                    minWidth: 0,
                    scrollMarginTop: "24px",
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
                        padding: "10px 14px",
                        borderRadius: "16px 16px 2px 16px",
                        maxWidth: "85%",
                        fontSize: 14,
                        lineHeight: 1.5,
                        wordBreak: "break-word",
                        overflowWrap: "anywhere",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <MarkdownRenderer content={m.content} />
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(m.content);
                            setCopiedMessageId(m.id);
                            setTimeout(() => setCopiedMessageId(null), 2000);
                          } catch (err) {
                            console.error("Failed to copy user message:", err);
                          }
                        }}
                        title="Copy message"
                        style={{
                          background: copiedMessageId === m.id ? "rgba(16, 185, 129, 0.15)" : "transparent",
                          border: "none",
                          borderRadius: 4,
                          padding: "4px",
                          color: copiedMessageId === m.id ? "#10b981" : "#0284c7",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          opacity: 0.75,
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = "1";
                          e.currentTarget.style.background = "rgba(2, 132, 199, 0.12)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = "0.75";
                          e.currentTarget.style.background = copiedMessageId === m.id ? "rgba(16, 185, 129, 0.15)" : "transparent";
                        }}
                      >
                        {copiedMessageId === m.id ? (
                          <ClipboardCheck size={14} color="#10b981" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
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

                          <div style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
                            {/* 🔊 Text-to-Voice Play/Stop Button */}
                            <button
                              type="button"
                              onClick={() => playCantoneseTts(m.content, m.id)}
                              disabled={isTtsLoading && playingMessageId === m.id}
                              title={
                                playingMessageId === m.id
                                  ? ttsLang === "cantonese" ? "停止朗讀" : ttsLang === "mandarin" ? "停止朗讀" : "Stop reading aloud"
                                  : ttsLang === "cantonese"
                                  ? `朗讀此回答 (粵語 | 模式: ${ttsEngine === "local" ? "本機語音" : "MiniMax 雲端"})`
                                  : ttsLang === "mandarin"
                                  ? `朗讀此回答 (國語 | 模式: ${ttsEngine === "local" ? "本機語音" : "MiniMax 雲端"})`
                                  : `Read response aloud (English | Mode: ${ttsEngine === "local" ? "Local TTS" : "MiniMax Voice API"})`
                              }
                              style={{
                                background: playingMessageId === m.id ? "rgba(16, 185, 129, 0.15)" : "transparent",
                                border: playingMessageId === m.id ? "1px solid #10b981" : "1px solid var(--border-color)",
                                borderRadius: 4,
                                padding: "2px 8px",
                                fontSize: 10,
                                fontWeight: 600,
                                color: playingMessageId === m.id ? "#10b981" : "var(--text-muted)",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => {
                                if (playingMessageId !== m.id) {
                                  e.currentTarget.style.borderColor = "#10b981";
                                  e.currentTarget.style.color = "#10b981";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (playingMessageId !== m.id) {
                                  e.currentTarget.style.borderColor = "var(--border-color)";
                                  e.currentTarget.style.color = "var(--text-muted)";
                                }
                              }}
                            >
                              {isTtsLoading && playingMessageId === m.id ? (
                                <>
                                  <Loader2 size={11} className="spin" color="#10b981" />
                                  <span style={{ color: "#10b981" }}>
                                    {ttsLang === "cantonese" ? "合成中..." : ttsLang === "mandarin" ? "合成中..." : "Composing..."}
                                  </span>
                                </>
                              ) : playingMessageId === m.id ? (
                                <>
                                  <Square size={10} fill="#ef4444" color="#ef4444" />
                                  <span style={{ color: "#ef4444" }}>
                                    Stop
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Volume2 size={11} />
                                  <span>Play</span>
                                </>
                              )}
                            </button>

                            {/* Message Row On-Hold / Resume Button */}
                            {playingMessageId === m.id && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (isTtsPaused) {
                                    resumeTtsPlayback();
                                  } else {
                                    pauseTtsPlayback();
                                  }
                                }}
                                title={isTtsPaused ? "繼續播放 (Resume)" : "暫停播放 (On-Hold)"}
                                style={{
                                  background: isTtsPaused ? "rgba(245, 158, 11, 0.2)" : "rgba(245, 158, 11, 0.1)",
                                  border: "1px solid #f59e0b",
                                  borderRadius: 4,
                                  padding: "2px 8px",
                                  fontSize: 10,
                                  fontWeight: 600,
                                  color: "#f59e0b",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {isTtsPaused ? (
                                  <>
                                    <Play size={10} color="#f59e0b" fill="#f59e0b" />
                                    <span>Resume</span>
                                  </>
                                ) : (
                                  <>
                                    <Pause size={10} color="#f59e0b" />
                                    <span>On-Hold</span>
                                  </>
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={async () => {
                                // Extract clean text content (stripping thought tag for clean output)
                                const cleanText = m.content.replace(/<think>[\s\S]*?<\/think>/i, "").trim() || m.content;
                                try {
                                  await navigator.clipboard.writeText(cleanText);
                                  setCopiedMessageId(m.id);
                                  setTimeout(() => setCopiedMessageId(null), 2000);
                                } catch (err) {
                                  console.error("Failed to copy output:", err);
                                }
                              }}
                              title="Copy full response text"
                              style={{
                                background: "transparent",
                                border: "1px solid var(--border-color)",
                                borderRadius: 4,
                                padding: "2px 8px",
                                fontSize: 10,
                                fontWeight: 600,
                                color: copiedMessageId === m.id ? "#10b981" : "var(--text-muted)",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => {
                                if (copiedMessageId !== m.id) {
                                  e.currentTarget.style.borderColor = "var(--accent)";
                                  e.currentTarget.style.color = "var(--accent)";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (copiedMessageId !== m.id) {
                                  e.currentTarget.style.borderColor = "var(--border-color)";
                                  e.currentTarget.style.color = "var(--text-muted)";
                                }
                              }}
                            >
                              {copiedMessageId === m.id ? (
                                <>
                                  <ClipboardCheck size={11} color="#10b981" />
                                  <span style={{ color: "#10b981" }}>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={11} />
                                  <span>Copy Output</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const title = m.content.slice(0, 40).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "-") || "Answer";
                                const html = generateStandaloneExportHtml(m.content, title);
                                downloadHtmlFile(html, `${title}.html`);
                              }}
                              title="Export this specific answer as standalone HTML"
                              style={{
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

          {/* 🎙️ Voice Language Selector (Cantonese zh-HK, Mandarin zh-CN, English en-US) */}
          <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
            <select
              value={sttLang}
              onChange={(e) => {
                const val = e.target.value as "zh-HK" | "zh-CN" | "en-US";
                setSttLang(val);
                try {
                  localStorage.setItem("minibot_stt_lang", val);
                } catch {}
              }}
              title="Select Voice-to-Text Language"
              style={{
                height: 42,
                padding: "0 10px",
                borderRadius: 8,
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                color: "var(--text-main)",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="zh-HK">🇭🇰 粵語</option>
              <option value="zh-CN">🇨🇳 國語</option>
              <option value="en-US">🇺🇸 EN</option>
            </select>
          </div>

          <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
            <input
              ref={chatInputRef}
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask anything or query attached Excel / PDF / Word documents..."
              disabled={loading}
              style={{
                width: "100%",
                background: isListening ? "rgba(239, 68, 68, 0.05)" : "var(--bg-card)",
                border: isListening ? "1.5px solid #ef4444" : "1px solid var(--border-color)",
                borderRadius: 8,
                padding: "12px 42px 12px 16px",
                color: "var(--text-main)",
                fontSize: 14,
                outline: "none",
                transition: "border-color 0.2s, background-color 0.2s",
                boxSizing: "border-box",
              }}
            />
            {/* Quick Paste from Clipboard Action */}
            <button
              type="button"
              onClick={async () => {
                try {
                  const clipText = await navigator.clipboard.readText();
                  if (clipText) {
                    setInputPrompt((prev) => (prev ? prev + "\n" + clipText : clipText));
                    setTimeout(() => chatInputRef.current?.focus(), 50);
                  }
                } catch (err) {
                  console.warn("Clipboard paste failed or denied:", err);
                  // Focus input to let user press Ctrl+V
                  chatInputRef.current?.focus();
                }
              }}
              title="Paste from clipboard into input"
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                borderRadius: 6,
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--accent)";
                e.currentTarget.style.background = "var(--bg-secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <ClipboardPaste size={16} />
            </button>
            {sttStatusText && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  color: isListening ? "#ef4444" : "var(--accent)",
                  background: isListening ? "rgba(239, 68, 68, 0.12)" : "var(--bg-secondary)",
                  border: isListening ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid var(--border-color)",
                  borderRadius: 6,
                  padding: "4px 10px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "100%",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  zIndex: 10,
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {sttStatusText}
              </div>
            )}
          </div>

          {/* 🎙️ Voice-to-Text Microphone Trigger Button */}
          <button
            type="button"
            onClick={startVoiceRecognition}
            disabled={loading}
            title={isListening ? "Click to stop voice input (Listening...)" : "Voice Input (Click to speak)"}
            className={isListening ? "voice-recording-pulse" : ""}
            style={{
              padding: "0 14px",
              height: 44,
              borderRadius: 8,
              background: isListening ? "#ef4444" : "var(--bg-card)",
              color: isListening ? "#ffffff" : "var(--text-main)",
              border: isListening ? "1px solid #ef4444" : "1px solid var(--border-color)",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              transition: "all 0.2s ease",
              flexShrink: 0,
            }}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            <span style={{ display: "none" }}>Voice</span>
          </button>

          <button
            onClick={() => handleSend()}
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

          {/* ⬆️ Upper Arrow Button: Jump to top of last generated session/turn */}
          <button
            type="button"
            onClick={scrollToLastGeneratedTurn}
            title="Jump back to top of last generated session"
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              color: "var(--text-main)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent)";
              e.currentTarget.style.background = "var(--bg-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-color)";
              e.currentTarget.style.color = "var(--text-main)";
              e.currentTarget.style.background = "var(--bg-card)";
            }}
          >
            <ArrowUp size={18} />
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

                {/* 🎙️ MiniMax Voice API Key Configuration */}
                <div style={{ background: "rgba(16, 185, 129, 0.05)", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#10b981", display: "flex", alignItems: "center", gap: 5 }}>
                      <Volume2 size={13} color="#10b981" /> MiniMax Voice API Key (TTS Dedicated Key)
                    </label>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      Leave blank to use main LLM API Key
                    </span>
                  </div>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type={showVoiceApiKey ? "text" : "password"}
                      value={config.voice?.apiKey || ""}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          voice: {
                            baseUrl: config.voice?.baseUrl || "https://api.minimaxi.com/v1",
                            apiKey: e.target.value,
                            model: config.voice?.model || "speech-2.8-hd",
                            voiceId: config.voice?.voiceId || "Cantonese_CuteGirl",
                            speed: config.voice?.speed ?? 1.0,
                            enabled: config.voice?.enabled ?? true,
                          },
                        })
                      }
                      placeholder="Leave blank to inherit LLM API Key (e.g. sk-cp-...)"
                      style={{
                        width: "100%",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        padding: "8px 40px 8px 12px",
                        borderRadius: 6,
                        color: "var(--text-main)",
                        fontSize: 13,
                        fontFamily: showVoiceApiKey ? "ui-monospace, monospace" : "inherit",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowVoiceApiKey((prev) => !prev)}
                      title={showVoiceApiKey ? "Hide Voice API Key" : "Show Voice API Key"}
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
                      {showVoiceApiKey ? <EyeOff size={16} color="#10b981" /> : <Eye size={16} />}
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
