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
 * Extract individual FreeMarker tags that can cause DOM displacement
 * This handles overlapping, incomplete, and complex FreeMarker structures
 */
export const extractFreemarkerTags = (html: string): string => {
  // Clear previous storage
  freemarkerTagStorage.clear();
  tagCounter = 0;

  // Regex to match individual FreeMarker tags (not complete blocks)
  const freemarkerTagRegex = /<#(?:if\s[^>]*|else|elseif\s[^>]*|\/#?\w+(?:\s[^>]*)?|\w+(?:\s[^>]*)?)>/gi;
  
  let processedHtml = html;
  const matches = [];
  let match;
  
  // Collect all FreeMarker tags first
  while ((match = freemarkerTagRegex.exec(html)) !== null) {
    matches.push({
      tag: match[0],
      index: match.index,
      length: match[0].length
    });
  }
  
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
    
    console.log(`Extracted FreeMarker tag:`, {
      tagId,
      originalTag: matchInfo.tag,
      placeholder,
      position: matchInfo.index
    });
  });
  
  // Reset regex lastIndex for next use
  freemarkerTagRegex.lastIndex = 0;
  
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
