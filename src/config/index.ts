import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { LoopConfig, LoopConfigSchema } from "./schema.js";

dotenv.config();

export function getConfigFilePath(): string {
  const customPath = process.env.MINIBOT_CONFIG_PATH;
  if (customPath) return path.resolve(customPath);

  const primaryPath = path.resolve(process.cwd(), "minibot.config.json");
  const legacyPath = path.resolve(process.cwd(), "loop.config.json");

  // Prefer minibot.config.json, fall back to loop.config.json if existing
  if (!fs.existsSync(primaryPath) && fs.existsSync(legacyPath)) {
    return legacyPath;
  }
  return primaryPath;
}

export function loadConfig(configPath?: string): LoopConfig {
  const targetPath = configPath ? path.resolve(configPath) : getConfigFilePath();

  let fileContent: any = {};
  if (fs.existsSync(targetPath)) {
    try {
      const raw = fs.readFileSync(targetPath, "utf-8");
      fileContent = JSON.parse(raw);
    } catch (err) {
      console.warn(`[Config] Failed to parse ${targetPath}, falling back to defaults:`, err);
    }
  }

  // Base LLM setting: prioritize fileContent values (or active profile), fall back to process.env
  const baseLLM = {
    baseUrl: (fileContent.llm?.baseUrl && !fileContent.llm.baseUrl.startsWith("${")) ? fileContent.llm.baseUrl : (process.env.LLM_BASE_URL || "http://127.0.0.1:8045/v1"),
    apiKey: (fileContent.llm?.apiKey && !fileContent.llm.apiKey.startsWith("${")) ? fileContent.llm.apiKey : (process.env.LLM_API_KEY || ""),
    model: (fileContent.llm?.model && !fileContent.llm.model.startsWith("${")) ? fileContent.llm.model : (process.env.LLM_MODEL || "gemini-3.8-flash-low"),
    temperature: fileContent.llm?.temperature ?? 0.7,
    maxTokens: fileContent.llm?.maxTokens ?? 4096,
  };

  // Seed or parse models profiles list
  let modelsList = Array.isArray(fileContent.models) && fileContent.models.length > 0
    ? fileContent.models
    : [];

  let activeModelId: string | undefined = fileContent.activeModelId;

  // If no models catalog yet, seed with current baseLLM as the active model profile
  if (modelsList.length === 0) {
    const defaultProfile = {
      id: "current-default",
      name: baseLLM.model ? `Current (${baseLLM.model})` : "Default Model",
      provider: "custom",
      baseUrl: baseLLM.baseUrl,
      apiKey: baseLLM.apiKey,
      model: baseLLM.model,
      temperature: baseLLM.temperature,
      maxTokens: baseLLM.maxTokens,
      description: "Current configured LLM model",
    };

    modelsList = [defaultProfile];
    activeModelId = defaultProfile.id;
  }

  // If activeModelId is set and matches a profile, make sure baseLLM stays in sync
  if (activeModelId) {
    const activeProfile = modelsList.find((m: any) => m.id === activeModelId);
    if (activeProfile) {
      baseLLM.baseUrl = activeProfile.baseUrl || baseLLM.baseUrl;
      baseLLM.apiKey = activeProfile.apiKey || baseLLM.apiKey;
      baseLLM.model = activeProfile.model || baseLLM.model;
      baseLLM.temperature = activeProfile.temperature ?? baseLLM.temperature;
      baseLLM.maxTokens = activeProfile.maxTokens ?? baseLLM.maxTokens;
    }
  } else if (modelsList.length > 0) {
    activeModelId = modelsList[0].id;
  }

  // Merge with environment variables if available
  const merged = {
    llm: baseLLM,
    models: modelsList,
    activeModelId: activeModelId || (modelsList[0] ? modelsList[0].id : "current-default"),
    voice: {
      baseUrl: process.env.VOICE_BASE_URL || fileContent.voice?.baseUrl || "https://api.minimaxi.com/v1",
      apiKey: process.env.VOICE_API_KEY || (fileContent.voice?.apiKey && !fileContent.voice.apiKey.startsWith("${") ? fileContent.voice.apiKey : ""),
      model: process.env.VOICE_MODEL || fileContent.voice?.model || "speech-2.8-hd",
      voiceId: fileContent.voice?.voiceId || "Cantonese_CuteGirl",
      speed: fileContent.voice?.speed ?? 1.0,
      enabled: fileContent.voice?.enabled ?? true,
    },
    prompts: {
      systemPrompt: process.env.SYSTEM_PROMPT || fileContent.prompts?.systemPrompt,
      skillsPrompt: process.env.SKILLS_PROMPT || fileContent.prompts?.skillsPrompt,
      svgPrompt: process.env.SVG_PROMPT || fileContent.prompts?.svgPrompt,
    },
    mcpServers: fileContent.mcpServers || {},
    maxLoopIterations: fileContent.maxLoopIterations ?? 50,
  };

  return LoopConfigSchema.parse(merged);
}

/**
 * Persists the configuration safely back to disk (minibot.config.json)
 */
export function saveConfigToDisk(updatedConfig: Partial<LoopConfig>, configPath?: string): void {
  const targetPath = configPath ? path.resolve(configPath) : getConfigFilePath();

  let existing: any = {};
  if (fs.existsSync(targetPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(targetPath, "utf-8"));
    } catch {
      existing = {};
    }
  }

  // If models updated, sanitize API keys if they were masked
  let sanitizedModels = updatedConfig.models ?? existing.models;
  if (Array.isArray(sanitizedModels)) {
    const existingModelsMap = new Map<string, any>(
      Array.isArray(existing.models) ? existing.models.map((m: any) => [m.id, m]) : []
    );

    sanitizedModels = sanitizedModels.map((m: any) => {
      const old = existingModelsMap.get(m.id);
      const isMasked = m.apiKey?.includes("...****") || m.apiKey === "****";
      return {
        ...m,
        apiKey: isMasked ? (old?.apiKey || "") : (m.apiKey ?? ""),
      };
    });
  }

  const toSave = {
    llm: {
      baseUrl: updatedConfig.llm?.baseUrl ?? existing.llm?.baseUrl ?? "https://api.minimaxi.com/v1",
      apiKey: updatedConfig.llm?.apiKey ?? existing.llm?.apiKey ?? "${LLM_API_KEY}",
      model: updatedConfig.llm?.model ?? existing.llm?.model ?? "MiniMax-M3",
      temperature: updatedConfig.llm?.temperature ?? existing.llm?.temperature ?? 0.7,
      maxTokens: updatedConfig.llm?.maxTokens ?? existing.llm?.maxTokens ?? 4096,
    },
    models: sanitizedModels ?? [],
    activeModelId: updatedConfig.activeModelId ?? existing.activeModelId,
    voice: {
      baseUrl: updatedConfig.voice?.baseUrl ?? existing.voice?.baseUrl ?? "https://api.minimaxi.com/v1",
      apiKey: updatedConfig.voice?.apiKey ?? existing.voice?.apiKey ?? "",
      model: updatedConfig.voice?.model ?? existing.voice?.model ?? "speech-2.8-hd",
      voiceId: updatedConfig.voice?.voiceId ?? existing.voice?.voiceId ?? "Cantonese_CuteGirl",
      speed: updatedConfig.voice?.speed ?? existing.voice?.speed ?? 1.0,
      enabled: updatedConfig.voice?.enabled ?? existing.voice?.enabled ?? true,
    },
    prompts: {
      systemPrompt: updatedConfig.prompts?.systemPrompt ?? existing.prompts?.systemPrompt,
      skillsPrompt: updatedConfig.prompts?.skillsPrompt ?? existing.prompts?.skillsPrompt,
      svgPrompt: updatedConfig.prompts?.svgPrompt ?? existing.prompts?.svgPrompt,
    },
    mcpServers: updatedConfig.mcpServers ?? existing.mcpServers ?? {},
    maxLoopIterations: updatedConfig.maxLoopIterations ?? existing.maxLoopIterations ?? 50,
  };

  fs.writeFileSync(targetPath, JSON.stringify(toSave, null, 2), "utf-8");
}
