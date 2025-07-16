// FreeMarker Library-based utilities using freemarker-parser
// This provides AST-based parsing as an enhanced alternative to regex-based approaches

import type { TextSegment } from '../types';

// Define types for the freemarker-parser library
interface FreemarkerNode {
  type: string;
  start?: number;
  end?: number;
  text?: string;
  params?: any;
  body?: FreemarkerNode[];
  consequent?: FreemarkerNode[];
  alternate?: FreemarkerNode[];
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

interface FreemarkerParseResult {
  ast: {
    type: string;
    body: FreemarkerNode[];
    loc?: any;
  };
  tokens: Array<{
    type: string;
    text: string;
    startLine?: number;
    startColumn?: number;
  }>;
}

// Custom FreeMarker parser class
class FreemarkerLibraryParser {
  private parser: any;

  constructor() {
    // Dynamic import to handle ES module compatibility
    this.initializeParser();
  }

  private async initializeParser() {
    try {
      const freemarker = await import('freemarker-parser');
      this.parser = new freemarker.default.Parser();
    } catch (error) {
      console.warn('freemarker-parser not available, falling back to regex approach');
      this.parser = null;
    }
  }

  /**
   * Parse FreeMarker template using AST-based approach
   */
  async parseFreemarker(template: string): Promise<FreemarkerParseResult | null> {
    if (!this.parser) {
      await this.initializeParser();
    }

    if (!this.parser) {
      return null;
    }

    try {
      const result = this.parser.parse(template, {
        parseLocation: true,
        useSquareTags: false
      });
      return result;
    } catch (error) {
      console.warn('FreeMarker parsing failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Analyze conditional blocks using AST structure
   */
  analyzeConditionalBlocks(ast: FreemarkerNode[]): Array<{
    type: 'condition' | 'list' | 'interpolation';
    condition?: string;
    hasElse: boolean;
    hasElseif: boolean;
    textContent: string[];
    location?: { start: number; end: number };
    hasOrphanedElements: boolean;
  }> {
    const blocks: Array<{
      type: 'condition' | 'list' | 'interpolation';
      condition?: string;
      hasElse: boolean;
      hasElseif: boolean;
      textContent: string[];
      location?: { start: number; end: number };
      hasOrphanedElements: boolean;
    }> = [];

    const traverse = (nodes: FreemarkerNode[]) => {
      for (const node of nodes) {
        if (node.type === 'Condition') {
          const textContent = this.extractTextContent(node);
          const hasOrphanedElements = this.detectOrphanedElementsInAST(textContent);

          blocks.push({
            type: 'condition' as const,
            condition: this.extractConditionExpression(node.params),
            hasElse: !!node.alternate && node.alternate.length > 0,
            hasElseif: this.hasElseifInAlternate(node.alternate),
            textContent,
            location: node.start !== undefined && node.end !== undefined 
              ? { start: node.start, end: node.end } 
              : undefined,
            hasOrphanedElements
          });

          // Recursively analyze nested conditions
          if (node.consequent) traverse(node.consequent);
          if (node.alternate) traverse(node.alternate);
        } else if (node.type === 'List') {
          const textContent = this.extractTextContent(node);
          blocks.push({
            type: 'list' as const,
            hasElse: false,
            hasElseif: false,
            textContent,
            location: node.start !== undefined && node.end !== undefined 
              ? { start: node.start, end: node.end } 
              : undefined,
            hasOrphanedElements: false
          });

          if (node.body) traverse(node.body);
        } else if (node.type === 'Interpolation') {
          blocks.push({
            type: 'interpolation' as const,
            hasElse: false,
            hasElseif: false,
            textContent: [],
            location: node.start !== undefined && node.end !== undefined 
              ? { start: node.start, end: node.end } 
              : undefined,
            hasOrphanedElements: false
          });
        }

        // Continue traversing child nodes
        if (node.body) traverse(node.body);
      }
    };

    traverse(ast);
    return blocks;
  }

  /**
   * Extract text content from AST nodes
   */
  private extractTextContent(node: FreemarkerNode): string[] {
    const textContent: string[] = [];

    const traverse = (nodes: FreemarkerNode[] | undefined) => {
      if (!nodes) return;
      
      for (const child of nodes) {
        if (child.type === 'Text' && child.text) {
          textContent.push(child.text);
        }
        
        if (child.consequent) traverse(child.consequent);
        if (child.alternate) traverse(child.alternate);
        if (child.body) traverse(child.body);
      }
    };

    if (node.consequent) traverse(node.consequent);
    if (node.alternate) traverse(node.alternate);
    if (node.body) traverse(node.body);

    return textContent;
  }

  /**
   * Extract condition expression from AST params
   */
  private extractConditionExpression(params: any): string {
    if (!params) return '';
    
    if (params.type === 'MemberExpression') {
      return `${params.object?.name || ''}.${params.property?.name || ''}`;
    } else if (params.type === 'BinaryExpression') {
      const left = this.extractConditionExpression(params.left);
      const right = this.extractConditionExpression(params.right);
      return `${left} ${params.operator || ''} ${right}`;
    } else if (params.type === 'Identifier') {
      return params.name || '';
    }
    
    return '';
  }

  /**
   * Check if alternate branch contains elseif
   */
  private hasElseifInAlternate(alternate: FreemarkerNode[] | undefined): boolean {
    if (!alternate) return false;
    
    return alternate.some(node => 
      node.type === 'Condition' || 
      (node.type === 'Text' && node.text?.includes('<#elseif'))
    );
  }

  /**
   * Detect orphaned HTML elements in text content using AST analysis
   */
  private detectOrphanedElementsInAST(textContent: string[]): boolean {
    const combinedText = textContent.join('');
    
    // Check for table elements without proper table context
    const hasTableElements = /<(?:tr|td|th)\b[^>]*>/i.test(combinedText);
    const hasTableOpening = /<table\b[^>]*>/i.test(combinedText);
    // Check for table structure context
    
    // If we have table elements but no table opening, it's likely orphaned
    if (hasTableElements && !hasTableOpening) {
      return true;
    }
    
    // Check for other structural issues
    const hasListElements = /<(?:li|ul|ol)\b[^>]*>/i.test(combinedText);
    const hasListContext = /<(?:ul|ol)\b[^>]*>/i.test(combinedText);
    
    if (hasListElements && !hasListContext) {
      return true;
    }
    
    return false;
  }
}

// Global parser instance
let parserInstance: FreemarkerLibraryParser | null = null;

/**
 * Get or create parser instance
 */
function getParser(): FreemarkerLibraryParser {
  if (!parserInstance) {
    parserInstance = new FreemarkerLibraryParser();
  }
  return parserInstance;
}

/**
 * Parse FreeMarker template with library-based approach
 */
export async function parseFreemarkerWithLibrary(template: string): Promise<FreemarkerParseResult | null> {
  const parser = getParser();
  return await parser.parseFreemarker(template);
}

/**
 * Analyze conditional blocks using AST-based approach
 */
export async function analyzeConditionalBlocksWithLibrary(html: string) {
  const parser = getParser();
  const parseResult = await parser.parseFreemarker(html);
  
  if (!parseResult) {
    console.warn('AST parsing failed, falling back to regex approach');
    return null;
  }
  
  return parser.analyzeConditionalBlocks(parseResult.ast.body);
}

/**
 * Enhanced FreeMarker tag extraction using AST analysis
 */
export async function extractFreemarkerTagsWithLibrary(html: string): Promise<string> {
  const parser = getParser();
  const parseResult = await parser.parseFreemarker(html);
  
  if (!parseResult) {
    console.warn('AST parsing failed, using fallback approach');
    // Fall back to existing regex-based approach
    const { extractFreemarkerTags } = await import('./htmlUtils');
    return extractFreemarkerTags(html);
  }
  
  // Analyze conditional blocks for structural issues
  const blocks = parser.analyzeConditionalBlocks(parseResult.ast.body);
  const problematicBlocks = blocks.filter(block => block.hasOrphanedElements);
  
  console.log(`AST Analysis: Found ${blocks.length} FreeMarker blocks, ${problematicBlocks.length} problematic`);
  
  if (problematicBlocks.length === 0) {
    // All blocks are structurally safe, use individual tag extraction
    return await extractIndividualTagsFromAST(html, parseResult);
  } else {
    // Some blocks are problematic, use hybrid approach
    return await extractHybridFromAST(html, parseResult, problematicBlocks);
  }
}

/**
 * Extract individual tags when all blocks are structurally safe
 */
async function extractIndividualTagsFromAST(html: string, parseResult: FreemarkerParseResult): Promise<string> {
  const storage = new Map<string, string>();
  let processedHtml = html;
  let tagCounter = 0;
  
  // Extract individual FreeMarker tags based on token information
  const freemarkerTokens = parseResult.tokens.filter(token => 
    token.type === 'OpenDirective' || token.type === 'CloseDirective'
  );
  
  // Process tokens in reverse order to maintain correct indices
  const sortedTokens = [...freemarkerTokens].reverse();
  
  for (const token of sortedTokens) {
    const tagId = `FREEMARKER_AST_TAG_${tagCounter++}`;
    const tagText = token.text;
    
    // Find and replace the tag in HTML
    const tagIndex = processedHtml.lastIndexOf(tagText);
    if (tagIndex !== -1) {
      storage.set(tagId, tagText);
      const placeholder = `<!-- ${tagId} -->`;
      processedHtml = processedHtml.substring(0, tagIndex) + 
                     placeholder + 
                     processedHtml.substring(tagIndex + tagText.length);
    }
  }
  
  console.log(`AST-based individual tag extraction: ${freemarkerTokens.length} tags processed`);
  return processedHtml;
}

/**
 * Extract using hybrid approach for problematic blocks
 */
async function extractHybridFromAST(
  html: string, 
  parseResult: FreemarkerParseResult, 
  problematicBlocks: any[]
): Promise<string> {
  const storage = new Map<string, string>();
  let processedHtml = html;
  let tagCounter = 0;
  
  // Extract complete problematic blocks first
  for (const block of problematicBlocks) {
    if (block.location) {
      const blockText = html.substring(block.location.start, block.location.end);
      const blockId = `FREEMARKER_AST_BLOCK_${tagCounter++}`;
      
      storage.set(blockId, blockText);
      const placeholder = `<!-- ${blockId} -->`;
      
      processedHtml = processedHtml.substring(0, block.location.start) + 
                     placeholder + 
                     processedHtml.substring(block.location.end);
    }
  }
  
  // Then extract individual tags from remaining content
  const remainingTokens = parseResult.tokens.filter(token => 
    (token.type === 'OpenDirective' || token.type === 'CloseDirective') &&
    processedHtml.includes(token.text)
  );
  
  for (const token of remainingTokens.reverse()) {
    const tagId = `FREEMARKER_AST_TAG_${tagCounter++}`;
    const tagIndex = processedHtml.lastIndexOf(token.text);
    
    if (tagIndex !== -1) {
      storage.set(tagId, token.text);
      const placeholder = `<!-- ${tagId} -->`;
      processedHtml = processedHtml.substring(0, tagIndex) + 
                     placeholder + 
                     processedHtml.substring(tagIndex + token.text.length);
    }
  }
  
  console.log(`AST-based hybrid extraction: ${problematicBlocks.length} blocks, ${remainingTokens.length} individual tags`);
  return processedHtml;
}

/**
 * Parse text with FreeMarker using AST-based approach
 */
export async function parseTextWithFreemarkerLibrary(text: string): Promise<TextSegment[]> {
  const parser = getParser();
  const parseResult = await parser.parseFreemarker(text);
  
  if (!parseResult) {
    // Fall back to regex-based approach
    const { parseTextWithFreemarker } = await import('./htmlUtils');
    return parseTextWithFreemarker(text);
  }
  
  const segments: TextSegment[] = [];
  
  const traverse = (nodes: FreemarkerNode[], startOffset = 0) => {
    for (const node of nodes) {
      if (node.type === 'Text' && node.text) {
        segments.push({
          content: node.text,
          isFreemarker: false,
          startIndex: (node.start || 0) + startOffset,
          endIndex: (node.end || node.text.length) + startOffset,
        });
      } else if (node.type === 'Interpolation') {
        const interpolationText = text.substring(node.start || 0, node.end || 0);
        segments.push({
          content: interpolationText,
          isFreemarker: true,
          startIndex: (node.start || 0) + startOffset,
          endIndex: (node.end || 0) + startOffset,
        });
      } else if (node.type === 'Condition' || node.type === 'List') {
        // Add the directive tags as FreeMarker segments
        const directiveText = text.substring(node.start || 0, node.end || 0);
        segments.push({
          content: directiveText,
          isFreemarker: true,
          startIndex: (node.start || 0) + startOffset,
          endIndex: (node.end || 0) + startOffset,
        });
        
        // Traverse child nodes
        if (node.consequent) traverse(node.consequent, startOffset);
        if (node.alternate) traverse(node.alternate, startOffset);
        if (node.body) traverse(node.body, startOffset);
      }
    }
  };
  
  traverse(parseResult.ast.body);
  
  // Sort segments by start index
  segments.sort((a, b) => a.startIndex - b.startIndex);
  
  return segments;
}
