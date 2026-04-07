/**
 * Smart Strings Engine - TRADUX 3.0
 * 
 * Implements Unity Localization-style Smart Strings with:
 * - Placeholder resolution: {0}, {param}, {player_name}
 * - CLDR pluralization: {count:plural}
 * - Gender support: {gender:male|female|other}
 * - Conditional logic: {condition:true|false}
 * - Rich text preservation: <color>, <size>, <bold>
 */

export interface SmartStringContext {
  [key: string]: string | number | boolean | PluralValue | GenderValue;
}

export interface PluralValue {
  value: number;
  type: 'plural';
}

export interface GenderValue {
  value: 'male' | 'female' | 'other';
  type: 'gender';
}

export interface PlaceholderInfo {
  name: string;
  index?: number;
  type: 'simple' | 'plural' | 'gender' | 'conditional' | 'rich';
  format?: string;
  options?: string[];
}

export class SmartStringEngine {
  
  /**
   * Parse a smart string and extract placeholder information
   */
  parsePlaceholders(text: string): PlaceholderInfo[] {
    const placeholders: PlaceholderInfo[] = [];
    const regex = /\{([^}]+)\}/g;
    let match: RegExpExecArray | null;
    
    while ((match = regex.exec(text)) !== null) {
      const content = match[1];
      const info = this.parsePlaceholderContent(content);
      placeholders.push(info);
    }
    
    return placeholders;
  }
  
  /**
   * Parse individual placeholder content
   */
  private parsePlaceholderContent(content: string): PlaceholderInfo {
    // Check for plural pattern: {count:plural}
    if (content.includes(':plural')) {
      const [name] = content.split(':');
      return {
        name: name.trim(),
        type: 'plural',
        format: 'plural'
      };
    }
    
    // Check for gender pattern: {gender:male|female|other}
    if (content.includes(':') && content.includes('|')) {
      const [name, options] = content.split(':');
      return {
        name: name.trim(),
        type: 'gender',
        options: options.split('|').map(o => o.trim())
      };
    }
    
    // Check for conditional pattern: {condition:true|false}
    if (content.includes(':') && !content.includes('|')) {
      const [name, value] = content.split(':');
      return {
        name: name.trim(),
        type: 'conditional',
        format: value.trim()
      };
    }
    
    // Check for indexed placeholder: {0}, {1}
    if (/^\d+$/.test(content)) {
      return {
        name: content,
        index: parseInt(content),
        type: 'simple'
      };
    }
    
    // Named placeholder: {player_name}
    return {
      name: content,
      type: 'simple'
    };
  }
  
  /**
   * Resolve a smart string with provided context
   */
  resolve(text: string, context: SmartStringContext, locale: string = 'en'): string {
    // Resolve placeholders
    const result = this.resolvePlaceholders(text, context, locale);
    
    return result;
  }
  
  /**
   * Resolve placeholders in text
   */
  private resolvePlaceholders(text: string, context: SmartStringContext, locale: string): string {
    return text.replace(/\{([^}]+)\}/g, (match: string, content: string) => {
      return this.resolvePlaceholderContent(content, context, locale, match);
    });
  }
  
  /**
   * Resolve individual placeholder content
   */
  private resolvePlaceholderContent(
    content: string, 
    context: SmartStringContext, 
    locale: string,
    originalMatch: string
  ): string {
    // Plural resolution
    if (content.includes(':plural')) {
      const [name] = content.split(':');
      const value = context[name.trim()];
      
      if (value && typeof value === 'object' && 'type' in value && value.type === 'plural') {
        return `{${value.value}:plural}`;
      }
      
      // Fallback: treat as number
      const numValue = Number(value);
      if (!isNaN(numValue)) {
        return `{${numValue}:plural}`;
      }
      
      return originalMatch;
    }
    
    // Gender resolution
    if (content.includes(':') && content.includes('|')) {
      const [name, options] = content.split(':');
      const value = context[name.trim()];
      const optionList = options.split('|').map((o: string) => o.trim());
      
      if (value && typeof value === 'object' && 'type' in value && value.type === 'gender') {
        const index = this.getGenderIndex(value.value);
        return optionList[index] || optionList[optionList.length - 1] || '';
      }
      
      // Fallback: treat as string
      const genderValue = String(value).toLowerCase();
      const index = this.getGenderIndex(genderValue as 'male' | 'female' | 'other');
      return optionList[index] || optionList[optionList.length - 1] || '';
    }
    
    // Conditional resolution
    if (content.includes(':')) {
      const [name, value] = content.split(':');
      const contextValue = context[name.trim()];
      const parts = value.split('|').map((v: string) => v.trim());
      const trueValue = parts[0] || '';
      const falseValue = parts[1] || '';
      
      const isTrue = contextValue === true || 
                     contextValue === 'true' || 
                     contextValue === 1 || 
                     contextValue === '1';
      
      return isTrue ? trueValue : falseValue;
    }
    
    // Simple placeholder resolution
    const key = content;
    
    // Check if it's an indexed placeholder
    if (/^\d+$/.test(content)) {
      const index = parseInt(content);
      // Use index to get value from context by position
      const keys = Object.keys(context);
      if (index >= 0 && index < keys.length) {
        const value = context[keys[index]];
        if (value !== undefined && value !== null) {
          return String(value);
        }
      }
    }
    
    const value = context[key];
    
    if (value === undefined || value === null) {
      return `{${content}}`; // Return original if not found
    }
    
    return String(value);
  }
  
  /**
   * Get gender index for options array
   */
  private getGenderIndex(gender: 'male' | 'female' | 'other'): number {
    switch (gender) {
      case 'male': return 0;
      case 'female': return 1;
      case 'other': return 2;
      default: return 2;
    }
  }
  
  /**
   * Get CLDR plural category for a number and locale
   * 
   * Categories: zero, one, two, few, many, other
   */
  getPluralCategory(count: number, locale: string): 'zero' | 'one' | 'two' | 'few' | 'many' | 'other' {
    // English and most languages
    if (locale === 'en' || locale === 'de' || locale === 'it' || locale === 'es') {
      if (count === 1) return 'one';
      return 'other';
    }
    
    // Portuguese, French
    if (locale === 'pt' || locale === 'pt-BR' || locale === 'fr') {
      if (count >= 0 && count <= 1) return 'one';
      return 'other';
    }
    
    // Russian, Polish, Czech, etc. (Slavic languages)
    if (locale === 'ru' || locale === 'pl' || locale === 'cs' || locale === 'uk') {
      const mod10 = count % 10;
      const mod100 = count % 100;
      
      if (mod10 === 1 && mod100 !== 11) return 'one';
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'few';
      if (mod10 === 0 || (mod10 >= 5 && mod10 <= 9) || (mod100 >= 11 && mod100 <= 19)) return 'many';
      return 'other';
    }
    
    // Arabic
    if (locale === 'ar') {
      if (count === 0) return 'zero';
      if (count === 1) return 'one';
      if (count === 2) return 'two';
      const mod100 = count % 100;
      if (mod100 >= 3 && mod100 <= 10) return 'few';
      if (mod100 >= 11 && mod100 <= 99) return 'many';
      return 'other';
    }
    
    // Japanese, Chinese, Korean (no plural distinction)
    if (locale === 'ja' || locale === 'zh' || locale === 'zh-CN' || locale === 'ko') {
      return 'other';
    }
    
    // Default fallback
    if (count === 1) return 'one';
    return 'other';
  }
  
  /**
   * Format a message with plural support
   * Example: "You have {count} {count:plural:one=item|other=items}"
   */
  formatPlural(message: string, count: number, locale: string = 'en'): string {
    const category = this.getPluralCategory(count, locale);
    
    // Replace {count}
    let result = message.replace(/\{count\}/g, String(count));
    
    // Replace {count:plural:one=X|other=Y}
    result = result.replace(/\{count:plural:([^}]+)\}/g, (match: string, options: string) => {
      const pairs = options.split('|');
      for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key.trim() === category) {
          return value.trim();
        }
      }
      return '';
    });
    
    return result;
  }
  
  /**
   * Validate that all placeholders in text are present in context
   */
  validate(text: string, context: SmartStringContext): { valid: boolean; missing: string[] } {
    const placeholders = this.parsePlaceholders(text);
    const missing: string[] = [];
    
    for (const placeholder of placeholders) {
      const value = context[placeholder.name];
      if (value === undefined || value === null) {
        missing.push(placeholder.name);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing
    };
  }
  
  /**
   * Extract rich text tags from Unity-formatted string
   */
  extractRichText(text: string): { text: string; tags: string[] } {
    const tags: string[] = [];
    const tagRegex = /<([a-zA-Z]+)[^>]*>/g;
    let match: RegExpExecArray | null;
    
    while ((match = tagRegex.exec(text)) !== null) {
      tags.push(match[0]);
    }
    
    return { text, tags };
  }
  
  /**
   * Check if text contains Unity rich text
   */
  hasRichText(text: string): boolean {
    return /<[a-zA-Z]+[^>]*>/.test(text);
  }
  
  /**
   * Normalize rich text tags (ensure proper closing)
   */
  normalizeRichText(text: string): string {
    const tagStack: string[] = [];
    const result: string[] = [];
    const tagRegex = /<(\/?)([a-zA-Z]+)[^>]*>/g;
    
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    
    while ((match = tagRegex.exec(text)) !== null) {
      // Add text before tag
      result.push(text.slice(lastIndex, match.index));
      
      const isClosing = match[1] === '/';
      const tagName = match[2];
      const fullTag = match[0];
      
      if (isClosing) {
        // Check if it matches the top of stack
        if (tagStack.length > 0 && tagStack[tagStack.length - 1] === tagName) {
          tagStack.pop();
          result.push(fullTag);
        } else {
          // Mismatched closing tag - add it anyway
          result.push(fullTag);
        }
      } else {
        // Opening tag
        tagStack.push(tagName);
        result.push(fullTag);
      }
      
      lastIndex = tagRegex.lastIndex;
    }
    
    // Add remaining text
    result.push(text.slice(lastIndex));
    
    // Close any unclosed tags
    while (tagStack.length > 0) {
      const tag = tagStack.pop();
      if (tag) {
        result.push(`</${tag}>`);
      }
    }
    
    return result.join('');
  }
}

// Export singleton instance
export const smartStringEngine = new SmartStringEngine();
