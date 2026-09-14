import fs from "node:fs";
import path from "node:path";
import { getWorkspaceDir } from "../logger/conversation-logger.js";

export interface SkillMetadata {
  name: string;
  description: string;
  scope: "global" | "workspace";
  workspace?: string;
  dirPath: string;
  filePath: string;
  triggers?: string[];
  content?: string;
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
    scope: "global" | "workspace",
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
   * List all skills available in the current context (Global + Workspace)
   * Workspace skills override global skills with the same name.
   */
  public listAvailableSkills(workspace: string = "default", userNumber: string = "00000"): SkillMetadata[] {
    const skillMap = new Map<string, SkillMetadata>();

    // 1. Scan Global Skills
    for (const globalDir of this.globalDirs) {
      const globalSkills = this.scanDirectoryForSkills(globalDir, "global");
      for (const skill of globalSkills) {
        skillMap.set(skill.name.toLowerCase(), skill);
      }
    }

    // 2. Scan Workspace Skills (Overrides global if same name)
    try {
      const wsDir = getWorkspaceDir(workspace, "logs", userNumber);
      const wsSkillsDir = path.join(wsDir, ".skills");
      if (fs.existsSync(wsSkillsDir)) {
        const wsSkills = this.scanDirectoryForSkills(wsSkillsDir, "workspace", workspace);
        for (const skill of wsSkills) {
          skillMap.set(skill.name.toLowerCase(), skill);
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
   * Saves or creates a skill in either Global or Workspace scope
   */
  public saveSkill(
    skillName: string,
    content: string,
    scope: "global" | "workspace" = "global",
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
   * Delete a skill by name from either workspace or global scope
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

      // 2. Try global
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
  ): string {
    const allSkills = this.listAvailableSkills(workspace, userNumber);
    if (allSkills.length === 0) return "";

    const lowerPrompt = userPrompt.toLowerCase();
    const activeInjections: string[] = [];
    const passiveSummaries: string[] = [];

    for (const skill of allSkills) {
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

    return sections.join("\n\n");
  }
}

export const globalSkillManager = new SkillManager();
