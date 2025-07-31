/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import os from 'node:os';
import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface SystemInfo {
  platform: string;
  arch: string;
  osType: string;
  osVersion: string;
  nodeVersion: string;
  shell: string;
  workingDirectory: string;
  userInfo: {
    username: string;
    homedir: string;
  };
  environment: {
    term: string | undefined;
    lang: string | undefined;
    timezone: string;
  };
  hardware: {
    cpuCount: number;
    totalMemoryGB: number;
    freeMemoryGB: number;
  };
  uevoVersion: string;
}

/**
 * 获取UEVO版本信息
 */
async function getUevoVersion(): Promise<string> {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // 尝试找到核心包的package.json
    let currentDir = __dirname;
    for (let i = 0; i < 5; i++) {
      const packageJsonPath = path.join(currentDir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson.name && packageJson.name.includes('uevo')) {
          return packageJson.version || 'unknown';
        }
      }
      currentDir = path.dirname(currentDir);
    }
    
    return process.env.CLI_VERSION || 'unknown';
  } catch {
    return 'unknown';
  }
}

export class SystemInfoTool {
  static readonly Name = 'get_system_info';

  /**
   * 获取当前系统的详细信息
   */
  static async getSystemInfo(): Promise<SystemInfo> {
    const userInfo = os.userInfo();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    
    // 获取shell信息
    let shell = process.env.SHELL || process.env.COMSPEC || 'unknown';
    if (process.platform === 'win32' && !process.env.SHELL) {
      shell = process.env.COMSPEC || 'cmd.exe';
    }

    // 获取UEVO版本
    const uevoVersion = await getUevoVersion();

    return {
      platform: process.platform,
      arch: process.arch,
      osType: os.type(),
      osVersion: os.release(),
      nodeVersion: process.version,
      shell,
      workingDirectory: process.cwd(),
      userInfo: {
        username: userInfo.username,
        homedir: userInfo.homedir,
      },
      environment: {
        term: process.env.TERM,
        lang: process.env.LANG || process.env.LANGUAGE,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      hardware: {
        cpuCount: os.cpus().length,
        totalMemoryGB: Math.round(totalMemory / (1024 * 1024 * 1024) * 100) / 100,
        freeMemoryGB: Math.round(freeMemory / (1024 * 1024 * 1024) * 100) / 100,
      },
      uevoVersion,
    };
  }

  /**
   * 将系统信息格式化为规则0的内容
   */
  static formatSystemInfoAsRule(systemInfo: SystemInfo): string {
    const { platform, arch, osType, osVersion, nodeVersion, shell, workingDirectory } = systemInfo;
    const { userInfo, environment, hardware, uevoVersion } = systemInfo;

    const platformName = this.getPlatformDisplayName(platform);
    const shellName = this.getShellDisplayName(shell);

    return `系统环境信息:
- 操作系统: ${platformName} ${osVersion} (${osType}, ${arch})
- Node.js版本: ${nodeVersion}
- UEVO版本: ${uevoVersion}
- 当前shell: ${shellName}
- 工作目录: ${workingDirectory}
- 用户: ${userInfo.username}
- 用户主目录: ${userInfo.homedir}
- 终端环境: ${environment.term || 'unknown'}
- 语言环境: ${environment.lang || 'unknown'}
- 时区: ${environment.timezone}
- CPU核心数: ${hardware.cpuCount}
- 内存: ${hardware.freeMemoryGB}GB可用 / ${hardware.totalMemoryGB}GB总计

请根据用户目前电脑的系统和所处的环境使用对应的shell语法以及其他操作`;
  }

  /**
   * 获取平台友好的显示名称
   */
  private static getPlatformDisplayName(platform: string): string {
    switch (platform) {
      case 'win32':
        return 'Windows';
      case 'darwin':
        return 'macOS';
      case 'linux':
        return 'Linux';
      case 'freebsd':
        return 'FreeBSD';
      case 'openbsd':
        return 'OpenBSD';
      case 'sunos':
        return 'SunOS';
      case 'aix':
        return 'AIX';
      default:
        return platform;
    }
  }

  /**
   * 获取shell友好的显示名称
   */
  private static getShellDisplayName(shell: string): string {
    const shellName = shell.split(/[/\\]/).pop() || shell;
    switch (shellName.toLowerCase()) {
      case 'bash':
      case 'bash.exe':
        return 'Bash';
      case 'zsh':
      case 'zsh.exe':
        return 'Zsh';
      case 'fish':
      case 'fish.exe':
        return 'Fish';
      case 'cmd':
      case 'cmd.exe':
        return 'Command Prompt (cmd)';
      case 'powershell':
      case 'powershell.exe':
        return 'PowerShell';
      case 'pwsh':
      case 'pwsh.exe':
        return 'PowerShell Core';
      case 'sh':
      case 'sh.exe':
        return 'Shell (sh)';
      case 'csh':
      case 'csh.exe':
        return 'C Shell';
      case 'tcsh':
      case 'tcsh.exe':
        return 'TC Shell';
      default:
        return shellName;
    }
  }
} 