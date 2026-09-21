import React, { useState } from "react";
import {
  Cpu,
  Check,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  EyeOff,
} from "lucide-react";

export interface LLMProfile {
  id: string;
  name: string;
  provider?: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens?: number;
  description?: string;
}

interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: LLMProfile[];
  activeModelId?: string;
  onSelectActiveModel: (modelId: string) => Promise<void>;
  onSaveProfiles: (models: LLMProfile[], activeModelId?: string) => Promise<void>;
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
  isOpen,
  onClose,
  models,
  activeModelId,
  onSelectActiveModel,
  onSaveProfiles,
}) => {
  const [localProfiles, setLocalProfiles] = useState<LLMProfile[]>(models || []);
  const [currentActiveId, setCurrentActiveId] = useState<string>(activeModelId || (models[0]?.id || ""));
  const [editingProfile, setEditingProfile] = useState<LLMProfile | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>("");

  React.useEffect(() => {
    if (models && models.length > 0) {
      setLocalProfiles(models);
      if (activeModelId) setCurrentActiveId(activeModelId);
    }
  }, [models, activeModelId, isOpen]);

  if (!isOpen) return null;

  const handleSelectModel = async (id: string) => {
    setCurrentActiveId(id);
    await onSelectActiveModel(id);
  };

  const handleStartEdit = (profile: LLMProfile) => {
    setEditingProfile({ ...profile });
    setIsCreatingNew(false);
    setShowKey(false);
    setTestResult(null);
  };

  const handleStartCreate = () => {
    // Clear search filter so newly created model will be visible immediately
    setSearchFilter("");
    const newId = "model-" + Date.now();
    // Default to the current active profile's baseUrl / settings for convenience, or blank
    const baseRef = localProfiles.find((p) => p.id === currentActiveId) || localProfiles[0];

    setEditingProfile({
      id: newId,
      name: "",
      baseUrl: baseRef?.baseUrl || "http://127.0.0.1:8045/v1",
      apiKey: baseRef?.apiKey || "",
      model: "",
      temperature: baseRef?.temperature ?? 0.7,
      maxTokens: baseRef?.maxTokens ?? 4096,
      description: "",
      provider: "custom",
    });
    setIsCreatingNew(true);
    setShowKey(false);
    setTestResult(null);
  };

  const handleSaveCurrentEdit = async () => {
    if (!editingProfile) return;

    const trimmedName = editingProfile.name.trim();
    const trimmedModel = editingProfile.model.trim();
    const trimmedBaseUrl = editingProfile.baseUrl.trim();

    if (!trimmedName || !trimmedModel) {
      alert("Please provide at least a Profile Name and Model Name.");
      return;
    }

    if (!trimmedBaseUrl) {
      alert("Please provide the API Base URL.");
      return;
    }

    const cleanedProfile: LLMProfile = {
      ...editingProfile,
      name: trimmedName,
      model: trimmedModel,
      baseUrl: trimmedBaseUrl,
      provider: "custom",
    };

    let updated: LLMProfile[];
    let nextActiveId = currentActiveId;

    if (isCreatingNew) {
      updated = [...localProfiles, cleanedProfile];
      // Automatically switch to the newly created profile as active
      nextActiveId = cleanedProfile.id;
      setCurrentActiveId(nextActiveId);
    } else {
      updated = localProfiles.map((p) => (p.id === cleanedProfile.id ? cleanedProfile : p));
    }

    // Reset search filter so the newly saved profile is not hidden
    setSearchFilter("");
    setLocalProfiles(updated);
    setEditingProfile(null);
    setIsCreatingNew(false);
    setTestResult(null);

    await onSaveProfiles(updated, nextActiveId);
  };

  const handleDeleteProfile = async (id: string) => {
    if (localProfiles.length <= 1) {
      alert("You must keep at least one model configured.");
      return;
    }
    if (!confirm("Are you sure you want to delete this model configuration?")) return;

    const updated = localProfiles.filter((p) => p.id !== id);
    let nextActiveId = currentActiveId;
    if (currentActiveId === id) {
      nextActiveId = updated[0]?.id || "";
      setCurrentActiveId(nextActiveId);
    }
    setLocalProfiles(updated);
    if (editingProfile?.id === id) {
      setEditingProfile(null);
    }
    await onSaveProfiles(updated, nextActiveId);
  };

  const handleTestConnection = async (profile: LLMProfile) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/llm/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(profile),
      });

      const contentType = res.headers.get("content-type") || "";
      let data: any = {};
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        const snippet = text.replace(/<[^>]*>?/gm, "").trim().slice(0, 120);
        data = {
          success: false,
          error: `Server returned non-JSON response (${res.status}): ${snippet || "HTML page received"}`,
        };
      }

      if (res.ok && data.success) {
        setTestResult({
          id: profile.id,
          success: true,
          message: `Connected successfully to ${data.model || profile.model}! (${data.message || "OK"})`,
        });
      } else {
        setTestResult({
          id: profile.id,
          success: false,
          message: data.error || `Connection test failed with HTTP ${res.status}`,
        });
      }
    } catch (err: any) {
      setTestResult({
        id: profile.id,
        success: false,
        message: err.message || "Network error",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const filteredProfiles = localProfiles.filter((p) => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.model.toLowerCase().includes(q) ||
      p.baseUrl.toLowerCase().includes(q)
    );
  });

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2500,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--bg-secondary, #1e293b)",
          border: "1px solid var(--border-color, #334155)",
          borderRadius: 14,
          width: "min(960px, 95vw)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-card)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: "linear-gradient(135deg, #0284c7, #3b82f6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
              }}
            >
              <Cpu size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text-main)" }}>
                LLM Models Configuration
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                Manage custom AI model endpoints, test connectivity, and switch the active model.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ display: "grid", gridTemplateColumns: editingProfile ? "1fr 1.15fr" : "1fr", flex: 1, overflow: "hidden" }}>
          
          {/* Left Column: Models List */}
          <div
            style={{
              padding: "16px 20px",
              borderRight: editingProfile ? "1px solid var(--border-color)" : "none",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Toolbar: Search + Add Model Button */}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search models by name, ID or URL..."
                style={{
                  flex: 1,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  padding: "7px 12px",
                  fontSize: 12.5,
                  color: "var(--text-main)",
                  outline: "none",
                }}
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter("")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: 12,
                    padding: "4px 6px",
                  }}
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={handleStartCreate}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  borderRadius: 6,
                  background: "linear-gradient(135deg, var(--accent, #0284c7), #0369a1)",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                }}
              >
                <Plus size={14} /> Add Model
              </button>
            </div>

            {/* Model Profile Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {filteredProfiles.length === 0 ? (
                <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  No models found matching your search. Click <strong>"+ Add Model"</strong> to add one.
                </div>
              ) : (
                filteredProfiles.map((p) => {
                  const isActive = p.id === currentActiveId;
                  const isSelectedForEdit = editingProfile?.id === p.id;

                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 8,
                        background: isActive
                          ? "rgba(2, 132, 199, 0.08)"
                          : isSelectedForEdit
                          ? "var(--bg-card)"
                          : "var(--bg-primary)",
                        border: isActive
                          ? "1.5px solid var(--accent, #0284c7)"
                          : isSelectedForEdit
                          ? "1px solid var(--text-muted)"
                          : "1px solid var(--border-color)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        transition: "all 0.15s ease",
                        cursor: "pointer",
                      }}
                      onClick={() => handleSelectModel(p.id)}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 6,
                              background: isActive ? "var(--accent, #0284c7)" : "var(--bg-secondary)",
                              color: isActive ? "#ffffff" : "var(--text-muted)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {isActive ? <Check size={14} /> : <Cpu size={13} />}
                          </div>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-main)" }}>
                            {p.name}
                          </span>
                          {isActive && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: "rgba(2, 132, 199, 0.2)",
                                color: "var(--accent, #0284c7)",
                              }}
                            >
                              ACTIVE
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleTestConnection(p)}
                            disabled={isTesting}
                            title="Test Connection"
                            style={{
                              background: "transparent",
                              border: "1px solid var(--border-color)",
                              borderRadius: 4,
                              padding: "3px 7px",
                              fontSize: 11,
                              fontWeight: 600,
                              color: "var(--text-muted)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <RefreshCw size={11} className={isTesting ? "animate-spin" : ""} /> Test
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(p)}
                            title="Edit Profile"
                            style={{
                              background: "transparent",
                              border: "none",
                              padding: "4px",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                              borderRadius: 4,
                            }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProfile(p.id)}
                            title="Delete Profile"
                            style={{
                              background: "transparent",
                              border: "none",
                              padding: "4px",
                              color: "#ef4444",
                              cursor: "pointer",
                              borderRadius: 4,
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11.5, color: "var(--text-muted)", flexWrap: "wrap" }}>
                        <span>Model: <code style={{ color: "var(--accent, #0284c7)" }}>{p.model}</code></span>
                        <span>•</span>
                        <span>URL: <code style={{ color: "var(--text-muted)" }}>{p.baseUrl}</code></span>
                      </div>

                      {testResult && testResult.id === p.id && (
                        <div
                          style={{
                            marginTop: 4,
                            padding: "6px 10px",
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 600,
                            background: testResult.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                            color: testResult.success ? "#10b981" : "#ef4444",
                            border: `1px solid ${testResult.success ? "#10b98140" : "#ef444440"}`,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            wordBreak: "break-all",
                          }}
                        >
                          {testResult.success ? <CheckCircle2 size={13} style={{ flexShrink: 0 }} /> : <AlertCircle size={13} style={{ flexShrink: 0 }} />}
                          <span>{testResult.message}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Model Profile Editor */}
          {editingProfile && (
            <div
              style={{
                padding: "20px 24px",
                background: "var(--bg-card)",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: 10 }}>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6 }}>
                  {isCreatingNew ? <Plus size={16} color="var(--accent, #0284c7)" /> : <Edit2 size={15} />}
                  <span>{isCreatingNew ? "Add New Model" : "Edit Model Configuration"}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Profile Display Name */}
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Profile Display Name *
                </label>
                <input
                  type="text"
                  value={editingProfile.name}
                  onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                  placeholder="e.g. Gemini 3.8 Flash or Custom GPT-4o"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-main)",
                    fontSize: 13,
                  }}
                />
              </div>

              {/* API Base URL */}
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  API Base URL *
                </label>
                <input
                  type="text"
                  value={editingProfile.baseUrl}
                  onChange={(e) => setEditingProfile({ ...editingProfile, baseUrl: e.target.value })}
                  placeholder="http://127.0.0.1:8045/v1 or https://api.openai.com/v1"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-main)",
                    fontSize: 13,
                    fontFamily: "ui-monospace, monospace",
                  }}
                />
              </div>

              {/* Model Identifier */}
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Model Name / Identifier *
                </label>
                <input
                  type="text"
                  value={editingProfile.model}
                  onChange={(e) => setEditingProfile({ ...editingProfile, model: e.target.value })}
                  placeholder="e.g. gemini-3.8-flash-low or gpt-4o"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-main)",
                    fontSize: 13,
                    fontFamily: "ui-monospace, monospace",
                  }}
                />
              </div>

              {/* API Key */}
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  API Key (Optional / if required)
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    type={showKey ? "text" : "password"}
                    value={editingProfile.apiKey || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, apiKey: e.target.value })}
                    placeholder="API key or token..."
                    style={{
                      width: "100%",
                      padding: "8px 36px 8px 10px",
                      borderRadius: 6,
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-main)",
                      fontSize: 13,
                      fontFamily: showKey ? "ui-monospace, monospace" : "inherit",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    style={{
                      position: "absolute",
                      right: 8,
                      background: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: 4,
                    }}
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Temperature & Max Tokens */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    Temperature ({editingProfile.temperature})
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={2}
                    value={editingProfile.temperature}
                    onChange={(e) => setEditingProfile({ ...editingProfile, temperature: parseFloat(e.target.value) || 0 })}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-main)",
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    step="512"
                    min={512}
                    max={131072}
                    value={editingProfile.maxTokens ?? 4096}
                    onChange={(e) => setEditingProfile({ ...editingProfile, maxTokens: parseInt(e.target.value, 10) || 4096 })}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-main)",
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              {/* Test in Editor Action */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 6 }}>
                <button
                  type="button"
                  onClick={() => handleTestConnection(editingProfile)}
                  disabled={isTesting}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 6,
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-main)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <RefreshCw size={12} className={isTesting ? "animate-spin" : ""} />
                  Test Connection
                </button>

                {/* Save / Cancel Action */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setEditingProfile(null)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 6,
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-main)",
                      fontSize: 12.5,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCurrentEdit}
                    style={{
                      padding: "7px 18px",
                      borderRadius: 6,
                      background: "linear-gradient(135deg, var(--accent, #0284c7), #0369a1)",
                      border: "none",
                      color: "#ffffff",
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Save Profile
                  </button>
                </div>
              </div>

              {testResult && testResult.id === editingProfile.id && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    background: testResult.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                    color: testResult.success ? "#10b981" : "#ef4444",
                    border: `1px solid ${testResult.success ? "#10b98140" : "#ef444440"}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    wordBreak: "break-all",
                  }}
                >
                  {testResult.success ? <CheckCircle2 size={14} style={{ flexShrink: 0 }} /> : <AlertCircle size={14} style={{ flexShrink: 0 }} />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid var(--border-color)",
            background: "var(--bg-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Selected Active Model: <strong>{localProfiles.find((p) => p.id === currentActiveId)?.name || "None"}</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 20px",
              borderRadius: 6,
              background: "linear-gradient(135deg, var(--accent, #0284c7), #0369a1)",
              border: "none",
              color: "#ffffff",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
