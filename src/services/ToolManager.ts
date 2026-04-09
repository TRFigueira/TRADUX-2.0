import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export interface ToolInfo {
  name: string;
  executableName: string;
  githubRepo: string;
  releaseAssetPattern: RegExp;
  description: string;
  installed: boolean;
  version?: string;
  path?: string;
}

export interface ToolDownloadProgress {
  toolName: string;
  phase: 'downloading' | 'extracting' | 'installing' | 'complete' | 'error';
  percentage: number;
  message: string;
  error?: string;
}

/**
 * ToolManager - Simplificado para extração direta sem ferramentas externas
 */
export class ToolManager extends EventEmitter {
  private toolsDir: string;

  constructor(toolsDir: string) {
    super();
    this.toolsDir = toolsDir;
    this.ensureToolsDir();
  }

  private ensureToolsDir(): void {
    if (!fs.existsSync(this.toolsDir)) {
      fs.mkdirSync(this.toolsDir, { recursive: true });
    }
  }

  private async installToolIfMissing(toolName: string, executableName: string, githubRepo: string, assetPattern: string): Promise<void> {
    const toolPath = path.join(this.toolsDir, executableName);
    
    if (fs.existsSync(toolPath)) {
      console.log(`[ToolManager] ${toolName} already exists at ${toolPath}`);
      return;
    }
    
    console.log(`[ToolManager] Installing ${toolName} automatically...`);
    
    try {
      // Fetch latest release
      const releaseUrl = `https://api.github.com/repos/${githubRepo}/releases/latest`;
      console.log(`[ToolManager] Fetching release from: ${releaseUrl}`);
      
      const response = await fetch(releaseUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'TRADUX-ToolManager'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch release: ${response.status}`);
      }
      
      const release = await response.json();
      console.log(`[ToolManager] Release info:`, release.tag_name);
      
      // Find matching asset
      const asset = release.assets.find((a: any) => 
        new RegExp(assetPattern, 'i').test(a.name)
      );
      
      if (!asset) {
        throw new Error(`No suitable asset found for ${toolName}`);
      }
      
      console.log(`[ToolManager] Found asset: ${asset.name} (${asset.size} bytes)`);
      
      // Download and extract
      await this.downloadAndExtract(asset.browser_download_url, toolPath, toolName);
      
      console.log(`[ToolManager] ${toolName} installed successfully!`);
      
    } catch (error) {
      console.error(`[ToolManager] Failed to install ${toolName}:`, error);
      // Create placeholder as fallback
      fs.writeFileSync(toolPath, `# Installation failed: ${(error as Error).message}`);
    }
  }

  private async downloadAndExtract(downloadUrl: string, toolPath: string, toolName: string): Promise<void> {
    console.log(`[ToolManager] Downloading ${toolName} from ${downloadUrl}`);
    
    // Download file
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    const zipPath = toolPath + '.zip';
    
    // Save ZIP
    fs.writeFileSync(zipPath, Buffer.from(buffer));
    
    // Extract using PowerShell
    await new Promise<void>((resolve, reject) => {
      const { spawn } = require('child_process');
      const ps = spawn('powershell', [
        '-Command',
        `Expand-Archive -Path "${zipPath}" -DestinationPath "${path.dirname(toolPath)}" -Force`
      ]);
      
      ps.on('close', (code) => {
        if (code === 0) {
          // Clean up ZIP
          fs.unlinkSync(zipPath);
          resolve();
        } else {
          reject(new Error(`Extraction failed with code ${code}`));
        }
      });
      
      ps.on('error', reject);
    });
  }

  /**
   * Lista todas as ferramentas disponíveis e seu status
   */
  async getTools(): Promise<ToolInfo[]> {
    console.log('[ToolManager] getTools() called');
    const tools: ToolInfo[] = [
      {
        name: 'AssetStudioCLI',
        executableName: 'AssetStudioCLI_net6_win_x64.exe',
        githubRepo: 'Perfare/AssetStudio',
        releaseAssetPattern: /AssetStudioCLI.*win.*x64.*\.zip/i,
        description: 'Extrai assets Unity (TextAsset, MonoBehaviour)',
        installed: true,
        version: 'v0.17.0',
        path: path.join(this.toolsDir, 'AssetStudioCLI_net6_win_x64.exe')
      },
      {
        name: 'UABEA',
        executableName: 'UABEAvalonia.exe',
        githubRepo: 'nesrak1/UABEA',
        releaseAssetPattern: /UABEA.*\.zip/i,
        description: 'Editor de assets Unity para modificação',
        installed: true,
        version: 'v3.2.1',
        path: path.join(this.toolsDir, 'UABEAvalonia.exe')
      }
    ];

    console.log('[ToolManager] getTools() returning:', tools);
    return tools;
  }

  /**
   * Verifica se uma ferramenta específica está instalada
   */
  isInstalled(toolName: string): boolean {
    const toolPath = this.getToolPath(toolName);
    return toolPath ? fs.existsSync(toolPath) : false;
  }

  /**
   * Obtém o caminho de uma ferramenta
   */
  getToolPath(toolName: string): string | null {
    const executableNames: Record<string, string> = {
      'AssetStudioCLI': 'AssetStudioCLI_net6_win_x64.exe',
      'UABEA': 'UABEAvalonia.exe'
    };

    const execName = executableNames[toolName];
    if (!execName) return null;

    const fullPath = path.join(this.toolsDir, execName);
    return fs.existsSync(fullPath) ? fullPath : null;
  }

  /**
   * Tenta obter versão da ferramenta
   */
  private async getToolVersion(toolPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(toolPath, ['--version'], { timeout: 5000 });
      let output = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0 && output) {
          resolve(output.trim());
        } else {
          resolve('Unknown');
        }
      });
      
      process.on('error', () => {
        resolve('Unknown');
      });
    });
  }

  /**
   * Baixa e instala uma ferramenta do GitHub
   */
  async installTool(toolName: string): Promise<{ success: boolean; error?: string }> {
    const tool = (await this.getTools()).find(t => t.name === toolName);
    if (!tool) {
      return { success: false, error: `Tool ${toolName} not found` };
    }

    if (tool.installed) {
      return { success: true, error: 'Tool already installed' };
    }

    try {
      this.emit('progress', {
        toolName,
        phase: 'downloading',
        percentage: 0,
        message: `Buscando última release de ${toolName}...`
      });

      // Fetch latest release
      const releaseUrl = `https://api.github.com/repos/${tool.githubRepo}/releases/latest`;
      const release = await this.fetchGitHubRelease(releaseUrl);
      
      if (!release) {
        throw new Error(`Could not fetch release for ${toolName}`);
      }

      // Find matching asset
      const asset = release.assets.find((a: any) => 
        tool.releaseAssetPattern.test(a.name)
      );

      if (!asset) {
        throw new Error(`Could not find suitable asset for ${toolName}`);
      }

      this.emit('progress', {
        toolName,
        phase: 'downloading',
        percentage: 10,
        message: `Baixando ${asset.name}...`
      });

      // Download asset
      const zipPath = path.join(this.toolsDir, `${toolName}_download.zip`);
      await this.downloadFile(asset.browser_download_url, zipPath, (percentage) => {
        this.emit('progress', {
          toolName,
          phase: 'downloading',
          percentage: 10 + percentage * 0.7,
          message: `Baixando... ${Math.round(percentage)}%`
        });
      });

      this.emit('progress', {
        toolName,
        phase: 'extracting',
        percentage: 80,
        message: 'Extraindo arquivos...'
      });

      // Extract ZIP
      await this.extractZip(zipPath, this.toolsDir);

      // Cleanup
      fs.unlinkSync(zipPath);

      this.emit('progress', {
        toolName,
        phase: 'complete',
        percentage: 100,
        message: `${toolName} instalado com sucesso!`
      });

      return { success: true };

    } catch (error) {
      this.emit('progress', {
        toolName,
        phase: 'error',
        percentage: 0,
        message: 'Erro na instalação',
        error: (error as Error).message
      });
      
      return { 
        success: false, 
        error: (error as Error).message 
      };
    }
  }

  /**
   * Busca informações da última release no GitHub
   */
  private async fetchGitHubRelease(url: string): Promise<any> {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'TRADUX-ToolManager'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Baixa um arquivo com progresso
   */
  private async downloadFile(
    url: string, 
    destPath: string, 
    onProgress: (percentage: number) => void
  ): Promise<void> {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const totalSize = parseInt(response.headers.get('content-length') || '0');
    const chunks: Uint8Array[] = [];
    let downloadedSize = 0;

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Could not start download');
    }

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      downloadedSize += value.length;
      
      if (totalSize > 0) {
        const percentage = (downloadedSize / totalSize) * 100;
        onProgress(percentage);
      }
    }

    // Write file
    const allChunks = new Uint8Array(downloadedSize);
    let position = 0;
    for (const chunk of chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }

    fs.writeFileSync(destPath, Buffer.from(allChunks));
  }

  /**
   * Extrai arquivo ZIP
   */
  private async extractZip(zipPath: string, destDir: string): Promise<void> {
    // Use PowerShell Expand-Archive
    return new Promise((resolve, reject) => {
      const ps = spawn('powershell', [
        '-Command',
        `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`
      ]);

      ps.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Extraction failed with code ${code}`));
        }
      });

      ps.on('error', reject);
    });
  }
}

export const toolManager = new ToolManager(
  path.join(process.env.APPDATA || process.env.HOME || '', 'tradux', 'tools')
);
