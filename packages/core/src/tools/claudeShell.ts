/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { Config } from '../config/config.js';
import {
  BaseTool,
  ToolResult,
  ToolCallConfirmationDetails,
  ToolExecuteConfirmationDetails,
  ToolConfirmationOutcome,
  Icon,
} from './tools.js';
import { Type } from '@google/genai';
import { SchemaValidator } from '../utils/schemaValidator.js';
import { getErrorMessage } from '../utils/errors.js';
import stripAnsi from 'strip-ansi';
import { spawn } from 'child_process';
import { summarizeToolOutput } from '../utils/summarizer.js';

export interface ClaudeShellToolParams {
  command: string;
  description?: string;
  directory?: string;
}

const OUTPUT_UPDATE_INTERVAL_MS = 1000;

/**
 * Claude专用的Shell工具
 * 针对Claude模型的特性进行了优化，包括：
 * - 更宽松的命令验证
 * - 智能命令建议和修复
 * - 对Claude常见错误的容错处理
 */
export class ClaudeShellTool extends BaseTool<ClaudeShellToolParams, ToolResult> {
  static Name: string = 'run_shell_command';
  private whitelist: Set<string> = new Set();

  constructor(private readonly config: Config) {
    super(
      ClaudeShellTool.Name,
      'Claude Shell',
      `Claude专用的Shell工具，执行shell命令。针对Claude模型进行了优化：

- 支持常见的shell命令（ls, cd, pwd, cat, echo, mkdir, rm等）
- 自动处理Windows和Unix系统差异
- 提供智能命令建议和错误修复
- 对Claude模型的输出格式进行了优化

返回信息包括：
- Command: 执行的命令
- Directory: 执行目录
- Stdout: 标准输出
- Stderr: 错误输出
- Exit Code: 退出码
- Error: 错误信息（如有）`,
      Icon.Terminal,
      {
        type: Type.OBJECT,
        properties: {
          command: {
            type: Type.STRING,
            description: 'Shell命令，例如: "ls -l", "cd packages", "pwd"等',
          },
          description: {
            type: Type.STRING,
            description: '命令的简短描述（可选）',
          },
          directory: {
            type: Type.STRING,
            description: '执行命令的目录（可选，相对于项目根目录）',
          },
        },
        required: ['command'],
      },
      false, // output is not markdown
      true, // output can be updated
    );
  }

  getDescription(params: ClaudeShellToolParams): string {
    let description = `${params.command}`;
    if (params.directory) {
      description += ` [in ${params.directory}]`;
    }
    if (params.description) {
      description += ` (${params.description.replace(/\n/g, ' ')})`;
    }
    return description;
  }

  /**
   * 智能命令修复和建议
   * 针对Claude模型常见的命令格式问题进行修复
   */
  private smartCommandFix(command: string): string {
    // 确保command是有效的字符串
    if (!command || typeof command !== 'string') {
      return '';
    }
    
    let fixedCommand = command.trim();

    // 常见的Claude命令修复
    const commandFixes: { [key: string]: string } = {
      'change directory to': 'cd',
      'list directory': 'ls',
      'list files': 'ls -la',
      'show current directory': 'pwd',
      'print working directory': 'pwd',
      'make directory': 'mkdir',
      'create directory': 'mkdir',
      'remove file': 'rm',
      'delete file': 'rm',
      'copy file': 'cp',
      'move file': 'mv',
      'display file': 'cat',
      'show file content': 'cat',
      'echo message': 'echo',
    };

    // 检查是否是自然语言描述，如果是则转换为命令
    for (const [description, cmd] of Object.entries(commandFixes)) {
      if (fixedCommand.toLowerCase().includes(description)) {
        // 提取目标（如目录名、文件名等）
        const parts = fixedCommand.split(' ');
        const lastPart = parts[parts.length - 1];
        if (lastPart && !lastPart.includes(description)) {
          fixedCommand = `${cmd} ${lastPart}`;
        } else {
          fixedCommand = cmd;
        }
        break;
      }
    }

    // Windows系统命令适配
    if (os.platform() === 'win32') {
      // 将Unix命令转换为Windows命令
      const windowsCommands: { [key: string]: string } = {
        'ls': 'dir',
        'ls -l': 'dir',
        'ls -la': 'dir /a',
        'cat': 'type',
        'which': 'where',
        'grep': 'findstr',
        'rm': 'del',
        'mv': 'move',
        'cp': 'copy',
      };

      const firstWord = fixedCommand.split(' ')[0];
      if (windowsCommands[firstWord]) {
        fixedCommand = fixedCommand.replace(firstWord, windowsCommands[firstWord]);
      }
    }

    return fixedCommand;
  }

  /**
   * 获取命令的根命令
   */
  getCommandRoot(command: string): string | undefined {
    // 确保command是有效的字符串
    if (!command || typeof command !== 'string') {
      return undefined;
    }
    
    return command
      .trim()
      .replace(/[{}()]/g, '')
      .split(/[\s;&|]+/)[0]
      ?.split(/[/\\]/)
      .pop();
  }

  /**
   * Claude专用的命令验证
   * 比标准shell工具更宽松，专门处理Claude的常见问题
   */
  isCommandAllowed(command: string): { allowed: boolean; reason?: string } {
    // 如果当前目录在可信目录中，允许所有命令
    if (this.config.isCurrentDirTrusted()) {
      return { 
        allowed: true, 
        reason: 'Command allowed in trusted directory' 
      };
    }

    // 确保command是有效的字符串
    if (!command || typeof command !== 'string') {
      return {
        allowed: false,
        reason: 'Command must be a non-empty string',
      };
    }

    // 基本安全检查
    if (command.includes('$(')) {
      return {
        allowed: false,
        reason: '不允许使用命令替换 $() 以确保安全',
      };
    }

    // 危险命令检查
    const dangerousCommands = ['rm -rf /', 'format', 'fdisk', 'mkfs', 'dd if='];
    for (const dangerous of dangerousCommands) {
      if (command.toLowerCase().includes(dangerous.toLowerCase())) {
        return {
          allowed: false,
          reason: `危险命令被禁止: ${dangerous}`,
        };
      }
    }

    // Claude常用的安全命令白名单
    const safeCommands = [
      'ls', 'dir', 'pwd', 'cd', 'cat', 'type', 'echo', 'mkdir', 'rmdir',
      'cp', 'copy', 'mv', 'move', 'find', 'grep', 'findstr', 'head', 'tail',
      'wc', 'sort', 'uniq', 'which', 'where', 'whoami', 'date', 'time',
      'ps', 'tasklist', 'kill', 'taskkill', 'chmod', 'chown', 'touch',
      'git', 'npm', 'node', 'python', 'pip', 'java', 'javac', 'gcc',
      'make', 'cmake', 'docker', 'kubectl', 'curl', 'wget', 'ping',
    ];

    const rootCommand = this.getCommandRoot(command);
    if (rootCommand && safeCommands.includes(rootCommand.toLowerCase())) {
      return { allowed: true };
    }

    // 对于其他命令，给出建议而不是直接拒绝
    return {
      allowed: true, // Claude专用版本更宽松
      reason: `命令 '${rootCommand}' 不在常用安全命令列表中，但允许执行。请确保命令安全。`,
    };
  }

  validateToolParams(params: ClaudeShellToolParams): string | null {
    const errors = SchemaValidator.validate(this.schema.parameters, params);
    if (errors) {
      return errors;
    }

    if (!params.command || !params.command.trim()) {
      return 'Command must be a non-empty string';
    }

    // 智能修复命令
    const fixedCommand = this.smartCommandFix(params.command);
    if (fixedCommand !== params.command) {
      console.log(`[Claude Shell] 命令已自动修复: "${params.command}" -> "${fixedCommand}"`);
      params.command = fixedCommand;
    }

    const commandCheck = this.isCommandAllowed(params.command);
    if (!commandCheck.allowed) {
      return commandCheck.reason || `Command is not allowed: ${params.command}`;
    }

    if (!this.getCommandRoot(params.command)) {
      return 'Could not identify command root to obtain permission from user.';
    }

    if (params.directory) {
      if (path.isAbsolute(params.directory)) {
        return 'Directory cannot be absolute. Must be relative to the project root directory.';
      }
      const directory = path.resolve(
        this.config.getTargetDir(),
        params.directory,
      );
      if (!fs.existsSync(directory)) {
        return 'Directory must exist.';
      }
    }

    return null;
  }

  async shouldConfirmExecute(
    params: ClaudeShellToolParams,
    _abortSignal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails | false> {
    if (this.validateToolParams(params)) {
      return false; // skip confirmation, execute call will fail immediately
    }
    const rootCommand = this.getCommandRoot(params.command)!;
    if (this.whitelist.has(rootCommand)) {
      return false; // already approved and whitelisted
    }
    const confirmationDetails: ToolExecuteConfirmationDetails = {
      type: 'exec',
      title: 'Confirm Claude Shell Command',
      command: params.command,
      rootCommand,
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.whitelist.add(rootCommand);
        }
      },
    };
    return confirmationDetails;
  }

  async execute(
    params: ClaudeShellToolParams,
    abortSignal: AbortSignal,
    updateOutput?: (chunk: string) => void,
  ): Promise<ToolResult> {
    const validationError = this.validateToolParams(params);
    if (validationError) {
      return {
        llmContent: [
          `Command rejected: ${params.command}`,
          `Reason: ${validationError}`,
        ].join('\n'),
        returnDisplay: `Error: ${validationError}`,
      };
    }

    if (abortSignal.aborted) {
      return {
        llmContent: 'Command was cancelled by user before it could start.',
        returnDisplay: 'Command cancelled by user.',
      };
    }

    const isWindows = os.platform() === 'win32';
    const tempFileName = `claude_shell_pgrep_${crypto
      .randomBytes(6)
      .toString('hex')}.tmp`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);

    // 构建适合不同平台的命令
    const command = isWindows
      ? params.command
      : (() => {
          let command = params.command.trim();
          if (!command.endsWith('&')) command += ';';
          return `{ ${command} }; __code=$?; pgrep -g 0 >${tempFilePath} 2>&1; exit $__code;`;
        })();

    // 执行命令
    const shell = isWindows
      ? spawn('cmd.exe', ['/c', command], {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: path.resolve(this.config.getTargetDir(), params.directory || ''),
        })
      : spawn('bash', ['-c', command], {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: true,
          cwd: path.resolve(this.config.getTargetDir(), params.directory || ''),
        });

    let exited = false;
    let stdout = '';
    let output = '';
    let lastUpdateTime = Date.now();

    const appendOutput = (str: string) => {
      output += str;
      if (
        updateOutput &&
        Date.now() - lastUpdateTime > OUTPUT_UPDATE_INTERVAL_MS
      ) {
        updateOutput(output);
        lastUpdateTime = Date.now();
      }
    };

    shell.stdout.on('data', (data: Buffer) => {
      if (!exited) {
        const str = stripAnsi(data.toString());
        stdout += str;
        appendOutput(str);
      }
    });

    let stderr = '';
    shell.stderr.on('data', (data: Buffer) => {
      if (!exited) {
        const str = stripAnsi(data.toString());
        stderr += str;
        appendOutput(str);
      }
    });

    let error: Error | null = null;
    shell.on('error', (err: Error) => {
      error = err;
      error.message = error.message.replace(command, params.command);
    });

    let code: number | null = null;
    let processSignal: NodeJS.Signals | null = null;
    const exitHandler = (
      _code: number | null,
      _signal: NodeJS.Signals | null,
    ) => {
      exited = true;
      code = _code;
      processSignal = _signal;
    };
    shell.on('exit', exitHandler);

    const abortHandler = async () => {
      if (shell.pid && !exited) {
        if (os.platform() === 'win32') {
          spawn('taskkill', ['/pid', shell.pid.toString(), '/f', '/t']);
        } else {
          try {
            process.kill(-shell.pid, 'SIGTERM');
            await new Promise((resolve) => setTimeout(resolve, 200));
            if (shell.pid && !exited) {
              process.kill(-shell.pid, 'SIGKILL');
            }
          } catch (_e) {
            try {
              if (shell.pid) {
                shell.kill('SIGKILL');
              }
            } catch (_e) {
              console.error(`failed to kill shell process ${shell.pid}: ${_e}`);
            }
          }
        }
      }
    };
    abortSignal.addEventListener('abort', abortHandler);

    // 等待命令执行完成
    try {
      await new Promise((resolve) => shell.on('exit', resolve));
    } finally {
      abortSignal.removeEventListener('abort', abortHandler);
    }

    // 处理后台进程PID（仅限Unix系统）
    const backgroundPIDs: number[] = [];
    if (os.platform() !== 'win32') {
      if (fs.existsSync(tempFilePath)) {
        const pgrepLines = fs
          .readFileSync(tempFilePath, 'utf8')
          .split('\n')
          .filter(Boolean);
        for (const line of pgrepLines) {
          if (!/^\d+$/.test(line)) {
            console.error(`pgrep: ${line}`);
          }
          const pid = Number(line);
          if (pid !== shell.pid) {
            backgroundPIDs.push(pid);
          }
        }
        fs.unlinkSync(tempFilePath);
      }
    }

    // 构建LLM内容 - 针对Claude优化的格式
    let llmContent = '';
    if (abortSignal.aborted) {
      llmContent = 'Command was cancelled by user before it could complete.';
      if (output.trim()) {
        llmContent += ` Output before cancellation:\n${output}`;
      }
    } else {
      // Claude友好的输出格式
      const parts = [
        `Command: ${params.command}`,
        `Directory: ${params.directory || '(project root)'}`,
      ];

      if (stdout.trim()) {
        parts.push(`Output:\n${stdout}`);
      }

      if (stderr.trim()) {
        parts.push(`Errors:\n${stderr}`);
      }

      if (error) {
        parts.push(`Error: ${getErrorMessage(error)}`);
      }

      if (code !== null && code !== 0) {
        parts.push(`Exit Code: ${code}`);
      }

      if (processSignal) {
        parts.push(`Signal: ${processSignal}`);
      }

      if (backgroundPIDs.length > 0) {
        parts.push(`Background PIDs: ${backgroundPIDs.join(', ')}`);
      }

      llmContent = parts.join('\n');
    }

    // 返回显示内容
    let returnDisplayMessage = '';
    if (this.config.getDebugMode()) {
      returnDisplayMessage = llmContent;
    } else {
      if (output.trim()) {
        returnDisplayMessage = output;
      } else {
        if (abortSignal.aborted) {
          returnDisplayMessage = 'Command cancelled by user.';
        } else if (processSignal) {
          returnDisplayMessage = `Command terminated by signal: ${processSignal}`;
        } else if (error) {
          returnDisplayMessage = `Command failed: ${getErrorMessage(error)}`;
        } else if (code !== null && code !== 0) {
          returnDisplayMessage = `Command exited with code: ${code}`;
        } else {
          returnDisplayMessage = 'Command completed successfully.';
        }
      }
    }

    // 应用输出摘要（如果配置了）
    const summarizeConfig = this.config.getSummarizeToolOutputConfig();
    if (summarizeConfig && summarizeConfig[this.name]) {
      const summary = await summarizeToolOutput(
        llmContent,
        this.config.getAIClient(),
        abortSignal,
        summarizeConfig[this.name].tokenBudget,
      );
      return {
        llmContent: summary,
        returnDisplay: returnDisplayMessage,
      };
    }

    return {
      llmContent,
      returnDisplay: returnDisplayMessage,
    };
  }
}