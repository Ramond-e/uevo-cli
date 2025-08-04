/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import process from 'node:process';
import { GEMINI_CONFIG_DIR } from '../tools/memoryTool.js';

/**
 * 获取工具工作空间路径
 */
export function getToolWorkspacePath(): string {
  const workspaceEnv = process.env.UEVO_TESTSPACE;
  if (workspaceEnv) {
    if (workspaceEnv.startsWith('~/')) {
      return path.join(os.homedir(), workspaceEnv.slice(2));
    } else if (workspaceEnv === '~') {
      return os.homedir();
    }
    return path.resolve(workspaceEnv);
  }
  try {
    const homeDir = os.homedir();
    const envFilePath = path.join(homeDir, '.uevo', '.uevo-env');
    if (fs.existsSync(envFilePath)) {
      const content = fs.readFileSync(envFilePath, 'utf-8');
      if (content.trim()) {
        const config = JSON.parse(content);
        const storedPath = config.UEVO_TESTSPACE;
        if (storedPath) {
          if (storedPath.startsWith('~/')) {
            return path.join(os.homedir(), storedPath.slice(2));
          } else if (storedPath === '~') {
            return os.homedir();
          }
          return path.resolve(storedPath);
        }
      }
    }
  } catch {}
  return path.join(os.homedir(), 'uevo', 'testspace');
}

/**
 * 获取用户自定义规则
 */
function getUserRules(): { systemRule: string | null; userRules: string[] } {
  try {
    const homeDir = os.homedir();
    const rulesFilePath = path.join(homeDir, '.uevo', 'uevo-rules.json');
    if (!fs.existsSync(rulesFilePath)) return { systemRule: null, userRules: [] };
    const content = fs.readFileSync(rulesFilePath, 'utf-8');
    if (!content.trim()) return { systemRule: null, userRules: [] };
    const data = JSON.parse(content);
    if (Array.isArray(data)) return { systemRule: null, userRules: data };
    return {
      systemRule: data.systemRule || null,
      userRules: data.userRules || []
    };
  } catch {
    return { systemRule: null, userRules: [] };
  }
}

function formatUserRulesForPrompt(rulesData: { systemRule: string | null; userRules: string[] }): string {
  let rulesSection = '';
  if (rulesData.systemRule || rulesData.userRules.length > 0) {
    rulesSection += '\n\n# 用户自定义规则\n\n';
    if (rulesData.systemRule) {
      rulesSection += '## 规则 0 - 系统环境\n\n';
      rulesSection += rulesData.systemRule + '\n\n';
    }
    if (rulesData.userRules.length > 0) {
      rulesSection += '## 用户自定义规则\n\n';
      rulesData.userRules.forEach((rule, index) => {
        rulesSection += `**规则 ${index + 1}:** ${rule}\n\n`;
      });
    }
    rulesSection += '请严格遵守以上所有规则，特别是规则0中的系统环境信息，使用适当的命令和语法。';
  }
  return rulesSection;
}

// === 动态模板路由实现 ===
const templateRouteMap = {
  core: 'core-mandates.md',
  workflows: 'primary-workflows.md',
  guidelines: 'operational-guidelines.md',
} as const;
export type TemplateSection = keyof typeof templateRouteMap;
const templatesDir = path.join(__dirname, 'templates');
function getPromptSection(section: TemplateSection): string {
  const filename = templateRouteMap[section];
  const filePath = path.join(templatesDir, filename);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
}
function getDynamicSystemPrompt(sections: TemplateSection[]): string {
  return sections.map(getPromptSection).filter(Boolean).join('\n\n');
}
const defaultSections: TemplateSection[] = ['core', 'workflows', 'guidelines'];

export function getCoreSystemPrompt(userMemory?: string, todoPrompt?: string): string {
  let systemMdEnabled = false;
  let systemMdPath = path.resolve(path.join(GEMINI_CONFIG_DIR, 'system.md'));
  const systemMdVar = process.env.UEVO_SYSTEM_MD;
  if (systemMdVar) {
    const systemMdVarLower = systemMdVar.toLowerCase();
    if (!['0', 'false'].includes(systemMdVarLower)) {
      systemMdEnabled = true;
      if (!['1', 'true'].includes(systemMdVarLower)) {
        let customPath = systemMdVar;
        if (customPath.startsWith('~/')) customPath = path.join(os.homedir(), customPath.slice(2));
        else if (customPath === '~') customPath = os.homedir();
        systemMdPath = path.resolve(customPath);
      }
      if (!fs.existsSync(systemMdPath)) {
        throw new Error(`missing system prompt file '${systemMdPath}'`);
      }
    }
  }
  const basePrompt = systemMdEnabled
    ? fs.readFileSync(systemMdPath, 'utf8')
    : getDynamicSystemPrompt(defaultSections);

  const memorySuffix = userMemory && userMemory.trim().length > 0 ? `\n\n---\n\n${userMemory.trim()}` : '';
  const todoSuffix = todoPrompt && todoPrompt.trim().length > 0 ? `\n\n---\n\n${todoPrompt.trim()}` : '';
  const rulesData = getUserRules();
  const userRulesPrompt = formatUserRulesForPrompt(rulesData);
  return `${basePrompt}${userRulesPrompt}${memorySuffix}${todoSuffix}`;
}

/**
 * Provides the system prompt for the history compression process.
 */
export function getCompressionPrompt(): string {
  return `
You are the component that summarizes internal chat history into a given structure.

When the conversation history grows too large, you will be invoked to distill the entire history into a concise, structured XML snapshot. This snapshot is CRITICAL, as it will become the agent's *only* memory of the past. The agent will resume its work based solely on this snapshot. All crucial details, plans, errors, and user directives MUST be preserved.

First, you will think through the entire history in a private <scratchpad>. Review the user's overall goal, the agent's actions, tool outputs, file modifications, and any unresolved questions. Identify every piece of information that is essential for future actions.

After your reasoning is complete, generate the final <state_snapshot> XML object. Be incredibly dense with information. Omit any irrelevant conversational filler.

The structure MUST be as follows:

<state_snapshot>
    <overall_goal>
        <!-- A single, concise sentence describing the user's high-level objective. -->
        <!-- Example: "Refactor the authentication service to use a new JWT library." -->
    </overall_goal>

    <key_knowledge>
        <!-- Crucial facts, conventions, and constraints the agent must remember based on the conversation history and interaction with the user. Use bullet points. -->
        <!-- Example:
         - Build Command: \`npm run build\`
         - Testing: Tests are run with \`npm test\`. Test files must end in \`.test.ts\`.
         - API Endpoint: The primary API endpoint is \`https://api.example.com/v2\`.
        -->
    </key_knowledge>

    <file_system_state>
        <!-- List files that have been created, read, modified, or deleted. Note their status and critical learnings. -->
        <!-- Example:
         - CWD: \`/home/user/project/src\`
         - READ: \`package.json\` - Confirmed 'axios' is a dependency.
         - MODIFIED: \`services/auth.ts\` - Replaced 'jsonwebtoken' with 'jose'.
         - CREATED: \`tests/new-feature.test.ts\` - Initial test structure for the new feature.
        -->
    </file_system_state>

    <recent_actions>
        <!-- A summary of the last few significant agent actions and their outcomes. Focus on facts. -->
        <!-- Example:
         - Ran \`grep 'old_function'\` which returned 3 results in 2 files.
         - Ran \`npm run test\`, which failed due to a snapshot mismatch in \`UserProfile.test.ts\`.
         - Ran \`ls -F static/\` and discovered image assets are stored as \`.webp\`.
        -->
    </recent_actions>

    <current_plan>
        <!-- The agent's step-by-step plan. Mark completed steps. -->
        <!-- Example:
         1. [DONE] Identify all files using the deprecated 'UserAPI'.
         2. [IN PROGRESS] Refactor \`src/components/UserProfile.tsx\` to use the new 'ProfileAPI'.
         3. [TODO] Refactor the remaining files.
         4. [TODO] Update tests to reflect the API change.
        -->
    </current_plan>
</state_snapshot>
`.trim();
}