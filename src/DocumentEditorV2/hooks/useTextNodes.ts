// Text node management hook for DocumentEditor V2
import { useRef, useCallback } from 'react';
import type { EditableTextNode } from '../types';
import {
  parseTextWithFreemarker,
  createFreemarkerSpan,
  createEditableSpan,
  extractFreemarkerTags,
  restoreFreemarkerTags,
  hasProblematicFreemarkerTags,
} from '../utils/htmlUtils';

export const useTextNodes = () => {
  // State to store all editable text nodes and their changes
  const editableTextNodes = useRef<Map<string, EditableTextNode>>(new Map());

  console.log('editableTextNodes', editableTextNodes);

  /**
   * Function to prepare HTML with editable spans
   */
  const prepareEditableHtml = useCallback((htmlString: string): string => {
    console.log('🔧 DEBUG: Starting HTML preparation with FreeMarker tag extraction');
    
    // Step 1: Check if HTML contains problematic FreeMarker tags
    const hasProblematicTags = hasProblematicFreemarkerTags(htmlString);
    console.log('🔧 DEBUG: Has problematic FreeMarker tags:', hasProblematicTags);
    
    // Step 2: Extract individual FreeMarker tags before DOM parsing
    let processedHtml = htmlString;
    if (hasProblematicTags) {
      processedHtml = extractFreemarkerTags(htmlString);
      console.log('🔧 DEBUG: HTML after FreeMarker tag extraction:', processedHtml);
    }
    
    const parser: DOMParser = new DOMParser();
    const doc: Document = parser.parseFromString(processedHtml, 'text/html');
    let editableIdCounter = 0;
    editableTextNodes.current.clear(); // Clear previous editable nodes

    // Function to traverse the DOM and wrap static text
    const traverseAndWrap = (node: Node, path: number[] = []): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        const textNode = node as Text;

        // Ignore empty text nodes
        if (!textNode.nodeValue || textNode.nodeValue.trim() === '') {
          return;
        }

        // Handle text nodes that contain FreeMarker variables or directives
        if (
          textNode.nodeValue!.includes('${') ||
          textNode.nodeValue!.includes('<#') ||
          textNode.nodeValue!.includes('</#')
        ) {
          const segments = parseTextWithFreemarker(textNode.nodeValue!);

          // If only one segment and it's a FreeMarker variable, replace directly
          if (segments.length === 1 && segments[0].isFreemarker) {
            // Replace the original text node with the styled span
            textNode.parentNode!.replaceChild(
              createFreemarkerSpan(segments[0].content, doc),
              textNode,
            );
            return;
          }

          // Create container span to hold all segments
          const container: HTMLSpanElement = doc.createElement('span');
          container.style.display = 'inline'; // Maintain inline flow

          segments.forEach((segment, segmentIndex) => {
            if (segment.isFreemarker) {
              // Create non-editable span for FreeMarker variable using helper
              container.appendChild(createFreemarkerSpan(segment.content, doc));
            } else if (segment.content.trim() !== '') {
              // Create editable span for regular text
              const id = `editable-text-${editableIdCounter}`;
              editableIdCounter += 1;

              const editableSpan = createEditableSpan(segment.content, id, doc);

              // Store in tracking map with modified path
              editableTextNodes.current.set(id, {
                originalText: segment.content,
                originalHTML: segment.content,
                newText: segment.content,
                newHTML: segment.content,
                path: [...path], // Use original path since we're replacing the entire text node
                segmentIndex, // Track which segment this represents
                parentSegments: segments.map((s) => ({
                  content: s.content,
                  isFreemarker: s.isFreemarker,
                })), // Store all segments for reconstruction
              });

              container.appendChild(editableSpan);
            }
          });

          // Replace original text node with container
          textNode.parentNode!.replaceChild(container, textNode);
          return;
        }

        // Handle regular text nodes (no FreeMarker variables)
        // Create a unique ID and store original text and path
        const id = `editable-text-${editableIdCounter}`;
        editableIdCounter += 1;

        // Capture original HTML structure if parent is a formatting element
        let originalHTML = textNode.nodeValue!;
        const parentElement = textNode.parentNode as Element;
        if (
          parentElement &&
          parentElement.nodeType === Node.ELEMENT_NODE &&
          (parentElement.tagName === 'STRONG' ||
            parentElement.tagName === 'EM' ||
            parentElement.tagName === 'U' ||
            parentElement.tagName === 'B' ||
            parentElement.tagName === 'I')
        ) {
          // Check if this text node is the only child or main content
          if (
            parentElement.childNodes.length === 1 ||
            (parentElement.textContent &&
              parentElement.textContent.trim() === textNode.nodeValue!.trim())
          ) {
            originalHTML = parentElement.outerHTML;
          }
        }

        editableTextNodes.current.set(id, {
          originalText: textNode.nodeValue!,
          originalHTML, // Use the captured HTML structure
          newText: textNode.nodeValue!, // Initialize with original text
          newHTML: originalHTML, // Initialize with original HTML structure
          path: [...path], // Store path for reconstruction
        });

        // Create a span to wrap the text and make it contenteditable
        const editableSpan = createEditableSpan(textNode.nodeValue!, id, doc);

        // Replace the original text node with the new span
        textNode.parentNode!.replaceChild(editableSpan, textNode);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        for (let i = 0; i < element.childNodes.length; i += 1) {
          traverseAndWrap(element.childNodes[i], [...path, i]);
        }
      }
    };

    traverseAndWrap(doc.body);
    
    // 🔧 FIX: Post-process HTML to decode FreeMarker syntax that gets corrupted during DOM serialization
    let finalHtml = doc.documentElement.outerHTML;
    
    // Fix HTML entity encoding
    finalHtml = finalHtml.replace(/&lt;#([^&]+)&gt;/g, '<#$1>');
    finalHtml = finalHtml.replace(/&lt;\/#([^&]+)&gt;/g, '</#$1>');
    
    // 🔧 FIX: Fix HTML comment corruption of FreeMarker closing tags
    finalHtml = finalHtml.replace(/<!--#([^-]+)-->/g, '</#$1>');
    
    // Step 3: Restore FreeMarker tags after DOM processing
    if (hasProblematicTags) {
      finalHtml = restoreFreemarkerTags(finalHtml);
      console.log('🔧 DEBUG: HTML after FreeMarker tag restoration:', finalHtml);
    }
    
    console.log('🔧 DEBUG: Final processed HTML with FreeMarker tags preserved');
    return finalHtml;
  }, []);

  /**
   * Update a text node with new content
   */
  const updateTextNode = useCallback(
    (id: string, newText: string, newHTML: string) => {
      const existingNode = editableTextNodes.current.get(id);
      if (existingNode) {
        editableTextNodes.current.set(id, {
          ...existingNode,
          newText,
          newHTML,
        });
      }
    },
    [],
  );

  /**
   * Get all editable text nodes
   */
  const getAllTextNodes = useCallback(() => {
    return editableTextNodes.current;
  }, []);

  /**
   * Get a specific text node by ID
   */
  const getTextNode = useCallback((id: string) => {
    return editableTextNodes.current.get(id);
  }, []);

  /**
   * Clear all text nodes
   */
  const clearTextNodes = useCallback(() => {
    editableTextNodes.current.clear();
  }, []);

  return {
    editableTextNodes,
    prepareEditableHtml,
    updateTextNode,
    getAllTextNodes,
    getTextNode,
    clearTextNodes,
  };
};
