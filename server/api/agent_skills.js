import fs from "node:fs/promises";
import path from "node:path";

import { parseMarkdownDocument } from "../../app/L0/_all/mod/_core/framework/js/markdown-frontmatter.js";

const SKILLS_ROOT = path.join(
  import.meta.dirname,
  "../../app/L0/_all/mod/_core/skillset/ext/skills"
);

async function discoverSkills() {
  const skills = [];

  try {
    const entries = await fs.readdir(SKILLS_ROOT, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const skillPath = path.join(SKILLS_ROOT, entry.name, "SKILL.md");

      try {
        const raw = await fs.readFile(skillPath, "utf8");
        const { frontmatter } = parseMarkdownDocument(raw);

        if (frontmatter?.metadata?.when === false) {
          continue;
        }

        skills.push({
          id: entry.name,
          name: frontmatter?.name || entry.name,
          description: frontmatter?.description || "",
          autoLoaded: Boolean(frontmatter?.metadata?.loaded),
          placement: frontmatter?.metadata?.placement || "history"
        });
      } catch {
        continue;
      }
    }
  } catch {
    return [];
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export async function get(context) {
  const skills = await discoverSkills();

  return {
    ok: true,
    count: skills.length,
    skills,
    usage: {
      load: 'POST /api/agent_skills {"action": "load", "skill_id": "<id>"}',
      list: "GET /api/agent_skills"
    }
  };
}

export async function post(context) {
  const { body } = context;

  if (!body || typeof body !== "object") {
    return { error: "Request body must be JSON." };
  }

  if (body.action === "load" && body.skill_id) {
    const skillPath = path.join(SKILLS_ROOT, body.skill_id, "SKILL.md");

    try {
      const raw = await fs.readFile(skillPath, "utf8");
      const { body: content, frontmatter } = parseMarkdownDocument(raw);

      return {
        ok: true,
        skill: {
          id: body.skill_id,
          name: frontmatter?.name || body.skill_id,
          description: frontmatter?.description || "",
          content
        }
      };
    } catch {
      return { error: `Skill not found: ${body.skill_id}` };
    }
  }

  return { error: "Unknown action. Use {action: 'load', skill_id: '<id>'}." };
}
