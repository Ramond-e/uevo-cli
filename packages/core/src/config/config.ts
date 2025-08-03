/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'node:path';
import process from 'node:process';
import {
  AuthType,
  ContentGeneratorConfig,
  createContentGeneratorConfig,
} from '../core/contentGenerator.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { LSTool } from '../tools/ls.js';
import { ReadFileTool } from '../tools/read-file.js';
import { GrepTool } from '../tools/grep.js';
import { GlobTool } from '../tools/glob.js';
import { EditTool } from '../tools/edit.js';
import { ShellTool } from '../tools/shell.js';
import { ClaudeShellTool } from '../tools/claudeShell.js';
import { WriteFileTool } from '../tools/write-file.js';
import { WebFetchTool } from '../tools/web-fetch.js';
import { ReadManyFilesTool } from '../tools/read-many-files.js';
import {
  MemoryTool,
  setGeminiMdFilename,
  GEMINI_CONFIG_DIR as GEMINI_DIR,
} from '../tools/memoryTool.js';
import { WebSearchTool } from '../tools/web-search.js';
import { EnhancedWebSearchTool } from '../tools/enhanced-web-search.js';
import { GeminiClient } from '../core/client.js';
import { getModelInfo as getModelInfoFromMapping } from '../core/modelProviderMapping.js';
import { FileDiscoveryService } from '../services/fileDiscoveryService.js';
import { GitService } from '../services/gitService.js';
import { getProjectTempDir } from '../utils/paths.js';
import {
  initializeTelemetry,
  DEFAULT_TELEMETRY_TARGET,
  DEFAULT_OTLP_ENDPOINT,
  TelemetryTarget,
  StartSessionEvent,
} from '../telemetry/index.js';
import {
  DEFAULT_UEVO_EMBEDDING_MODEL,
  DEFAULT_UEVO_FLASH_MODEL,
} from './models.js';
import { ClearcutLogger } from '../telemetry/clearcut-logger/clearcut-logger.js';
import { shouldAttemptBrowserLaunch } from '../utils/browser.js';
import { MCPOAuthConfig } from '../mcp/oauth-provider.js';

// Re-export OAuth config type
export type { MCPOAuthConfig };

export enum ApprovalMode {
  DEFAULT = 'default',
  AUTO_EDIT = 'autoEdit',
  YOLO = 'yolo',
}

export interface AccessibilitySettings {
  disableLoadingPhrases?: boolean;
}

export interface BugCommandSettings {
  urlTemplate: string;
}

export interface SummarizeToolOutputSettings {
  tokenBudget?: number;
}

export interface TelemetrySettings {
  enabled?: boolean;
  target?: TelemetryTarget;
  otlpEndpoint?: string;
  logPrompts?: boolean;
  outfile?: string;
}

export interface GeminiCLIExtension {
  name: string;
  version: string;
  isActive: boolean;
}

export interface FileFilteringOptions {
  respectGitIgnore: boolean;
  respectuevoignore: boolean;
}

// For memory files
export const DEFAULT_MEMORY_FILE_FILTERING_OPTIONS: FileFilteringOptions = {
  respectGitIgnore: false,
  respectuevoignore: true,
};

// For all other files
export const DEFAULT_FILE_FILTERING_OPTIONS: FileFilteringOptions = {
  respectGitIgnore: true,
  respectuevoignore: true,
};

export class MCPServerConfig {
  constructor(
    // For stdio transport
    readonly command?: string,
    readonly args?: string[],
    readonly env?: Record<string, string>,
    readonly cwd?: string,
    // For sse transport
    readonly url?: string,
    // For streamable http transport
    readonly httpUrl?: string,
    readonly headers?: Record<string, string>,
    // For websocket transport
    readonly tcp?: string,
    // Common
    readonly timeout?: number,
    readonly trust?: boolean,
    // Metadata
    readonly description?: string,
    readonly includeTools?: string[],
    readonly excludeTools?: string[],
    readonly extensionName?: string,
    // OAuth configuration
    readonly oauth?: MCPOAuthConfig,
  ) {}
}

export interface SandboxConfig {
  command: 'docker' | 'podman' | 'sandbox-exec';
  image: string;
}

export type FlashFallbackHandler = (
  currentModel: string,
  fallbackModel: string,
  error?: unknown,
) => Promise<boolean | string | null>;

export interface TrustedDirsConfig {
  /** List of directories where all tool operations are trusted */
  directories: string[];
  /** Whether to recursively trust subdirectories */
  recursive?: boolean;
  /** Description for logging/debugging purposes */
  description?: string;
}

export interface ConfigParameters {
  sessionId: string;
  embeddingModel?: string;
  sandbox?: SandboxConfig;
  targetDir: string;
  debugMode: boolean;
  question?: string;
  fullContext?: boolean;
  coreTools?: string[];
  excludeTools?: string[];
  toolDiscoveryCommand?: string;
  toolCallCommand?: string;
  mcpServerCommand?: string;
  mcpServers?: Record<string, MCPServerConfig>;
  userMemory?: string;
  geminiMdFileCount?: number;
  approvalMode?: ApprovalMode;
  showMemoryUsage?: boolean;
  contextFileName?: string | string[];
  accessibility?: AccessibilitySettings;
  telemetry?: TelemetrySettings;
  usageStatisticsEnabled?: boolean;
  fileFiltering?: {
    respectGitIgnore?: boolean;
    respectuevoignore?: boolean;
    enableRecursiveFileSearch?: boolean;
  };
  checkpointing?: boolean;
  proxy?: string;
  cwd: string;
  fileDiscoveryService?: FileDiscoveryService;
  bugCommand?: BugCommandSettings;
  model: string;
  extensionContextFilePaths?: string[];
  maxSessionTurns?: number;
  experimentalAcp?: boolean;
  listExtensions?: boolean;
  extensions?: GeminiCLIExtension[];
  blockedMcpServers?: Array<{ name: string; extensionName: string }>;
  noBrowser?: boolean;
  summarizeToolOutput?: Record<string, SummarizeToolOutputSettings>;
  ideMode?: boolean;
  anthropicApiKey?: string;
  trustedDirs?: TrustedDirsConfig;
}

export class Config {
  private toolRegistry!: ToolRegistry;
  private readonly sessionId: string;
  private contentGeneratorConfig!: ContentGeneratorConfig;
  private readonly embeddingModel: string;
  private readonly sandbox: SandboxConfig | undefined;
  private readonly targetDir: string;
  private readonly debugMode: boolean;
  private readonly question: string | undefined;
  private readonly fullContext: boolean;
  private readonly coreTools: string[] | undefined;
  private readonly excludeTools: string[] | undefined;
  private readonly toolDiscoveryCommand: string | undefined;
  private readonly toolCallCommand: string | undefined;
  private readonly mcpServerCommand: string | undefined;
  private readonly mcpServers: Record<string, MCPServerConfig> | undefined;
  private userMemory: string;
  private geminiMdFileCount: number;
  private approvalMode: ApprovalMode;
  private readonly showMemoryUsage: boolean;
  private readonly accessibility: AccessibilitySettings;
  private readonly telemetrySettings: TelemetrySettings;
  private readonly usageStatisticsEnabled: boolean;

  private readonly fileFiltering: {
    respectGitIgnore: boolean;
    respectuevoignore: boolean;
    enableRecursiveFileSearch: boolean;
  };
  private fileDiscoveryService: FileDiscoveryService | null = null;
  private gitService: GitService | undefined = undefined;
  private readonly checkpointing: boolean;
  private readonly proxy: string | undefined;
  private readonly cwd: string;
  private readonly bugCommand: BugCommandSettings | undefined;
  private readonly model: string;
  private readonly extensionContextFilePaths: string[];
  private readonly noBrowser: boolean;
  private readonly ideMode: boolean;
  private modelSwitchedDuringSession: boolean = false;
  private readonly maxSessionTurns: number;
  private readonly listExtensions: boolean;
  private readonly _extensions: GeminiCLIExtension[];
  private readonly _blockedMcpServers: Array<{
    name: string;
    extensionName: string;
  }>;
  flashFallbackHandler?: FlashFallbackHandler;
  private quotaErrorOccurred: boolean = false;
  private readonly summarizeToolOutput:
    | Record<string, SummarizeToolOutputSettings>
    | undefined;
  private readonly experimentalAcp: boolean = false;
  private anthropicApiKey: string | undefined;
  private readonly trustedDirs: TrustedDirsConfig | undefined;

  constructor(params: ConfigParameters) {
    this.sessionId = params.sessionId;
    this.embeddingModel =
      params.embeddingModel ?? DEFAULT_UEVO_EMBEDDING_MODEL;
    this.sandbox = params.sandbox;
    this.targetDir = path.resolve(params.targetDir);
    this.debugMode = params.debugMode;
    this.question = params.question;
    this.fullContext = params.fullContext ?? false;
    this.coreTools = params.coreTools;
    this.excludeTools = params.excludeTools;
    this.toolDiscoveryCommand = params.toolDiscoveryCommand;
    this.toolCallCommand = params.toolCallCommand;
    this.mcpServerCommand = params.mcpServerCommand;
    this.mcpServers = params.mcpServers;
    this.userMemory = params.userMemory ?? '';
    this.geminiMdFileCount = params.geminiMdFileCount ?? 0;
    this.approvalMode = params.approvalMode ?? ApprovalMode.DEFAULT;
    this.showMemoryUsage = params.showMemoryUsage ?? false;
    this.accessibility = params.accessibility ?? {};
    this.telemetrySettings = {
      enabled: params.telemetry?.enabled ?? false,
      target: params.telemetry?.target ?? DEFAULT_TELEMETRY_TARGET,
      otlpEndpoint: params.telemetry?.otlpEndpoint ?? DEFAULT_OTLP_ENDPOINT,
      logPrompts: params.telemetry?.logPrompts ?? true,
      outfile: params.telemetry?.outfile,
    };
    this.usageStatisticsEnabled = params.usageStatisticsEnabled ?? true;

    this.fileFiltering = {
      respectGitIgnore: params.fileFiltering?.respectGitIgnore ?? true,
      respectuevoignore: params.fileFiltering?.respectuevoignore ?? true,
      enableRecursiveFileSearch:
        params.fileFiltering?.enableRecursiveFileSearch ?? true,
    };
    this.checkpointing = params.checkpointing ?? false;
    this.proxy = params.proxy;
    this.cwd = params.cwd ?? process.cwd();
    this.fileDiscoveryService = params.fileDiscoveryService ?? null;
    this.bugCommand = params.bugCommand;
    this.model = params.model;
    this.extensionContextFilePaths = params.extensionContextFilePaths ?? [];
    this.maxSessionTurns = params.maxSessionTurns ?? -1;
    this.experimentalAcp = params.experimentalAcp ?? false;
    this.listExtensions = params.listExtensions ?? false;
    this._extensions = params.extensions ?? [];
    this._blockedMcpServers = params.blockedMcpServers ?? [];
    this.noBrowser = params.noBrowser ?? false;
    this.summarizeToolOutput = params.summarizeToolOutput;
    this.ideMode = params.ideMode ?? false;
    this.anthropicApiKey = params.anthropicApiKey;
    this.trustedDirs = params.trustedDirs;

    if (params.contextFileName) {
      setGeminiMdFilename(params.contextFileName);
    }

    if (this.telemetrySettings.enabled) {
      initializeTelemetry(this);
    }

    if (this.usageStatisticsEnabled) {
      ClearcutLogger.getInstance(this)?.logStartSessionEvent(
        new StartSessionEvent(this),
      );
    } else {
      console.log('Data collection is disabled.');
    }
  }

  async initialize(): Promise<void> {
    // Initialize centralized FileDiscoveryService
    this.getFileService();
    if (this.checkpointing) {
      await this.getGitService();
    }
    this.toolRegistry = await this.createToolRegistry();
    
    // Initialize AI client if content generator config is available
    if (this.contentGeneratorConfig) {
      const client = this.getAIClient();
      if (client && typeof client.initialize === 'function') {
        await client.initialize(this.contentGeneratorConfig);
      }
    }
  }

  async refreshAuth(authMethod: AuthType) {
    this.contentGeneratorConfig = createContentGeneratorConfig(
      this,
      authMethod,
    );

    if (authMethod === AuthType.USE_ANTHROPIC) {
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      if (anthropicApiKey) {
        this.anthropicApiKey = anthropicApiKey;
        console.log(`[Config] ✅ Anthropic API密钥已配置，长度: ${anthropicApiKey.length}`);
      } else {
        throw new Error('ANTHROPIC_API_KEY environment variable not found');
      }
    }

    this.geminiClient = new GeminiClient(this);
    await this.geminiClient.initialize(this.contentGeneratorConfig);

    // Reset the session flag since we're explicitly changing auth and using default model
    this.modelSwitchedDuringSession = false;
    
    console.log(`[Config] ✅ 认证刷新完成，认证类型: ${authMethod}`);
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getContentGeneratorConfig(): ContentGeneratorConfig {
    return this.contentGeneratorConfig;
  }

  getModel(): string {
    return this.contentGeneratorConfig?.model || this.model;
  }

  setModel(newModel: string): void {
    if (this.contentGeneratorConfig) {
      this.contentGeneratorConfig.model = newModel;
      this.modelSwitchedDuringSession = true;
      
      // 重新初始化工具注册表以适应新模型
      this.createToolRegistry().then(registry => {
        this.toolRegistry = registry;
        console.log(`[Config] 模型切换到 ${newModel}，工具注册表已重新初始化`);
      }).catch(error => {
        console.error(`[Config] 重新初始化工具注册表失败:`, error);
      });
    }
  }

  isModelSwitchedDuringSession(): boolean {
    return this.modelSwitchedDuringSession;
  }

  resetModelToDefault(): void {
    if (this.contentGeneratorConfig) {
      this.contentGeneratorConfig.model = this.model;
      this.modelSwitchedDuringSession = false;
    }
  }

  setFlashFallbackHandler(handler: FlashFallbackHandler): void {
    this.flashFallbackHandler = handler;
  }

  getMaxSessionTurns(): number {
    return this.maxSessionTurns;
  }

  setQuotaErrorOccurred(value: boolean): void {
    this.quotaErrorOccurred = value;
  }

  getQuotaErrorOccurred(): boolean {
    return this.quotaErrorOccurred;
  }

  getEmbeddingModel(): string {
    return this.embeddingModel;
  }

  getSandbox(): SandboxConfig | undefined {
    return this.sandbox;
  }

  getTargetDir(): string {
    return this.targetDir;
  }

  getProjectRoot(): string {
    return this.targetDir;
  }

  getToolRegistry(): Promise<ToolRegistry> {
    return Promise.resolve(this.toolRegistry);
  }

  getDebugMode(): boolean {
    return this.debugMode;
  }

  getQuestion(): string | undefined {
    return this.question;
  }

  getFullContext(): boolean {
    return this.fullContext;
  }

  getCoreTools(): string[] | undefined {
    return this.coreTools;
  }

  getExcludeTools(): string[] | undefined {
    return this.excludeTools;
  }

  getToolDiscoveryCommand(): string | undefined {
    return this.toolDiscoveryCommand;
  }

  getToolCallCommand(): string | undefined {
    return this.toolCallCommand;
  }

  getMcpServerCommand(): string | undefined {
    return this.mcpServerCommand;
  }

  getMcpServers(): Record<string, MCPServerConfig> | undefined {
    return this.mcpServers;
  }

  getUserMemory(): string {
    return this.userMemory;
  }

  setUserMemory(newUserMemory: string): void {
    this.userMemory = newUserMemory;
  }

  getGeminiMdFileCount(): number {
    return this.geminiMdFileCount;
  }

  setGeminiMdFileCount(count: number): void {
    this.geminiMdFileCount = count;
  }

  getApprovalMode(): ApprovalMode {
    return this.approvalMode;
  }

  setApprovalMode(mode: ApprovalMode): void {
    this.approvalMode = mode;
  }

  getShowMemoryUsage(): boolean {
    return this.showMemoryUsage;
  }

  getAccessibility(): AccessibilitySettings {
    return this.accessibility;
  }

  getTelemetryEnabled(): boolean {
    return this.telemetrySettings.enabled ?? false;
  }

  getTelemetryLogPromptsEnabled(): boolean {
    return this.telemetrySettings.logPrompts ?? true;
  }

  getTelemetryOtlpEndpoint(): string {
    return this.telemetrySettings.otlpEndpoint ?? DEFAULT_OTLP_ENDPOINT;
  }

  getTelemetryTarget(): TelemetryTarget {
    return this.telemetrySettings.target ?? DEFAULT_TELEMETRY_TARGET;
  }

  getTelemetryOutfile(): string | undefined {
    return this.telemetrySettings.outfile;
  }

  getGeminiDir(): string {
    return path.join(this.targetDir, GEMINI_DIR);
  }

  getProjectTempDir(): string {
    return getProjectTempDir(this.getProjectRoot());
  }

  getEnableRecursiveFileSearch(): boolean {
    return this.fileFiltering.enableRecursiveFileSearch;
  }

  getFileFilteringRespectGitIgnore(): boolean {
    return this.fileFiltering.respectGitIgnore;
  }

  getFileFilteringRespectuevoignore(): boolean {
    return this.fileFiltering.respectuevoignore;
  }

  getFileFilteringOptions(): FileFilteringOptions {
    return {
      respectGitIgnore: this.fileFiltering.respectGitIgnore,
      respectuevoignore: this.fileFiltering.respectuevoignore,
    };
  }

  getCheckpointingEnabled(): boolean {
    return this.checkpointing;
  }

  getProxy(): string | undefined {
    return this.proxy;
  }

  getWorkingDir(): string {
    return this.cwd;
  }

  getBugCommand(): BugCommandSettings | undefined {
    return this.bugCommand;
  }

  getFileService(): FileDiscoveryService {
    if (!this.fileDiscoveryService) {
      this.fileDiscoveryService = new FileDiscoveryService(this.targetDir);
    }
    return this.fileDiscoveryService;
  }

  getUsageStatisticsEnabled(): boolean {
    return this.usageStatisticsEnabled;
  }

  getExtensionContextFilePaths(): string[] {
    return this.extensionContextFilePaths;
  }

  getExperimentalAcp(): boolean {
    return this.experimentalAcp;
  }

  getListExtensions(): boolean {
    return this.listExtensions;
  }

  getExtensions(): GeminiCLIExtension[] {
    return this._extensions;
  }

  getBlockedMcpServers(): Array<{ name: string; extensionName: string }> {
    return this._blockedMcpServers;
  }

  getNoBrowser(): boolean {
    return this.noBrowser;
  }

  isBrowserLaunchSuppressed(): boolean {
    return this.getNoBrowser() || !shouldAttemptBrowserLaunch();
  }

  getSummarizeToolOutputConfig():
    | Record<string, SummarizeToolOutputSettings>
    | undefined {
    return this.summarizeToolOutput;
  }

  getIdeMode(): boolean {
    return this.ideMode;
  }

  async getGitService(): Promise<GitService> {
    if (!this.gitService) {
      this.gitService = new GitService(this.targetDir);
      await this.gitService.initialize();
    }
    return this.gitService;
  }

  async createToolRegistry(): Promise<ToolRegistry> {
    const registry = new ToolRegistry(this);

    const registerCoreTool = (ToolClass: any, ...args: unknown[]) => {
      const className = ToolClass.name;
      const toolName = ToolClass.Name || className;
      const coreTools = this.getCoreTools();
      const excludeTools = this.getExcludeTools();

      let isEnabled = false;
      if (coreTools === undefined) {
        isEnabled = true;
      } else {
        isEnabled = coreTools.some(
          (tool) =>
            tool === className ||
            tool === toolName ||
            tool.startsWith(`${className}(`) ||
            tool.startsWith(`${toolName}(`),
        );
      }

      if (
        excludeTools?.includes(className) ||
        excludeTools?.includes(toolName)
      ) {
        isEnabled = false;
      }

      if (isEnabled) {
        registry.registerTool(new ToolClass(...args));
      }
    };

    registerCoreTool(LSTool, this);
    registerCoreTool(ReadFileTool, this);
    registerCoreTool(GrepTool, this);
    registerCoreTool(GlobTool, this);
    registerCoreTool(EditTool, this);
    registerCoreTool(WriteFileTool, this);
    registerCoreTool(WebFetchTool, this);
    registerCoreTool(ReadManyFilesTool, this);
    
    // 根据模型类型选择不同的shell工具
    const currentModel = this.getModel();
    const isClaudeModel = currentModel && currentModel.toLowerCase().includes('claude');
    
    if (isClaudeModel) {
      console.log(`[Config] 检测到Claude模型 (${currentModel})，使用Claude专用Shell工具`);
      registerCoreTool(ClaudeShellTool, this);
    } else {
      console.log(`[Config] 检测到非Claude模型 (${currentModel})，使用标准Shell工具`);
      registerCoreTool(ShellTool, this);
    }
    
    registerCoreTool(MemoryTool);
    
    // 使用增强版 WebSearchTool（集成缓存功能）
    registerCoreTool(EnhancedWebSearchTool, this);
    
    // 注册原版 WebSearchTool（作为备用）
    registerCoreTool(WebSearchTool, this);

    await registry.discoverTools();
    return registry;
  }

  getAIClient(): GeminiClient {
    if (!this.geminiClient) {
      this.geminiClient = new GeminiClient(this);
    }
    return this.geminiClient;
  }

  getGeminiClient(): GeminiClient {
    if (!this.geminiClient) {
      this.geminiClient = new GeminiClient(this);
    }
    return this.geminiClient!;
  }

  getSmartAIClient(): GeminiClient {
    return this.getAIClient();
  }

  getModelInfo(modelName: string = this.getModel()): {
    provider: string;
    envVar: string;
    isConfigured: boolean;
    providerName: string;
  } {
    try {
      return getModelInfoFromMapping(modelName);
    } catch (error) {
      return {
        provider: 'gemini',
        envVar: 'GEMINI_API_KEY',
        isConfigured: !!process.env.GEMINI_API_KEY,
        providerName: 'Google Gemini',
      };
    }
  }

  getAnthropicApiKey(): string | undefined {
    return this.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  }

  setAnthropicApiKey(apiKey: string): void {
    this.anthropicApiKey = apiKey;
  }

  /**
   * 获取可信目录配置
   */
  getTrustedDirs(): TrustedDirsConfig | undefined {
    return this.trustedDirs;
  }

  /**
   * 检查给定路径是否在可信目录中
   * @param filePath 要检查的文件路径
   * @returns 如果路径在可信目录中返回true，否则返回false
   */
  isPathInTrustedDirs(filePath: string): boolean {
    if (!this.trustedDirs || !this.trustedDirs.directories.length) {
      return false;
    }

    const normalizedPath = path.resolve(filePath);
    
    for (const trustedDir of this.trustedDirs.directories) {
      const normalizedTrustedDir = path.resolve(trustedDir);
      
      if (this.trustedDirs.recursive !== false) {
        // 默认递归检查子目录
        if (normalizedPath.startsWith(normalizedTrustedDir + path.sep) || 
            normalizedPath === normalizedTrustedDir) {
          return true;
        }
      } else {
        // 仅检查直接匹配
        if (normalizedPath === normalizedTrustedDir) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 检查当前工作目录是否在可信目录中
   * @returns 如果当前工作目录在可信目录中返回true，否则返回false
   */
  isCurrentDirTrusted(): boolean {
    return this.isPathInTrustedDirs(this.getWorkingDir());
  }

  private geminiClient?: GeminiClient;
  // private smartAIClient?: any; // 不再使用SmartAIClient
}

// Export model constants for use in CLI
export { DEFAULT_UEVO_FLASH_MODEL };
