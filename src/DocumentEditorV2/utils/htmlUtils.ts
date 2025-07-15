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

/**
 * Detect conditionals with orphaned table elements after table closure
 * This targets the specific pattern: </table> followed by <#elseif> containing <tr><td>
 */
export const detectOrphanedTableElementConditionals = (html: string): Array<{block: string, index: number, length: number}> => {
  const problematicBlocks = [];
  
  // Find all conditional blocks first
  const conditionalBlockRegex = /<#if[\s\S]*?<\/#if>/gi;
  let match;
  
  while ((match = conditionalBlockRegex.exec(html)) !== null) {
    const conditionalBlock = match[0];
    const conditionalIndex = match.index;
    
    // Check if this conditional has orphaned table elements
    if (hasOrphanedTableElements(conditionalBlock, html, conditionalIndex)) {
      console.log('Found conditional with orphaned table elements:', {
        index: conditionalIndex,
        preview: conditionalBlock.substring(0, 100) + '...'
      });
      
      problematicBlocks.push({
        block: conditionalBlock,
        index: conditionalIndex,
        length: conditionalBlock.length
      });
    }
  }
  
  conditionalBlockRegex.lastIndex = 0;
  return problematicBlocks;
};

/**
 * Check if a conditional block has orphaned table elements in elseif/else branches
 */
const hasOrphanedTableElements = (block: string, fullHtml: string, blockIndex: number): boolean => {
  // Split into branches
  const branches = [];
  const parts = block.split(/(<#(?:else|elseif[^>]*)>)/);
  
  let currentBranch = '';
  let branchType = 'if';
  
  for (const part of parts) {
    if (part.match(/^<#(?:else|elseif[^>]*)>$/)) {
      if (currentBranch.trim()) {
        branches.push({ type: branchType, content: currentBranch.trim() });
      }
      branchType = part.includes('elseif') ? 'elseif' : 'else';
      currentBranch = '';
    } else {
      currentBranch += part;
    }
  }
  
  if (currentBranch.trim()) {
    branches.push({ type: branchType, content: currentBranch.trim() });
  }
  
  // Check if there's a table closure before this conditional
  const htmlBeforeConditional = fullHtml.substring(0, blockIndex);
  // Look for </table> anywhere in the HTML before this conditional
  const hasTableClosureBefore = /<\/table>/i.test(htmlBeforeConditional);
  
  // Also check if this conditional immediately follows a table closure (more specific check)
  const immediatelyAfterTableClosure = /<\/table>[\s\n]*$/.test(htmlBeforeConditional.trim());
  
  console.log('Analyzing conditional for orphaned table elements:', {
    hasTableClosureBefore,
    immediatelyAfterTableClosure,
    branchCount: branches.length,
    branches: branches.map(b => ({ type: b.type, hasTableElements: /<(?:tr|td|th)/i.test(b.content) })),
    htmlBeforePreview: htmlBeforeConditional.substring(Math.max(0, htmlBeforeConditional.length - 50))
  });
  
  // Check all branches for problematic table structure patterns
  for (const branch of branches) {
    const hasTableElements = /<(?:tr|td|th|tbody|thead|tfoot)/i.test(branch.content);
    const hasTableOpening = /<table[^>]*>/i.test(branch.content);
    const hasTableClosing = /<\/table>/i.test(branch.content);
    
    // Pattern 1: elseif/else branches with orphaned table elements after table closure
    if ((branch.type === 'elseif' || branch.type === 'else') && hasTableElements && !hasTableOpening && (hasTableClosureBefore || immediatelyAfterTableClosure)) {
      console.log(`Found orphaned table elements in ${branch.type} branch after table closure:`, {
        branchContent: branch.content.substring(0, 100) + '...',
        hasTableElements,
        hasTableOpening,
        hasTableClosureBefore
      });
      return true;
    }
    
    // Pattern 2: Conditional spans table boundary - table closing tag inside a branch
    if (branch.type === 'if' && hasTableClosing) {
      // Check if any other branch has orphaned table elements
      for (const otherBranch of branches) {
        if (otherBranch.type !== 'if') {
          const otherHasTableElements = /<(?:tr|td|th|tbody|thead|tfoot)/i.test(otherBranch.content);
          const otherHasTableOpening = /<table[^>]*>/i.test(otherBranch.content);
          
          if (otherHasTableElements && !otherHasTableOpening) {
            console.log(`Found conditional spanning table boundary - table closes in '${branch.type}' branch, orphaned elements in '${otherBranch.type}' branch:`, {
              closingBranchContent: branch.content.substring(0, 100) + '...',
              orphanedBranchContent: otherBranch.content.substring(0, 100) + '...',
              hasTableClosing,
              otherHasTableElements,
              otherHasTableOpening
            });
            return true;
          }
        }
      }
    }
  }
  
  return false;
};

/**
 * Solution 6: Targeted Orphaned Table Element Fix
 * Only extracts conditionals with orphaned table elements, keeps all others as individual tags
 */
export const extractFreemarkerTags = (html: string): string => {
  // Clear previous storage
  freemarkerTagStorage.clear();
  tagCounter = 0;
  
  console.log('=== Solution 6: Targeted Orphaned Table Element Fix ===');
  
  let processedHtml = html;
  
  // Step 1: Detect conditionals with orphaned table elements (the specific problematic pattern)
  const orphanedTableConditionals = detectOrphanedTableElementConditionals(html);
  
  if (orphanedTableConditionals.length > 0) {
    console.log(`Found ${orphanedTableConditionals.length} conditionals with orphaned table elements`);
    
    // Extract these problematic conditionals as complete blocks
    const sortedBlocks = [...orphanedTableConditionals].sort((a, b) => b.index - a.index);
    
    sortedBlocks.forEach(blockInfo => {
      const blockId = `FREEMARKER_ORPHANED_TABLE_BLOCK_${tagCounter++}`;
      
      // Store the complete block
      freemarkerTagStorage.set(blockId, blockInfo.block);
      
      // Replace with placeholder
      const placeholder = `<!-- ${blockId} -->`;
      processedHtml = processedHtml.substring(0, blockInfo.index) + 
                     placeholder + 
                     processedHtml.substring(blockInfo.index + blockInfo.length);
      
      console.log(`Extracted orphaned table conditional:`, {
        blockId,
        position: blockInfo.index
      });
    });
  } else {
    console.log('No conditionals with orphaned table elements found');
  }
  
  // Step 2: Extract individual tags from ALL remaining FreeMarker content
  // This includes all the well-structured conditionals that should remain editable
  const freemarkerTagRegex = /<#(?:if\s[^>]*|else|elseif\s[^>]*|\/#?\w+(?:\s[^>]*)?|\w+(?:\s[^>]*)?)>/gi;
  const matches = [];
  let match;
  
  // Collect all remaining FreeMarker tags
  while ((match = freemarkerTagRegex.exec(processedHtml)) !== null) {
    matches.push({
      tag: match[0],
      index: match.index,
      length: match[0].length
    });
  }
  
  console.log(`Extracting ${matches.length} individual FreeMarker tags (keeping conditionals editable)...`);
  
  // Process individual tags in reverse order
  matches.reverse().forEach(matchInfo => {
    const tagId = `FREEMARKER_TAG_${tagCounter++}`;
    
    // Store the individual tag
    freemarkerTagStorage.set(tagId, matchInfo.tag);
    
    // Replace with placeholder
    const placeholder = `<!-- ${tagId} -->`;
    processedHtml = processedHtml.substring(0, matchInfo.index) + 
                   placeholder + 
                   processedHtml.substring(matchInfo.index + matchInfo.length);
  });
  
  freemarkerTagRegex.lastIndex = 0;
  
  console.log('=== Solution 6 Complete ===');
  return processedHtml;
};

/**
 * Restore FreeMarker tags from placeholders
 * Replaces placeholders back with original FreeMarker tags
 */
export const restoreFreemarkerTags = (html: string): string => {
  let restoredHtml = html;
  
  // Restore all stored tags
  for (const [tagId, originalTag] of freemarkerTagStorage.entries()) {
    const placeholder = `<!-- ${tagId} -->`;
    
    if (restoredHtml.includes(placeholder)) {
      restoredHtml = restoredHtml.replace(placeholder, originalTag);
      console.log(`Restored FreeMarker tag:`, {
        tagId,
        placeholder,
        restoredTag: originalTag
      });
    }
  }
  
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
