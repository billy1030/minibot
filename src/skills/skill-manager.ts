import fs from "node:fs";
import path from "node:path";
import { getWorkspaceDir } from "../logger/conversation-logger.js";

export interface SkillMetadata {
  name: string;
  description: string;
  scope: "global" | "user" | "workspace";
  workspace?: string;
  dirPath: string;
  filePath: string;
  triggers?: string[];
  content?: string;
  disabled?: boolean;
}

/**
 * Parses frontmatter from a SKILL.md document.
 */
export function parseSkillMarkdown(content: string, fallbackName: string): { name: string; description: string; triggers: string[]; body: string } {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  
  let name = fallbackName;
  let description = "";
  const triggers: string[] = [];
  let body = content;

  if (frontmatterMatch) {
    const rawYaml = frontmatterMatch[1];
    body = frontmatterMatch[2].trim();

    const nameMatch = rawYaml.match(/^name:\s*(.+)$/m);
    if (nameMatch) name = nameMatch[1].trim().replace(/^["']|["']$/g, "");

    const descMatch = rawYaml.match(/^description:\s*([^\r\n]+(?:\r?\n(?:\s{2,}|\t)[^\r\n]+)*)/m);
    if (descMatch) {
      description = descMatch[1].replace(/\r?\n\s+/g, " ").trim().replace(/^["']|["']$/g, "");
    }

    const triggersMatch = rawYaml.match(/^triggers:\s*\[(.*?)\]/m);
    if (triggersMatch) {
      const items = triggersMatch[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
      triggers.push(...items.filter(Boolean));
    } else {
      // Support multi-line YAML list format (e.g. triggers:\n  - item1\n  - item2)
      const multiLineTriggersMatch = rawYaml.match(/^triggers:\s*\r?\n((?:\s*-[^\r\n]+\r?\n?)+)/m);
      if (multiLineTriggersMatch) {
        const lines = multiLineTriggersMatch[1].split(/\r?\n/);
        for (const line of lines) {
          const itemMatch = line.match(/^\s*-\s*(.+)$/);
          if (itemMatch) {
            const val = itemMatch[1].trim().replace(/^["']|["']$/g, "");
            if (val) triggers.push(val);
          }
        }
      }
    }
  } else {
    // If no frontmatter, extract first heading or first paragraph
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) name = h1Match[1].trim();
    const firstPara = content.replace(/^#+.*$/gm, "").trim().split(/\r?\n\r?\n/)[0];
    if (firstPara) description = firstPara.slice(0, 200).trim();
  }

  return { name, description, triggers, body };
}

export class SkillManager {
  private globalDirs: string[];

  constructor() {
    this.globalDirs = [
      path.resolve(process.cwd(), ".minibot/skills"),
      path.resolve(process.cwd(), ".agents/skills"),
    ];

    // Ensure primary global folder exists
    const primaryGlobal = this.globalDirs[0];
    if (!fs.existsSync(primaryGlobal)) {
      try {
        fs.mkdirSync(primaryGlobal, { recursive: true });
      } catch {}
    }
  }

  /**
   * Scans a specific folder for skills containing SKILL.md
   */
  private scanDirectoryForSkills(
    dir: string,
    scope: "global" | "user" | "workspace",
    workspaceName?: string
  ): SkillMetadata[] {
    if (!fs.existsSync(dir)) return [];
    const skills: SkillMetadata[] = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillDir = path.join(dir, entry.name);
          const skillMdPath = path.join(skillDir, "SKILL.md");
          if (fs.existsSync(skillMdPath)) {
            try {
              const raw = fs.readFileSync(skillMdPath, "utf-8");
              const { name, description, triggers } = parseSkillMarkdown(raw, entry.name);
              skills.push({
                name: name || entry.name,
                description,
                scope,
                workspace: workspaceName,
                dirPath: skillDir,
                filePath: skillMdPath,
                triggers,
              });
            } catch (e) {
              console.warn(`[SkillManager] Error reading skill at ${skillMdPath}:`, e);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[SkillManager] Error scanning directory ${dir}:`, err);
    }

    return skills;
  }

  /**
   * Path to user-level skills directory (shared across workspaces for this user)
   */
  public getUserSkillsDir(userNumber: string = "00000"): string {
    const safeNumber = String(userNumber).padStart(5, "0").replace(/[^\d]/g, "").slice(0, 5) || "00000";
    return path.resolve(process.cwd(), "logs", safeNumber, ".skills");
  }

  /**
   * Path to disabled skills configuration for this workspace
   */
  public getDisabledSkillsPath(workspace: string = "default", userNumber: string = "00000"): string {
    const wsDir = getWorkspaceDir(workspace, "logs", userNumber);
    return path.join(wsDir, ".skills", "disabled.json");
  }

  /**
   * Read the list of disabled skill names for this workspace
   */
  public getDisabledSkills(workspace: string = "default", userNumber: string = "00000"): string[] {
    try {
      const p = this.getDisabledSkillsPath(workspace, userNumber);
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) return list.map((s) => String(s).toLowerCase());
      }
    } catch {}
    return [];
  }

  /**
   * Toggle a skill between enabled and disabled
   */
  public toggleSkill(skillName: string, enabled: boolean, workspace: string = "default", userNumber: string = "00000"): { success: boolean; disabled: boolean } {
    try {
      const cleanName = skillName.trim().toLowerCase();
      const p = this.getDisabledSkillsPath(workspace, userNumber);
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      let current = this.getDisabledSkills(workspace, userNumber);
      if (enabled) {
        current = current.filter((s) => s !== cleanName);
      } else {
        if (!current.includes(cleanName)) {
          current.push(cleanName);
        }
      }

      fs.writeFileSync(p, JSON.stringify(current, null, 2), "utf-8");
      return { success: true, disabled: !enabled };
    } catch (err: any) {
      return { success: false, disabled: !enabled };
    }
  }

  /**
   * List all skills available in the current context (Global + User + Workspace)
   * Workspace skills override User skills, which override Global skills.
   */
  public listAvailableSkills(workspace: string = "default", userNumber: string = "00000"): SkillMetadata[] {
    const skillMap = new Map<string, SkillMetadata>();
    const disabledList = this.getDisabledSkills(workspace, userNumber);

    // 1. Scan Global Skills
    for (const globalDir of this.globalDirs) {
      const globalSkills = this.scanDirectoryForSkills(globalDir, "global");
      for (const skill of globalSkills) {
        const isDis = disabledList.includes(skill.name.toLowerCase());
        skillMap.set(skill.name.toLowerCase(), { ...skill, disabled: isDis });
      }
    }

    // 2. Scan User Skills (Overrides global)
    try {
      const userSkillsDir = this.getUserSkillsDir(userNumber);
      if (fs.existsSync(userSkillsDir)) {
        const userSkills = this.scanDirectoryForSkills(userSkillsDir, "user");
        for (const skill of userSkills) {
          const isDis = disabledList.includes(skill.name.toLowerCase());
          skillMap.set(skill.name.toLowerCase(), { ...skill, disabled: isDis });
        }
      }
    } catch {}

    // 3. Scan Workspace Skills (Overrides global & user if same name)
    try {
      const wsDir = getWorkspaceDir(workspace, "logs", userNumber);
      const wsSkillsDir = path.join(wsDir, ".skills");
      if (fs.existsSync(wsSkillsDir)) {
        const wsSkills = this.scanDirectoryForSkills(wsSkillsDir, "workspace", workspace);
        for (const skill of wsSkills) {
          const isDis = disabledList.includes(skill.name.toLowerCase());
          skillMap.set(skill.name.toLowerCase(), { ...skill, disabled: isDis });
        }
      }
    } catch {}

    return Array.from(skillMap.values());
  }

  /**
   * Get the full text content of a skill
   */
  public getSkillContent(skillName: string, workspace: string = "default", userNumber: string = "00000"): string | null {
    const available = this.listAvailableSkills(workspace, userNumber);
    const target = available.find((s) => s.name.toLowerCase() === skillName.toLowerCase());
    if (!target) return null;

    try {
      return fs.readFileSync(target.filePath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Saves or creates a skill in Global, User, or Workspace scope
   */
  public saveSkill(
    skillName: string,
    content: string,
    scope: "global" | "user" | "workspace" = "workspace",
    workspace: string = "default",
    userNumber: string = "00000"
  ): { success: boolean; filePath?: string; error?: string } {
    try {
      const cleanName = skillName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
      if (!cleanName) return { success: false, error: "Invalid skill name" };

      let targetDir: string;
      if (scope === "workspace") {
        const wsDir = getWorkspaceDir(workspace, "logs", userNumber);
        targetDir = path.join(wsDir, ".skills", cleanName);
      } else if (scope === "user") {
        targetDir = path.join(this.getUserSkillsDir(userNumber), cleanName);
      } else {
        targetDir = path.join(this.globalDirs[0], cleanName);
      }

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filePath = path.join(targetDir, "SKILL.md");
      fs.writeFileSync(filePath, content.trim() + "\n", "utf-8");

      return { success: true, filePath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Move or switch an existing skill's scope between global, user, and workspace
   */
  public moveSkillScope(
    skillName: string,
    targetScope: "global" | "user" | "workspace",
    workspace: string = "default",
    userNumber: string = "00000"
  ): { success: boolean; oldScope?: string; newScope?: string; filePath?: string; error?: string } {
    try {
      const cleanName = skillName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
      if (!cleanName) return { success: false, error: "Invalid skill name" };

      const available = this.listAvailableSkills(workspace, userNumber);
      const existing = available.find((s) => s.name.toLowerCase() === cleanName || s.name.toLowerCase() === skillName.toLowerCase());
      if (!existing) {
        return { success: false, error: `Skill "${skillName}" not found.` };
      }

      if (existing.scope === targetScope) {
        return { success: true, oldScope: existing.scope, newScope: targetScope, filePath: existing.filePath };
      }

      // Read content from current location
      const content = fs.readFileSync(existing.filePath, "utf-8");

      // Save to new scope target
      const saveRes = this.saveSkill(cleanName, content, targetScope, workspace, userNumber);
      if (!saveRes.success) {
        return { success: false, error: saveRes.error };
      }

      // Remove from old directory
      try {
        if (fs.existsSync(existing.dirPath)) {
          fs.rmSync(existing.dirPath, { recursive: true, force: true });
        }
      } catch (rmErr) {
        console.warn(`[SkillManager] Notice: Could not remove old skill directory at ${existing.dirPath}:`, rmErr);
      }

      return {
        success: true,
        oldScope: existing.scope,
        newScope: targetScope,
        filePath: saveRes.filePath,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Delete a skill by name from workspace, user, or global scope
   */
  public deleteSkill(
    skillName: string,
    workspace: string = "default",
    userNumber: string = "00000"
  ): { success: boolean; error?: string } {
    try {
      const cleanName = skillName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
      if (!cleanName) return { success: false, error: "Invalid skill name" };

      // 1. Try workspace first
      const wsDir = getWorkspaceDir(workspace, "logs", userNumber);
      const wsSkillDir = path.join(wsDir, ".skills", cleanName);
      if (fs.existsSync(wsSkillDir)) {
        fs.rmSync(wsSkillDir, { recursive: true, force: true });
        return { success: true };
      }

      // 2. Try user scope
      const userSkillDir = path.join(this.getUserSkillsDir(userNumber), cleanName);
      if (fs.existsSync(userSkillDir)) {
        fs.rmSync(userSkillDir, { recursive: true, force: true });
        return { success: true };
      }

      // 3. Try global
      for (const globalDir of this.globalDirs) {
        const globalSkillDir = path.join(globalDir, cleanName);
        if (fs.existsSync(globalSkillDir)) {
          fs.rmSync(globalSkillDir, { recursive: true, force: true });
          return { success: true };
        }
      }

      return { success: false, error: `Skill "${skillName}" not found.` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Selects relevant skills based on user prompt and injects full instructions,
   * while injecting summaries for non-matching skills to save token context.
   */
  public resolveSkillPromptSection(
    userPrompt: string,
    workspace: string = "default",
    userNumber: string = "00000"
  ): { promptSection: string; activeSkillNames: string[] } {
    const allSkills = this.listAvailableSkills(workspace, userNumber);
    if (allSkills.length === 0) return { promptSection: "", activeSkillNames: [] };

    const lowerPrompt = userPrompt.toLowerCase();
    const activeInjections: string[] = [];
    const passiveSummaries: string[] = [];
    const activeSkillNames: string[] = [];

    for (const skill of allSkills) {
      // If skill is disabled, skip it entirely
      if (skill.disabled) continue;

      // Check if prompt matches skill name, triggers, or key terms
      const matchesName = lowerPrompt.includes(skill.name.toLowerCase());
      const matchesTrigger = skill.triggers?.some((t) => lowerPrompt.includes(t.toLowerCase()));
      
      const shouldInjectFull = matchesName || matchesTrigger;

      if (shouldInjectFull) {
        try {
          const raw = fs.readFileSync(skill.filePath, "utf-8");
          const { body } = parseSkillMarkdown(raw, skill.name);
          activeInjections.push(
            `### Active Skill: ${skill.name} [Scope: ${skill.scope.toUpperCase()}]\n${body}`
          );
          activeSkillNames.push(skill.name);
        } catch {}
      } else {
        passiveSummaries.push(
          `- \`${skill.name}\` [${skill.scope}]: ${skill.description || "No description provided."}`
        );
      }
    }

    const sections: string[] = [];

    if (activeInjections.length > 0) {
      sections.push("## Dynamically Activated Skill Guidelines:\n" + activeInjections.join("\n\n"));
    }

    if (passiveSummaries.length > 0) {
      sections.push(
        "## Additional Available Skills (You can reference or adopt these workflows as needed):\n" +
          passiveSummaries.join("\n")
      );
    }

    return {
      promptSection: sections.join("\n\n"),
      activeSkillNames,
    };
  }
}

export const globalSkillManager = new SkillManager();
