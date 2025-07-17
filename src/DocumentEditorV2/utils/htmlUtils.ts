// HTML processing utilities for DocumentEditor V2
// HTML processing utilities for DocumentEditor V2
import type { TextSegment } from '../types';

/**
 * Helper function to parse text containing FreeMarker variables
 */
export const parseTextWithFreemarker = (text: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  const freemarkerRegex = /\$\{[^}]+\}|<#[^>]*>|<\/#[^>]*>/g;
  let lastIndex = 0;
  let match = freemarkerRegex.exec(text);

  while (match !== null) {
    // Add text before the variable/directive (if any)
    if (match.index > lastIndex) {
      const textContent = text.substring(lastIndex, match.index);
      if (textContent.trim() !== '') {
        segments.push({
          content: textContent,
          isFreemarker: false,
          startIndex: lastIndex,
          endIndex: match.index,
        });
      }
    }

    // Add the FreeMarker variable/directive
    segments.push({
      content: match[0],
      isFreemarker: true,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });

    lastIndex = match.index + match[0].length;
    match = freemarkerRegex.exec(text);
  }

  // Add remaining text after last variable/directive
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText.trim() !== '') {
      segments.push({
        content: remainingText,
        isFreemarker: false,
        startIndex: lastIndex,
        endIndex: text.length,
      });
    }
  }

  return segments;
};

/**
 * Helper function to create styled FreeMarker variable spans
 */
export const createFreemarkerSpan = (
  content: string,
  doc: Document,
): HTMLSpanElement => {
  const variableSpan: HTMLSpanElement = doc.createElement('span');
  variableSpan.className = 'freemarker-variable';
  variableSpan.setAttribute('contenteditable', 'false');
  variableSpan.style.backgroundColor = 'rgba(255, 193, 7, 0.2)';
  variableSpan.style.border = '1px solid #ffc107';
  variableSpan.style.borderRadius = '3px';
  variableSpan.style.padding = '1px 3px';
  variableSpan.style.fontFamily = 'monospace';
  variableSpan.style.fontSize = '0.9em';
  // 🔧 FIX: Use innerHTML to preserve FreeMarker syntax without HTML entity encoding
  variableSpan.innerHTML = content;
  return variableSpan;
};

/**
 * Helper function to create editable spans with consistent styling
 */
export const createEditableSpan = (
  content: string,
  id: string,
  doc: Document,
): HTMLSpanElement => {
  const span: HTMLSpanElement = doc.createElement('span');
  span.setAttribute('contenteditable', 'true');
  span.setAttribute('data-editable-id', id);
  span.style.outline = '1px dashed #22D081'; // Visual cue for editable
  span.style.display = 'inline'; // Natural text flow
  span.style.minHeight = '1em'; // Ensure visibility for empty spans
  span.textContent = content;
  return span;
};

// Storage for extracted FreeMarker tags (individual tags, not complete blocks)
const freemarkerTagStorage = new Map<string, string>();
let tagCounter = 0;

// Storage for extracted problematic FreeMarker blocks (complete blocks for structural conflicts)
const freemarkerBlockStorage = new Map<string, string>();
let blockCounter = 0;

/**
 * Detect FreeMarker conditionals that create HTML structural conflicts
 * Returns array of problematic conditional blocks that should be extracted as complete units
 */
export const detectStructuralConflicts = (html: string): Array<{block: string, startIndex: number, endIndex: number}> => {
  const problematicBlocks: Array<{block: string, startIndex: number, endIndex: number}> = [];
  
  // Regex to find complete FreeMarker conditional blocks
  const conditionalBlockRegex = /<#if\s[^>]*>[\s\S]*?<\/#if>/gi;
  let match;
  
  while ((match = conditionalBlockRegex.exec(html)) !== null) {
    const block = match[0];
    const startIndex = match.index;
    const endIndex = match.index + block.length;
    
    // Check if this conditional creates structural conflicts
    if (hasStructuralConflict(block)) {
      problematicBlocks.push({
        block,
        startIndex,
        endIndex
      });
      
      console.log('Detected problematic FreeMarker conditional:', {
        block: block.substring(0, 100) + '...', // Truncate for logging
        startIndex,
        endIndex,
        reason: 'Creates orphaned table elements'
      });
    }
  }
  
  // Reset regex for next use
  conditionalBlockRegex.lastIndex = 0;
  
  return problematicBlocks;
};

/**
 * Check if a FreeMarker conditional block creates HTML structural conflicts
 * Specifically detects orphaned table elements that would cause DOM corruption
 * Uses precise pattern matching to avoid false positives
 */
export const hasStructuralConflict = (conditionalBlock: string): boolean => {
  console.log('Analyzing conditional block for structural conflicts:', conditionalBlock.substring(0, 100) + '...');
  
  // Pattern 1: Detect table closure in one branch with orphaned elements in another
  // This is the specific problematic pattern: </table> in one branch, <tr><td> in another
  const hasTableClosure = /<\/table>/gi.test(conditionalBlock);
  const hasTableElements = /<(?:tr|td|th)[^>]*>/gi.test(conditionalBlock);
  
  if (hasTableClosure && hasTableElements) {
    // More detailed analysis: check if table elements appear in branches without proper table context
    const branches = splitConditionalIntoBranches(conditionalBlock);
    let hasOrphanedElements = false;
    
    for (const branch of branches) {
      // Skip the initial 'if' branch for this check
      if (branch.type === 'elseif' || branch.type === 'else') {
        const branchHasTableElements = /<(?:tr|td|th)[^>]*>/gi.test(branch.content);
        const branchHasTableOpening = /<table[^>]*>/gi.test(branch.content);
        
        // Check if this branch has table elements without a table opening
        // AND the conditional contains table closures (indicating structure spanning)
        if (branchHasTableElements && !branchHasTableOpening) {
          console.log('Structural conflict detected: Orphaned table elements in branch', {
            branchType: branch.type,
            branchContent: branch.content.substring(0, 50) + '...'
          });
          hasOrphanedElements = true;
          break;
        }
      }
    }
    
    if (hasOrphanedElements) {
      return true;
    }
  }
  
  // Pattern 2: Check for conditionals that are safely contained within table cells
  // These should NOT be flagged as problematic
  const isSafelyContained = isSafelyContainedInTableCells(conditionalBlock);
  if (isSafelyContained) {
    console.log('Conditional is safely contained within table cells - no conflict');
    return false;
  }
  
  // Pattern 3: Check for table structure spanning without proper nesting
  // Only flag if there's actual structural boundary crossing
  const crossesTableBoundaries = doesConditionalCrossTableBoundaries(conditionalBlock);
  if (crossesTableBoundaries) {
    console.log('Structural conflict detected: Conditional crosses table boundaries');
    return true;
  }
  
  console.log('No structural conflicts detected');
  return false;
};

/**
 * Check if a conditional is safely contained within table cells
 * These conditionals should remain editable with individual tag extraction
 */
export const isSafelyContainedInTableCells = (conditionalBlock: string): boolean => {
  // Pattern: Conditional that only contains table cell content
  // Example: <#if><td>content</td><#else><td>other</td></#if>
  const branches = splitConditionalIntoBranches(conditionalBlock);
  
  for (const branch of branches) {
    const content = branch.content.trim();
    
    // Check if branch content only contains table cell elements or simple content
    // Remove any whitespace and check if it starts/ends with td elements or is simple text
    const hasTdOnly = /^\s*<td[^>]*>[\s\S]*<\/td>\s*$/gi.test(content);
    const hasSimpleContent = !/<(?:table|tr|div|p)[^>]*>/gi.test(content);
    
    if (hasTdOnly || hasSimpleContent) {
      continue; // This branch is safely contained
    } else {
      return false; // Found complex content, not safely contained
    }
  }
  
  return true; // All branches are safely contained
};

/**
 * Check if a conditional crosses table structural boundaries
 * This detects patterns where table opening/closing spans conditional branches
 */
export const doesConditionalCrossTableBoundaries = (conditionalBlock: string): boolean => {
  // Look for patterns where table opening is in one branch and closing is in another
  // or where table structure is incomplete across branches
  
  const branches = splitConditionalIntoBranches(conditionalBlock);
  let hasTableOpening = false;
  let hasTableClosing = false;
  
  for (const branch of branches) {
    if (/<table[^>]*>/gi.test(branch.content)) {
      hasTableOpening = true;
    }
    if (/<\/table>/gi.test(branch.content)) {
      hasTableClosing = true;
    }
  }
  
  // If we have both opening and closing across different branches, it's problematic
  // But we need to verify they're not properly paired within the same branch
  if (hasTableOpening && hasTableClosing) {
    // Check if any branch has unmatched table tags
    for (const branch of branches) {
      const openings = (branch.content.match(/<table[^>]*>/gi) || []).length;
      const closings = (branch.content.match(/<\/table>/gi) || []).length;
      
      if (openings !== closings) {
        return true; // Unmatched tags across branches
      }
    }
  }
  
  return false;
};

/**
 * Split a FreeMarker conditional block into its component branches
 * Returns array of branches with their types (if, elseif, else) and content
 */
export const splitConditionalIntoBranches = (conditionalBlock: string): Array<{type: string, content: string}> => {
  const branches: Array<{type: string, content: string}> = [];
  
  // Remove the outer <#if> and </#if> tags to get inner content
  const innerContent = conditionalBlock.replace(/^<#if\s[^>]*>/, '').replace(/<\/#if>$/, '');
  
  // Split by else/elseif tags while preserving the tags
  const parts = innerContent.split(/(<#(?:else|elseif\s[^>]*)>)/gi);
  
  let currentBranch = { type: 'if', content: '' };
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (part.match(/^<#else>/i)) {
      // Save current branch and start else branch
      branches.push(currentBranch);
      currentBranch = { type: 'else', content: '' };
    } else if (part.match(/^<#elseif\s/i)) {
      // Save current branch and start elseif branch
      branches.push(currentBranch);
      currentBranch = { type: 'elseif', content: '' };
    } else {
      // Add content to current branch
      currentBranch.content += part;
    }
  }
  
  // Add the final branch
  branches.push(currentBranch);
  
  return branches;
};

/**
 * Detect all FreeMarker conditional blocks in HTML
 * Returns array of all conditional blocks for classification
 */
export const detectAllConditionalBlocks = (html: string): Array<{block: string, startIndex: number, endIndex: number}> => {
  const allBlocks: Array<{block: string, startIndex: number, endIndex: number}> = [];
  
  // Regex to find all complete FreeMarker conditional blocks
  const conditionalBlockRegex = /<#if\s[^>]*>[\s\S]*?<\/#if>/gi;
  let match;
  
  while ((match = conditionalBlockRegex.exec(html)) !== null) {
    const block = match[0];
    const startIndex = match.index;
    const endIndex = match.index + block.length;
    
    allBlocks.push({
      block,
      startIndex,
      endIndex
    });
  }
  
  // Reset regex for next use
  conditionalBlockRegex.lastIndex = 0;
  
  console.log(`Found ${allBlocks.length} total FreeMarker conditional blocks`);
  return allBlocks;
};

/**
 * Extract specific FreeMarker conditional blocks as complete units
 * Used for both problematic and default blocks that should be non-editable
 */
export const extractSpecificBlocks = (html: string, blocksToExtract: Array<{block: string, startIndex: number, endIndex: number}>): string => {
  let processedHtml = html;
  
  // Process blocks in reverse order to maintain correct indices
  blocksToExtract.reverse().forEach(blockInfo => {
    const blockId = `FREEMARKER_BLOCK_${blockCounter++}`;
    
    // Store the original block
    freemarkerBlockStorage.set(blockId, blockInfo.block);
    
    // Create a placeholder comment that won't interfere with DOM parsing
    const placeholder = `<!-- ${blockId} -->`;
    
    // Replace the block with placeholder
    processedHtml = processedHtml.substring(0, blockInfo.startIndex) + 
                   placeholder + 
                   processedHtml.substring(blockInfo.endIndex);
    
    console.log(`Extracted complete FreeMarker block:`, {
      blockId,
      originalBlock: blockInfo.block.substring(0, 100) + '...', // Truncate for logging
      placeholder,
      position: blockInfo.startIndex
    });
  });
  
  return processedHtml;
};

/**
 * Extract problematic FreeMarker conditional blocks as complete units
 * These blocks create structural conflicts and should be non-editable
 * @deprecated - Use detectAllConditionalBlocks + extractSpecificBlocks instead
 */
export const extractProblematicBlocks = (html: string): string => {
  // Clear previous storage
  freemarkerBlockStorage.clear();
  blockCounter = 0;
  
  const problematicBlocks = detectStructuralConflicts(html);
  let processedHtml = html;
  
  // Process blocks in reverse order to maintain correct indices
  problematicBlocks.reverse().forEach(blockInfo => {
    const blockId = `FREEMARKER_BLOCK_${blockCounter++}`;
    
    // Store the original block
    freemarkerBlockStorage.set(blockId, blockInfo.block);
    
    // Create a placeholder comment that won't interfere with DOM parsing
    const placeholder = `<!-- ${blockId} -->`;
    
    // Replace the block with placeholder
    processedHtml = processedHtml.substring(0, blockInfo.startIndex) + 
                   placeholder + 
                   processedHtml.substring(blockInfo.endIndex);
    
    console.log(`Extracted problematic FreeMarker block:`, {
      blockId,
      originalBlock: blockInfo.block.substring(0, 100) + '...', // Truncate for logging
      placeholder,
      position: blockInfo.startIndex
    });
  });
  
  return processedHtml;
};

/**
 * Restore problematic FreeMarker blocks from placeholders
 * Replaces placeholders back with original conditional blocks
 */
export const restoreProblematicBlocks = (html: string): string => {
  let restoredHtml = html;
  
  // Restore all stored blocks
  for (const [blockId, originalBlock] of freemarkerBlockStorage.entries()) {
    const placeholder = `<!-- ${blockId} -->`;
    
    if (restoredHtml.includes(placeholder)) {
      restoredHtml = restoredHtml.replace(placeholder, originalBlock);
      console.log(`Restored problematic FreeMarker block:`, {
        blockId,
        placeholder,
        restoredBlock: originalBlock.substring(0, 100) + '...' // Truncate for logging
      });
    }
  }
  
  return restoredHtml;
};

/**
 * Extract FreeMarker tags using corrected hybrid approach for Solution 1
 * - Extracts problematic conditional blocks as complete units (non-editable)
 * - Extracts specifically safe conditionals as individual tags (remains editable) 
 * - Extracts all other conditionals as complete blocks by default (prevents corruption)
 */
export const extractFreemarkerTags = (html: string): string => {
  console.log('🔧 DEBUG: Starting Solution 1 corrected hybrid FreeMarker extraction');
  
  // Clear previous storage
  freemarkerTagStorage.clear();
  freemarkerBlockStorage.clear();
  tagCounter = 0;
  blockCounter = 0;

  let processedHtml = html;
  
  // Step 1: Extract all conditional blocks first (both problematic and safe)
  const allConditionalBlocks = detectAllConditionalBlocks(processedHtml);
  console.log(`🔧 DEBUG: Found ${allConditionalBlocks.length} conditional blocks to analyze`);
  
  // Step 2: Classify each conditional block
  const problematicBlocks = [];
  const safeEditableBlocks = [];
  const defaultBlocks = [];
  
  for (const blockInfo of allConditionalBlocks) {
    if (hasStructuralConflict(blockInfo.block)) {
      problematicBlocks.push(blockInfo);
      console.log('Classified as PROBLEMATIC (complete block):', blockInfo.block.substring(0, 50) + '...');
    } else if (isSafelyContainedInTableCells(blockInfo.block)) {
      safeEditableBlocks.push(blockInfo);
      console.log('Classified as SAFE EDITABLE (individual tags):', blockInfo.block.substring(0, 50) + '...');
    } else {
      defaultBlocks.push(blockInfo);
      console.log('Classified as DEFAULT (complete block):', blockInfo.block.substring(0, 50) + '...');
    }
  }
  
  // Step 3: Extract problematic and default blocks as complete units
  const blocksToExtract = [...problematicBlocks, ...defaultBlocks];
  processedHtml = extractSpecificBlocks(processedHtml, blocksToExtract);
  console.log('🔧 DEBUG: After extracting complete blocks:', processedHtml.length, 'characters');
  
  // Step 4: Extract individual tags only from safe editable conditionals and other FreeMarker elements
  const freemarkerTagRegex = /<#(?:if\s[^>]*|else|elseif\s[^>]*|\/#?\w+(?:\s[^>]*)?|\w+(?:\s[^>]*)?)>/gi;
  
  const matches = [];
  let match;
  
  // Collect remaining FreeMarker tags (should only be from safe conditionals and variables/directives)
  while ((match = freemarkerTagRegex.exec(processedHtml)) !== null) {
    matches.push({
      tag: match[0],
      index: match.index,
      length: match[0].length
    });
  }
  
  console.log(`🔧 DEBUG: Found ${matches.length} individual FreeMarker tags to extract (safe conditionals + variables)`);
  
  // Process matches in reverse order to maintain correct indices
  matches.reverse().forEach(matchInfo => {
    const tagId = `FREEMARKER_TAG_${tagCounter++}`;
    
    // Store the original tag
    freemarkerTagStorage.set(tagId, matchInfo.tag);
    
    // Create a placeholder comment that won't interfere with DOM parsing
    const placeholder = `<!-- ${tagId} -->`;
    
    // Replace the tag with placeholder
    processedHtml = processedHtml.substring(0, matchInfo.index) + 
                   placeholder + 
                   processedHtml.substring(matchInfo.index + matchInfo.length);
    
    console.log(`Extracted individual FreeMarker tag:`, {
      tagId,
      originalTag: matchInfo.tag,
      placeholder,
      position: matchInfo.index
    });
  });
  
  // Reset regex lastIndex for next use
  freemarkerTagRegex.lastIndex = 0;
  
  console.log('🔧 DEBUG: Solution 1 corrected extraction complete. Total processed length:', processedHtml.length);
  return processedHtml;
};

/**
 * Restore FreeMarker tags and blocks from placeholders using Solution 1 hybrid approach
 * - Restores individual tags (from safe conditionals that remain editable)
 * - Restores complete blocks (from problematic conditionals that are non-editable)
 */
export const restoreFreemarkerTags = (html: string): string => {
  let restoredHtml = html;
  
  console.log('🔧 DEBUG: Starting Solution 1 hybrid FreeMarker restoration');
  
  // Step 1: Restore problematic complete blocks first
  for (const [blockId, originalBlock] of freemarkerBlockStorage.entries()) {
    const placeholder = `<!-- ${blockId} -->`;
    
    if (restoredHtml.includes(placeholder)) {
      restoredHtml = restoredHtml.replace(placeholder, originalBlock);
      console.log(`Restored problematic FreeMarker block:`, {
        blockId,
        placeholder,
        restoredBlock: originalBlock.substring(0, 100) + '...' // Truncate for logging
      });
    }
  }
  
  // Step 2: Restore individual tags (safe conditionals and other FreeMarker elements)
  for (const [tagId, originalTag] of freemarkerTagStorage.entries()) {
    const placeholder = `<!-- ${tagId} -->`;
    
    if (restoredHtml.includes(placeholder)) {
      restoredHtml = restoredHtml.replace(placeholder, originalTag);
      console.log(`Restored individual FreeMarker tag:`, {
        tagId,
        placeholder,
        restoredTag: originalTag
      });
    }
  }
  
  console.log('🔧 DEBUG: Solution 1 restoration complete');
  return restoredHtml;
};

/**
 * Get information about extracted FreeMarker tags (for debugging)
 */
export const getExtractedTagsInfo = (): Array<{tagId: string, content: string}> => {
  return Array.from(freemarkerTagStorage.entries()).map(([tagId, content]) => ({
    tagId,
    content
  }));
};

/**
 * Check if HTML contains FreeMarker tags that could cause displacement
 */
export const hasProblematicFreemarkerTags = (html: string): boolean => {
  // Check for any FreeMarker conditional tags
  const freemarkerTagRegex = /<#(?:if\s[^>]*|else|elseif\s[^>]*|\/#?\w+(?:\s[^>]*)?|\w+(?:\s[^>]*)?)>/gi;
  return freemarkerTagRegex.test(html);
};

// Legacy functions for backward compatibility
export const extractFreemarkerConditionalBlocks = extractFreemarkerTags;
export const restoreFreemarkerConditionalBlocks = restoreFreemarkerTags;
export const getExtractedBlocksInfo = getExtractedTagsInfo;
export const hasSpanningFreemarkerConditionals = hasProblematicFreemarkerTags;
