import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface for translatable strings extracted from files
 */
export interface TranslatableString {
  id: string;
  key?: string;
  originalText: string;
  context?: string;
  sourceFile: string;
  lineNumber?: number;
  category?: 'dialogue' | 'ui' | 'item' | 'quest' | 'tutorial' | 'generic';
}

/**
 * Base interface for asset processors
 */
export interface IAssetProcessor {
  supports(extension: string): boolean;
  process(filePath: string): Promise<TranslatableString[]>;
}

/**
 * Registry for asset processors
 */
export class AssetProcessorRegistry {
  private processors: IAssetProcessor[] = [];

  register(processor: IAssetProcessor): void {
    this.processors.push(processor);
  }

  getProcessor(extension: string): IAssetProcessor | null {
    return this.processors.find(p => p.supports(extension)) || null;
  }
}

// Global registry instance
export const registry = new AssetProcessorRegistry();

/**
 * JSON Asset Processor - Handles JSON files with game text
 */
export class JsonAssetProcessor implements IAssetProcessor {
  supports(extension: string): boolean {
    return extension.toLowerCase() === '.json';
  }

  async process(filePath: string): Promise<TranslatableString[]> {
    const strings: TranslatableString[] = [];
    const fileName = path.basename(filePath);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      // Recursively extract strings from JSON
      this.extractStringsFromObject(data, '', strings, fileName);
      
    } catch (error) {
      console.error(`[JsonProcessor] Error parsing ${filePath}:`, error);
    }
    
    return strings;
  }

  private extractStringsFromObject(
    obj: any, 
    currentPath: string, 
    strings: TranslatableString[], 
    sourceFile: string
  ): void {
    if (typeof obj === 'string' && this.isValidText(obj)) {
      strings.push({
        id: `${sourceFile}_${strings.length}`,
        key: currentPath,
        originalText: obj,
        sourceFile: sourceFile,
        category: this.detectCategory(currentPath, obj)
      });
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.extractStringsFromObject(item, `${currentPath}[${index}]`, strings, sourceFile);
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        this.extractStringsFromObject(value, newPath, strings, sourceFile);
      });
    }
  }

  private isValidText(text: string): boolean {
    // Same aggressive filters as main.ts isRealGameText
    if (!text || text.length < 5 || text.length > 500) return false;
    
    const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
    if (letterCount < 3) return false;
    
    // CRITICAL: Exclude Unity/Technical content
    if (text.includes('::')) return false; // C++ method
    if (/\w+\.\w+\.\w+/.test(text) && text.includes('(')) return false; // Method call
    if (text.startsWith('UnityEngine.')) return false;
    if (text.startsWith('Unity.')) return false;
    if (text.startsWith('System.')) return false;
    if (text.startsWith('Mono.')) return false;
    if (text.includes('PublicKeyToken=')) return false;
    if (text.includes('mscorlib')) return false;
    if (text.includes('Version=') && text.includes('Culture=')) return false;
    if (text.includes('Version=') && text.includes('PublicKeyToken=')) return false;
    if (text.includes('ResourceManagement')) return false; // Unity Addressables
    if (text.includes('ResourceProviders')) return false;
    if (text.includes('SceneProvider') || text.includes('InstanceProvider')) return false;
    
    // Hex/ID patterns
    if (/^[0-9a-f]{16,}$/i.test(text)) return false;
    
    // Variable names (camelCase/PascalCase without spaces)
    if (/^[A-Z][a-z]+[A-Z]/.test(text) && !text.includes(' ')) return false;
    if (/^[a-z]+[A-Z]/.test(text) && !text.includes(' ')) return false;
    
    // Too many dots (namespace path)
    const dotCount = (text.match(/\./g) || []).length;
    if (dotCount > 3 && letterCount < 20) return false;
    
    // No spaces at all (single identifier)
    if (!text.includes(' ') && letterCount < 15) return false;
    
    // Mostly non-alphabetic
    const nonAlphaRatio = (text.length - letterCount) / text.length;
    if (nonAlphaRatio > 0.5) return false;
    
    // URLs/paths
    if (text.startsWith('http') || text.includes('://')) return false;
    if (text.includes('Assets/') || text.includes('Resources/')) return false;
    
    // Must look like natural language
    const hasSentenceStructure = /[.!?]$/.test(text) || 
                                  text.includes(' the ') || 
                                  text.includes(' you ') ||
                                  text.includes(' and ') ||
                                  text.includes(' The ') ||
                                  text.includes('Hello') ||
                                  text.includes('Welcome') ||
                                  text.includes('Click') ||
                                  text.includes('Press') ||
                                  text.includes(' to ') ||
                                  text.includes(' a ') ||
                                  text.includes(' is ');
    
    if (!hasSentenceStructure && letterCount < 15) return false;
    
    return true;
  }

  private detectCategory(key: string, text: string): TranslatableString['category'] {
    const lowerKey = key.toLowerCase();
    const lowerText = text.toLowerCase();
    
    if (lowerKey.includes('dialog') || lowerKey.includes('conversation') || lowerText.includes('"')) {
      return 'dialogue';
    }
    if (lowerKey.includes('ui') || lowerKey.includes('button') || lowerKey.includes('menu') || lowerKey.includes('title')) {
      return 'ui';
    }
    if (lowerKey.includes('item') || lowerKey.includes('weapon') || lowerKey.includes('armor')) {
      return 'item';
    }
    if (lowerKey.includes('quest') || lowerKey.includes('mission') || lowerKey.includes('objective')) {
      return 'quest';
    }
    if (lowerKey.includes('tutorial') || lowerKey.includes('help') || lowerKey.includes('hint')) {
      return 'tutorial';
    }
    
    return 'generic';
  }
}

/**
 * CSV Asset Processor - Handles CSV files with game text
 */
export class CsvAssetProcessor implements IAssetProcessor {
  supports(extension: string): boolean {
    return extension.toLowerCase() === '.csv';
  }

  async process(filePath: string): Promise<TranslatableString[]> {
    const strings: TranslatableString[] = [];
    const fileName = path.basename(filePath);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      // Try to detect if first row is headers
      const headers = this.parseCSVLine(lines[0]);
      const startRow = headers.length > 0 && isNaN(Number(headers[0])) ? 1 : 0;
      
      for (let i = startRow; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const columns = this.parseCSVLine(line);
        
        columns.forEach((col, colIndex) => {
          if (this.isValidText(col)) {
            const key = startRow === 1 && headers[colIndex] 
              ? headers[colIndex] 
              : `col_${colIndex}`;
            
            strings.push({
              id: `${fileName}_${i}_${colIndex}`,
              key: key,
              originalText: col,
              sourceFile: fileName,
              lineNumber: i + 1,
              category: this.detectCategory(key, col)
            });
          }
        });
      }
      
    } catch (error) {
      console.error(`[CsvProcessor] Error parsing ${filePath}:`, error);
    }
    
    return strings;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  private isValidText(text: string): boolean {
    // Same aggressive filters
    if (!text || text.length < 5 || text.length > 500) return false;
    
    const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
    if (letterCount < 3) return false;
    
    if (text.match(/^\d+$/)) return false; // just numbers
    
    // Unity/Technical exclusions
    if (text.includes('UnityEngine.')) return false;
    if (text.includes('Unity.')) return false;
    if (text.includes('System.')) return false;
    if (text.includes('PublicKeyToken=')) return false;
    if (text.includes('Version=') && text.includes('Culture=')) return false;
    if (text.includes('ResourceManagement')) return false;
    if (text.includes('ResourceProviders')) return false;
    if (text.includes('SceneProvider') || text.includes('InstanceProvider')) return false;
    
    // Must look like natural language
    const hasSentenceStructure = /[.!?]$/.test(text) || 
                                  text.includes(' ') ||
                                  text.includes('Hello') ||
                                  text.includes('Welcome') ||
                                  text.includes(' the ');
    
    if (!hasSentenceStructure && letterCount < 10) return false;
    
    return true;
  }

  private detectCategory(key: string, text: string): TranslatableString['category'] {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('dialog') || lowerKey.includes('text')) return 'dialogue';
    if (lowerKey.includes('ui') || lowerKey.includes('menu')) return 'ui';
    if (lowerKey.includes('item')) return 'item';
    if (lowerKey.includes('quest')) return 'quest';
    return 'generic';
  }
}

/**
 * XML Asset Processor - Handles XML files with game text
 */
export class XmlAssetProcessor implements IAssetProcessor {
  supports(extension: string): boolean {
    return extension.toLowerCase() === '.xml';
  }

  async process(filePath: string): Promise<TranslatableString[]> {
    const strings: TranslatableString[] = [];
    const fileName = path.basename(filePath);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Simple regex-based extraction for now
      // In production, use a proper XML parser
      const textContentRegex = /<([^>]+)>([^<]{3,})<\/[^>]+>/g;
      let match;
      let index = 0;
      
      while ((match = textContentRegex.exec(content)) !== null) {
        const tag = match[1].split(' ')[0]; // Get tag name without attributes
        const text = match[2].trim();
        
        if (this.isValidText(text)) {
          strings.push({
            id: `${fileName}_${index++}`,
            key: tag,
            originalText: text,
            sourceFile: fileName,
            category: this.detectCategory(tag, text)
          });
        }
      }
      
    } catch (error) {
      console.error(`[XmlProcessor] Error parsing ${filePath}:`, error);
    }
    
    return strings;
  }

  private isValidText(text: string): boolean {
    if (!text || text.length < 5 || text.length > 500) return false;
    
    const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
    if (letterCount < 3) return false;
    
    // Skip if only whitespace or numbers
    if (text.replace(/\s/g, '').match(/^\d+$/)) return false;
    
    // Unity/Technical exclusions
    if (text.includes('UnityEngine.')) return false;
    if (text.includes('Unity.')) return false;
    if (text.includes('System.')) return false;
    if (text.includes('PublicKeyToken=')) return false;
    if (text.includes('Version=') && text.includes('Culture=')) return false;
    if (text.includes('ResourceManagement')) return false;
    if (text.includes('ResourceProviders')) return false;
    if (text.includes('SceneProvider') || text.includes('InstanceProvider')) return false;
    
    // Must look like natural language
    const hasSentenceStructure = /[.!?]$/.test(text) || 
                                  text.includes(' ') ||
                                  text.includes('Hello') ||
                                  text.includes('Welcome') ||
                                  text.includes(' the ');
    
    if (!hasSentenceStructure && letterCount < 10) return false;
    
    return true;
  }

  private detectCategory(tag: string, text: string): TranslatableString['category'] {
    const lowerTag = tag.toLowerCase();
    if (lowerTag.includes('dialog') || lowerTag.includes('speech')) return 'dialogue';
    if (lowerTag.includes('ui') || lowerTag.includes('button') || lowerTag.includes('label')) return 'ui';
    if (lowerTag.includes('item')) return 'item';
    if (lowerTag.includes('quest')) return 'quest';
    return 'generic';
  }
}

/**
 * Text Asset Processor - Handles plain text files
 */
export class TextAssetProcessor implements IAssetProcessor {
  supports(extension: string): boolean {
    return extension.toLowerCase() === '.txt';
  }

  async process(filePath: string): Promise<TranslatableString[]> {
    const strings: TranslatableString[] = [];
    const fileName = path.basename(filePath);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (this.isValidText(trimmed)) {
          strings.push({
            id: `${fileName}_${index}`,
            originalText: trimmed,
            sourceFile: fileName,
            lineNumber: index + 1,
            category: 'generic'
          });
        }
      });
      
    } catch (error) {
      console.error(`[TextProcessor] Error parsing ${filePath}:`, error);
    }
    
    return strings;
  }

  private isValidText(text: string): boolean {
    // Skip empty lines
    if (!text || text.length < 5 || text.length > 500) return false;
    
    const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
    if (letterCount < 3) return false;
    
    // Skip comment lines
    if (text.startsWith('//') || text.startsWith('#') || text.startsWith(';')) return false;
    
    // Skip if looks like code
    if (text.startsWith('using ') || text.startsWith('namespace ') || text.startsWith('class ')) return false;
    
    // Unity/Technical exclusions
    if (text.includes('UnityEngine.')) return false;
    if (text.includes('Unity.')) return false;
    if (text.includes('System.')) return false;
    if (text.includes('PublicKeyToken=')) return false;
    if (text.includes('Version=') && text.includes('Culture=')) return false;
    if (text.includes('ResourceManagement')) return false;
    if (text.includes('ResourceProviders')) return false;
    if (text.includes('SceneProvider') || text.includes('InstanceProvider')) return false;
    
    // Must look like natural language or have reasonable content
    const hasSentenceStructure = /[.!?]$/.test(text) || 
                                  text.includes(' ') ||
                                  text.length > 20;
    
    if (!hasSentenceStructure && letterCount < 10) return false;
    
    return true;
  }
}

// Register all processors
registry.register(new JsonAssetProcessor());
registry.register(new CsvAssetProcessor());
registry.register(new XmlAssetProcessor());
registry.register(new TextAssetProcessor());

/**
 * Process a file using the appropriate processor
 */
export async function processFile(filePath: string): Promise<TranslatableString[]> {
  const ext = path.extname(filePath);
  const processor = registry.getProcessor(ext);
  
  if (processor) {
    console.log(`[Processor] Using ${processor.constructor.name} for ${path.basename(filePath)}`);
    return processor.process(filePath);
  }
  
  console.log(`[Processor] No processor found for ${ext}`);
  return [];
}
