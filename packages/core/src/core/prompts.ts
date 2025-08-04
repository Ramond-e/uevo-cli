/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { LSTool } from '../tools/ls.js';
import { EditTool } from '../tools/edit.js';
import { GlobTool } from '../tools/glob.js';
import { GrepTool } from '../tools/grep.js';
import { ReadFileTool } from '../tools/read-file.js';
import { ReadManyFilesTool } from '../tools/read-many-files.js';
import { ShellTool } from '../tools/shell.js';
import { WriteFileTool } from '../tools/write-file.js';
import process from 'node:process';
import { isGitRepository } from '../utils/gitUtils.js';
import { MemoryTool, GEMINI_CONFIG_DIR } from '../tools/memoryTool.js';


/**
 * 获取工具工作空间路径
 */
function getToolWorkspacePath(): string {
  // 首先检查环境变量
  const workspaceEnv = process.env.UEVO_TESTSPACE;
  if (workspaceEnv) {
    if (workspaceEnv.startsWith('~/')) {
      return path.join(os.homedir(), workspaceEnv.slice(2));
    } else if (workspaceEnv === '~') {
      return os.homedir();
    }
    return path.resolve(workspaceEnv);
  }
  
  // 如果环境变量未设置，尝试从配置文件读取
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
  } catch {
    // 忽略读取配置文件的错误，使用默认值
  }
  
  // 默认路径：~/uevo/testspace
  return path.join(os.homedir(), 'uevo', 'testspace');
}

/**
 * 获取用户自定义规则
 */
function getUserRules(): { systemRule: string | null; userRules: string[] } {
  try {
    const homeDir = os.homedir();
    const rulesFilePath = path.join(homeDir, '.uevo', 'uevo-rules.json');
    
    if (!fs.existsSync(rulesFilePath)) {
      return { systemRule: null, userRules: [] };
    }
    
    const content = fs.readFileSync(rulesFilePath, 'utf-8');
    if (!content.trim()) {
      return { systemRule: null, userRules: [] };
    }
    
    const data = JSON.parse(content);
    
    // 兼容旧格式：如果是数组，转换为新格式
    if (Array.isArray(data)) {
      return { systemRule: null, userRules: data };
    }
    
    // 新格式
    return {
      systemRule: data.systemRule || null,
      userRules: data.userRules || []
    };
  } catch {
    return { systemRule: null, userRules: [] };
  }
}

/**
 * 将用户规则格式化为系统提示词的一部分
 */
function formatUserRulesForPrompt(rulesData: { systemRule: string | null; userRules: string[] }): string {
  let rulesSection = '';
  
  if (rulesData.systemRule || rulesData.userRules.length > 0) {
    rulesSection += '\n\n# 用户自定义规则\n\n';
    
    // 添加系统信息规则（规则0）
    if (rulesData.systemRule) {
      rulesSection += '## 规则 0 - 系统环境\n\n';
      rulesSection += rulesData.systemRule + '\n\n';
    }
    
    // 添加用户自定义规则
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

export function getCoreSystemPrompt(userMemory?: string, todoPrompt?: string): string {
  // if UEVO_SYSTEM_MD is set (and not 0|false), override system prompt from file
  // default path is .gemini/system.md but can be modified via custom path in UEVO_SYSTEM_MD
  let systemMdEnabled = false;
  let systemMdPath = path.resolve(path.join(GEMINI_CONFIG_DIR, 'system.md'));
  const systemMdVar = process.env.UEVO_SYSTEM_MD;
  if (systemMdVar) {
    const systemMdVarLower = systemMdVar.toLowerCase();
    if (!['0', 'false'].includes(systemMdVarLower)) {
      systemMdEnabled = true; // enable system prompt override
      if (!['1', 'true'].includes(systemMdVarLower)) {
        let customPath = systemMdVar;
        if (customPath.startsWith('~/')) {
          customPath = path.join(os.homedir(), customPath.slice(2));
        } else if (customPath === '~') {
          customPath = os.homedir();
        }
        systemMdPath = path.resolve(customPath); // use custom path from UEVO_SYSTEM_MD
      }
      // require file to exist when override is enabled
      if (!fs.existsSync(systemMdPath)) {
        throw new Error(`missing system prompt file '${systemMdPath}'`);
      }
    }
  }
  // 模块化模板拼装
  const basePrompt = systemMdEnabled
    ? fs.readFileSync(systemMdPath, 'utf8')
    : [
      'You are an interactive CLI agent specializing in software engineering tasks. Your primary goal is to help users safely and efficiently, adhering strictly to the following instructions and utilizing your available tools.',
      coreMandates
        .replace(/\${ReadFileTool.Name}/g, ReadFileTool.Name)
        .replace(/\${WriteFileTool.Name}/g, WriteFileTool.Name),
      primaryWorkflows
        .replace(/\${GrepTool.Name}/g, GrepTool.Name)
        .replace(/\${GlobTool.Name}/g, GlobTool.Name)
        .replace(/\${ReadFileTool.Name}/g, ReadFileTool.Name)
        .replace(/\${ReadManyFilesTool.Name}/g, ReadManyFilesTool.Name)
        .replace(/\${EditTool.Name}/g, EditTool.Name)
        .replace(/\${WriteFileTool.Name}/g, WriteFileTool.Name)
        .replace(/\${ShellTool.Name}/g, ShellTool.Name)
        .replace(/\${getToolWorkspacePath\(\)}/g, getToolWorkspacePath()),
      operationalGuidelines
        .replace(/\${ShellTool.Name}/g, ShellTool.Name)
        .replace(/\${ReadFileTool.Name}/g, ReadFileTool.Name)
        .replace(/\${WriteFileTool.Name}/g, WriteFileTool.Name)
        .replace(/\${MemoryTool.Name}/g, MemoryTool.Name),
      // 其余附加剩余部分可接续拼装，或用原有大字符串
    ].join('\n\n');

  // if UEVO_WRITE_SYSTEM_MD is set (and not 0|false), write base system prompt to file
  const writeSystemMdVar = process.env.UEVO_WRITE_SYSTEM_MD;
  if (writeSystemMdVar) {
    const writeSystemMdVarLower = writeSystemMdVar.toLowerCase();
    if (!['0', 'false'].includes(writeSystemMdVarLower)) {
      if (['1', 'true'].includes(writeSystemMdVarLower)) {
        fs.mkdirSync(path.dirname(systemMdPath), { recursive: true });
        fs.writeFileSync(systemMdPath, basePrompt); // write to default path, can be modified via UEVO_SYSTEM_MD
      } else {
        let customPath = writeSystemMdVar;
        if (customPath.startsWith('~/')) {
          customPath = path.join(os.homedir(), customPath.slice(2));
        } else if (customPath === '~') {
          customPath = os.homedir();
        }
        const resolvedPath = path.resolve(customPath);
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        fs.writeFileSync(resolvedPath, basePrompt); // write to custom path from UEVO_WRITE_SYSTEM_MD
      }
    }
  }

  const memorySuffix =
    userMemory && userMemory.trim().length > 0
      ? `\n\n---\n\n${userMemory.trim()}`
      : '';

  const todoSuffix = 
    todoPrompt && todoPrompt.trim().length > 0
      ? `\n\n---\n\n${todoPrompt.trim()}`
      : '';

  // 获取用户自定义规则
  const rulesData = getUserRules();
  // 将用户规则格式化为系统提示词的一部分
  const userRulesPrompt = formatUserRulesForPrompt(rulesData);

  return `${basePrompt}${userRulesPrompt}${memorySuffix}${todoSuffix}`;
}

/**
 * Provides the system prompt for the history compression process.
 * This prompt instructs the model to act as a specialized state manager,
 * think in a scratchpad, and produce a structured XML summary.
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
