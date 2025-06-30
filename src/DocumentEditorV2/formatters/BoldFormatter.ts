// Bold formatting module for DocumentEditor V2
// Bold formatting module for DocumentEditor V2
import type { FormatterModule } from '../types';

/**
 * IMPORTANT: These methods are serialized and executed directly in iframe JavaScript.
 *
 * Implementation approach:
 * 1. Functions are converted to strings using .toString()
 * 2. Injected into iframe JavaScript context
 * 3. Called directly from iframe event handlers
 * 4. Eliminates code duplication and ensures consistent behavior
 *
 * Requirements for serializable functions:
 * - Must be self-contained (no external dependencies)
 * - Only use DOM APIs available in iframe context
 * - No closure variables or external references
 */
export const BoldFormatter: FormatterModule = {
  name: 'bold',

  /**
   * Detect if a node is inside a bold element (STRONG or B)
   * This function will be serialized and executed directly in iframe
   */
  detect: (node: Node): boolean => {
    let currentNode: Node | null = node;
    while (currentNode && currentNode.nodeType !== Node.DOCUMENT_NODE) {
      if (currentNode.nodeName === 'STRONG' || currentNode.nodeName === 'B') {
        console.log('DEBUG: Detected bold element');
        return true;
      }
      currentNode = currentNode.parentNode;
    }
    return false;
  },

  /**
   * Apply bold formatting to the selected range
   * This function will be serialized and executed directly in iframe
   */
  apply: (range: Range): void => {
    console.log('DEBUG: Applying bold formatting');

    // Create strong element
    const strongElement = document.createElement('strong');

    // Extract the content and process it to remove any nested spans
    const selectedContent = range.extractContents();
    const fragment = document.createDocumentFragment();

    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        fragment.appendChild(node.cloneNode(true));
      } else if (node.nodeName === 'SPAN') {
        // If it's a span, extract its content without the span wrapper
        while (node.firstChild) {
          const child = node.firstChild;
          node.removeChild(child);
          processNode(child);
        }
      } else {
        // For other elements, clone and process children
        const clone = node.cloneNode(false);
        fragment.appendChild(clone);
        while (node.firstChild) {
          const child = node.firstChild;
          node.removeChild(child);
          processNode(child);
        }
      }
    };

    // Process all nodes in the selected content
    Array.from(selectedContent.childNodes).forEach(processNode);

    // Add the processed content to the strong element
    strongElement.appendChild(fragment);
    range.insertNode(strongElement);
    console.log('DEBUG: Bold applied successfully');
  },

  /**
   * Remove bold formatting from the selected range
   * This function will be serialized and executed directly in iframe
   */
  remove: (range: Range): void => {
    console.log('DEBUG: Removing bold formatting');

    // Find the containing STRONG or B element
    let startNode : Node | null = range.startContainer;
    while (
      startNode &&
      startNode.nodeName !== 'STRONG' &&
      startNode.nodeName !== 'B'
    ) {
      startNode = startNode.parentNode;
    }

    console.log('DEBUG: Found bold element to remove:', startNode);

    if (
      startNode &&
      (startNode.nodeName === 'STRONG' || startNode.nodeName === 'B')
    ) {
      // Create a document fragment to hold the extracted content
      const fragment = document.createDocumentFragment();

      // Extract selected content
      const selectedContent = range.extractContents();

      const processNode = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          fragment.appendChild(node.cloneNode(true));
        } else if (node.nodeName === 'SPAN') {
          // If it's a span, extract its content without the span wrapper
          while (node.firstChild) {
            const child = node.firstChild;
            node.removeChild(child);
            processNode(child);
          }
        } else {
          // For other elements, clone and process children
          const clone = node.cloneNode(false);
          fragment.appendChild(clone);
          while (node.firstChild) {
            const child = node.firstChild;
            node.removeChild(child);
            processNode(child);
          }
        }
      };

      // Process all nodes in the selected content
      Array.from(selectedContent.childNodes).forEach(processNode);

      // Insert the processed fragment back
      range.insertNode(fragment);
      console.log('DEBUG: Inserted fragment back');

      // Remove the STRONG or B element
      const boldParent = range.commonAncestorContainer.parentNode;
      console.log('DEBUG: Bold parent to remove:', boldParent);
      console.log('DEBUG: Bold parent nodeName:', boldParent?.nodeName);

      if (
        boldParent &&
        (boldParent.nodeName === 'STRONG' || boldParent.nodeName === 'B')
      ) {
        // Replace the STRONG or B with its contents
        const parentFragment = document.createDocumentFragment();
        while (boldParent.firstChild) {
          parentFragment.appendChild(boldParent.firstChild);
        }
        console.log('DEBUG: About to replace bold element');
        boldParent.parentNode!.replaceChild(parentFragment, boldParent);
        console.log('DEBUG: Bold element replaced successfully');
      } else {
        console.log('DEBUG: Bold parent not found or not STRONG/B element');
        // Try alternative approach - find and remove the STRONG or B element directly
        const boldElement = startNode;
        if (boldElement && boldElement.parentNode) {
          console.log('DEBUG: Using alternative removal approach');
          const altFragment = document.createDocumentFragment();
          while (boldElement.firstChild) {
            altFragment.appendChild(boldElement.firstChild);
          }
          boldElement.parentNode.replaceChild(altFragment, boldElement);
          console.log('DEBUG: Alternative removal completed');
        }
      }
    }
  },

  /**
   * Toolbar button configuration
   */
  toolbarButton: {
    label: 'B',
    title: 'Make selected text bold',
    shortcut: 'Ctrl+B',
  },
};
