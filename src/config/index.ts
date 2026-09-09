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

  // Merge with environment variables if available
  const merged = {
    llm: {
      baseUrl: process.env.LLM_BASE_URL || (fileContent.llm?.baseUrl && !fileContent.llm.baseUrl.startsWith("${") ? fileContent.llm.baseUrl : "https://api.minimaxi.com/v1"),
      apiKey: process.env.LLM_API_KEY || (fileContent.llm?.apiKey && !fileContent.llm.apiKey.startsWith("${") ? fileContent.llm.apiKey : ""),
      model: process.env.LLM_MODEL || fileContent.llm?.model || "MiniMax-M3",
      temperature: fileContent.llm?.temperature ?? 0.7,
      maxTokens: fileContent.llm?.maxTokens ?? 4096,
    },
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
    },
    mcpServers: fileContent.mcpServers || {},
    maxLoopIterations: fileContent.maxLoopIterations ?? 10,
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

  const toSave = {
    llm: {
      baseUrl: updatedConfig.llm?.baseUrl ?? existing.llm?.baseUrl ?? "https://api.minimaxi.com/v1",
      apiKey: updatedConfig.llm?.apiKey ?? existing.llm?.apiKey ?? "${LLM_API_KEY}",
      model: updatedConfig.llm?.model ?? existing.llm?.model ?? "MiniMax-M3",
      temperature: updatedConfig.llm?.temperature ?? existing.llm?.temperature ?? 0.7,
      maxTokens: updatedConfig.llm?.maxTokens ?? existing.llm?.maxTokens ?? 4096,
    },
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
    },
    mcpServers: updatedConfig.mcpServers ?? existing.mcpServers ?? {},
    maxLoopIterations: updatedConfig.maxLoopIterations ?? existing.maxLoopIterations ?? 10,
  };

  fs.writeFileSync(targetPath, JSON.stringify(toSave, null, 2), "utf-8");
}
