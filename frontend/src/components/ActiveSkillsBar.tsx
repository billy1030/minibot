import React, { useState } from "react";
import { Sparkles, ChevronDown, ChevronRight, BookOpen, X } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface SkillBadgeProps {
  skills: string[];
  workspace?: string;
  onOpenSkillHub?: (skillName?: string) => void;
}

export const ActiveSkillsBar: React.FC<SkillBadgeProps> = ({
  skills,
  workspace = "default",
  onOpenSkillHub,
}) => {
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [skillContent, setSkillContent] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  if (!skills || skills.length === 0) return null;

  const handleToggle = async (skillName: string) => {
    if (expandedSkill === skillName) {
      setExpandedSkill(null);
      setSkillContent(null);
      return;
    }

    setExpandedSkill(skillName);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/skills/content?name=${encodeURIComponent(skillName)}&workspace=${encodeURIComponent(workspace)}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (data.success && data.content) {
        setSkillContent(data.content);
      } else {
        setSkillContent("*No detailed content available for this skill.*");
      }
    } catch (err: any) {
      setSkillContent(`*Failed to load skill content: ${err.message}*`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        borderRadius: 8,
        border: "1px solid rgba(168, 85, 247, 0.28)",
        background: "rgba(168, 85, 247, 0.04)",
        overflow: "hidden",
        marginBottom: 10,
        transition: "all 0.15s ease",
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(168, 85, 247, 0.09)",
          borderBottom: expandedSkill ? "1px solid rgba(168, 85, 247, 0.2)" : "none",
          userSelect: "none",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11.5,
              fontWeight: 700,
              color: "#a855f7",
            }}
          >
            <Sparkles size={13} color="#a855f7" />
            <span>Active Skill{skills.length > 1 ? "s" : ""}:</span>
          </div>

          {skills.map((skill) => {
            const isSelected = expandedSkill === skill;
            return (
              <button
                key={skill}
                onClick={() => handleToggle(skill)}
                title="Click to preview injected skill guidelines"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px",
                  borderRadius: 6,
                  border: isSelected ? "1px solid #a855f7" : "1px solid rgba(168, 85, 247, 0.3)",
                  background: isSelected ? "rgba(168, 85, 247, 0.25)" : "rgba(168, 85, 247, 0.12)",
                  color: "#c084fc",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <BookOpen size={11} />
                <span>{skill}</span>
                {isSelected ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            );
          })}
        </div>

        {onOpenSkillHub && (
          <button
            onClick={() => onOpenSkillHub()}
            title="Open Agentic Tools & Skills Hub"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted, #94a3b8)",
              fontSize: 10.5,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              padding: "2px 6px",
              borderRadius: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#a855f7")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted, #94a3b8)")}
          >
            Manage Skills ↗
          </button>
        )}
      </div>

      {/* Expanded Skill Body */}
      {expandedSkill && (
        <div
          style={{
            padding: "10px 14px",
            background: "var(--bg-card, #f8fafc)",
            maxHeight: 280,
            overflowY: "auto",
            fontSize: 12.5,
            borderTop: "1px solid rgba(168, 85, 247, 0.12)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
              paddingBottom: 4,
              borderBottom: "1px dashed rgba(168, 85, 247, 0.2)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "#a855f7" }}>
              Injected Methodology Guidelines: <code>{expandedSkill}</code>
            </div>
            <button
              onClick={() => setExpandedSkill(null)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 2,
                color: "var(--text-muted)",
              }}
            >
              <X size={13} />
            </button>
          </div>

          {loading ? (
            <div style={{ color: "var(--text-muted)", fontStyle: "italic", padding: "6px 0" }}>
              Loading skill instructions...
            </div>
          ) : skillContent ? (
            <div style={{ color: "var(--text-main)", lineHeight: 1.6 }}>
              <MarkdownRenderer content={skillContent} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
