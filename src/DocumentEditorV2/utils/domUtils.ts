// DOM manipulation utilities for DocumentEditor V2

/**
 * Helper function to navigate to a specific node using its path
 */
export const findNodeByPath = (
  startNode: Node,
  path: number[],
): Node | null => {
  let currentNode: Node = startNode;

  try {
    path.forEach((index) => {
      if (index >= currentNode.childNodes.length) {
        console.error(
          'Path index out of bounds:',
          index,
          'at node:',
          currentNode,
        );
        throw new Error('Path index out of bounds');
      }
      currentNode = currentNode.childNodes[index];
    });
    return currentNode;
  } catch (error) {
    console.error('Error navigating path:', path, error);
    return null;
  }
};

/**
 * Helper function to find and replace text using precise path navigation
 */
export const findAndReplaceTextByPath = (
  startNode: Node,
  path: number[],
  originalText: string,
  newContent: string,
  isHTML = false,
): boolean => {
  // Navigate directly to the target node using the path
  const targetNode = findNodeByPath(startNode, path);

  if (!targetNode) {
    console.error('Could not find node at path:', path);
    return false;
  }

  // Verify this is a text node and contains the expected content
  if (targetNode.nodeType !== Node.TEXT_NODE) {
    console.error('Target node is not a text node:', targetNode);
    return false;
  }

  const textNode = targetNode as Text;

  // Verify the content matches what we expect
  console.log('🔍 DEBUG: Text content comparison:', {
    path,
    expectedText: originalText,
    expectedTrimmed: originalText.trim(),
    foundText: textNode.nodeValue,
    foundTrimmed: textNode.nodeValue?.trim(),
    exactMatch: textNode.nodeValue === originalText,
    trimmedMatch: textNode.nodeValue?.trim() === originalText.trim(),
  });

  if (
    !textNode.nodeValue ||
    textNode.nodeValue.trim() !== originalText.trim()
  ) {
    console.error(
      '❌ DEBUG: Text content mismatch. Expected:',
      JSON.stringify(originalText),
      'Found:',
      JSON.stringify(textNode.nodeValue),
    );
    console.error('❌ DEBUG: Character-by-character comparison:');
    console.error('Expected chars:', [...originalText.trim()]);
    console.error('Found chars:', [...(textNode.nodeValue?.trim() || '')]);
    
    // 🔧 FALLBACK: Try content-based search as alternative to path-based targeting
    console.log('🔄 DEBUG: Attempting content-based fallback search...');
    const fallbackResult = findAndReplaceByContent(startNode, originalText, newContent, isHTML);
    if (fallbackResult) {
      console.log('✅ DEBUG: Content-based fallback succeeded!');
      return true;
    }
    console.log('❌ DEBUG: Content-based fallback also failed');
    return false;
  }

  // Perform the replacement
  try {
    if (isHTML) {
      if (newContent.includes('<') && newContent.includes('>')) {
        // Handle HTML content replacement (adding formatting)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newContent;

        // Replace text node with HTML content
        const fragment = document.createDocumentFragment();
        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild);
        }
        textNode.parentNode!.replaceChild(fragment, textNode);
      } else {
        // Handle removing HTML formatting (HTML to plain text)
        // Check if the text node is inside a formatting element that should be removed
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
          // Replace the formatting element with just the text content
          const textNodeNew = document.createTextNode(newContent);
          parentElement.parentNode!.replaceChild(textNodeNew, parentElement);
        } else {
          // Simple text replacement
          textNode.nodeValue = newContent;
        }
      }
    } else {
      // Simple text replacement
      textNode.nodeValue = newContent;
    }

    console.log(
      'Successfully replaced text at path:',
      path,
      'from:',
      originalText,
      'to:',
      newContent,
    );
    return true;
  } catch (error) {
    console.error('Error replacing text:', error);
    return false;
  }
};

/**
 * Legacy function kept for backward compatibility (but now uses path-based approach)
 */
export const findAndReplaceText = (
  node: Node,
  originalText: string,
  newContent: string,
  isHTML = false,
): boolean => {
  // This is now a fallback that searches recursively
  // But the main replacement logic should use findAndReplaceTextByPath
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node as Text;

    // Check if this text node contains the original text
    if (
      textNode.nodeValue &&
      textNode.nodeValue.trim() === originalText.trim()
    ) {
      if (isHTML && newContent.includes('<') && newContent.includes('>')) {
        // Handle HTML content replacement
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newContent;

        // Replace text node with HTML content
        const fragment = document.createDocumentFragment();
        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild);
        }
        textNode.parentNode!.replaceChild(fragment, textNode);
      } else {
        // Simple text replacement
        textNode.nodeValue = newContent;
      }
      return true;
    }
    // Also handle partial matches for multi-word text
    if (textNode.nodeValue && textNode.nodeValue.includes(originalText)) {
      if (isHTML && newContent.includes('<') && newContent.includes('>')) {
        // Handle partial HTML replacement
        const updatedContent = textNode.nodeValue.replace(
          originalText,
          newContent,
        );
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = updatedContent;

        const fragment = document.createDocumentFragment();
        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild);
        }
        textNode.parentNode!.replaceChild(fragment, textNode);
      } else {
        textNode.nodeValue = textNode.nodeValue.replace(
          originalText,
          newContent,
        );
      }
      return true;
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element;

    // Skip script and style tags
    if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
      return false;
    }

    // Check if this element's text content matches what we're looking for
    if (
      element.textContent &&
      element.textContent.trim() === originalText.trim()
    ) {
      if (isHTML && newContent.includes('<') && newContent.includes('>')) {
        element.innerHTML = newContent;
      } else {
        element.textContent = newContent;
      }
      return true;
    }

    // Recursively search child nodes
    for (let i = 0; i < element.childNodes.length; i += 1) {
      if (
        findAndReplaceText(
          element.childNodes[i],
          originalText,
          newContent,
          isHTML,
        )
      ) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Content-based fallback function for when path-based targeting fails
 * Searches through all text nodes to find exact content match
 */
const findAndReplaceByContent = (
  startNode: Node,
  originalText: string,
  newContent: string,
  isHTML: boolean = false,
): boolean => {
  console.log('🔍 DEBUG: Starting content-based search for:', JSON.stringify(originalText.trim()));
  
  // Walk through all text nodes in the document
  const walker = document.createTreeWalker(
    startNode,
    NodeFilter.SHOW_TEXT,
    null,
  );

  let currentNode: Node | null;
  while ((currentNode = walker.nextNode())) {
    const textNode = currentNode as Text;
    
    if (textNode.nodeValue && textNode.nodeValue.trim() === originalText.trim()) {
      console.log('✅ DEBUG: Found matching text node via content search!');
      console.log('🔍 DEBUG: Match details:', {
        foundText: JSON.stringify(textNode.nodeValue),
        expectedText: JSON.stringify(originalText),
        parentElement: textNode.parentElement?.tagName,
      });
      
      // Apply the same replacement logic as path-based approach
      try {
        if (isHTML) {
          if (newContent.includes('<') && newContent.includes('>')) {
            // Handle HTML content replacement (adding formatting)
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newContent;

            // Replace text node with HTML content
            const fragment = document.createDocumentFragment();
            while (tempDiv.firstChild) {
              fragment.appendChild(tempDiv.firstChild);
            }
            textNode.parentNode!.replaceChild(fragment, textNode);
          } else {
            // Handle removing HTML formatting (HTML to plain text)
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
              // Replace the formatting element with just the text content
              const textNodeNew = document.createTextNode(newContent);
              parentElement.parentNode!.replaceChild(textNodeNew, parentElement);
            } else {
              // Simple text replacement
              textNode.nodeValue = newContent;
            }
          }
        } else {
          // Simple text replacement
          textNode.nodeValue = newContent;
        }

        console.log(
          '✅ Successfully replaced text via content-based search:',
          'from:',
          originalText,
          'to:',
          newContent,
        );
        return true;
      } catch (error) {
        console.error('❌ Error during content-based replacement:', error);
        return false;
      }
    }
  }
  
  console.log('❌ DEBUG: No matching text node found via content search');
  return false;
};
