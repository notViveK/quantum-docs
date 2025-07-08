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
