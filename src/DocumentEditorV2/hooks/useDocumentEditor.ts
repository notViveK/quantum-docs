// Main composition hook for DocumentEditor V2
import { useState, useEffect, useCallback } from 'react';
import type {
  FormatterModule,
  EditableTextNode,
  IframeMessageEvent,
} from '../types';
import { useTextNodes } from './useTextNodes';
import { useFormatting } from './useFormatting';
import { useVersionControl } from './useVersionControl';
import { findAndReplaceTextByPath, findNodeByPath } from '../utils/domUtils';

export const useDocumentEditor = (formatters: FormatterModule[] = []) => {
  // State management
  const [htmlTemplate, setHtmlTemplate] = useState<string>('');
  const [editedHtml, setEditedHtml] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  // Debug logging
  console.log('message', message);
  console.log('htmlTemplate', htmlTemplate);
  console.log('editedHtml', editedHtml);

  // Hooks
  const textNodes = useTextNodes();
  const formatting = useFormatting(formatters);
  const versionControl = useVersionControl();

  // Function to handle messages from the iframe (when text is edited)
  const handleIframeMessage = useCallback(
    (event: MessageEvent): void => {
      // Ensure message is from our iframe and has the expected structure
      if (
        event.data &&
        event.data.type === 'TEXT_EDITED' &&
        event.data.id &&
        event.data.newText !== undefined
      ) {
        const { id, newText, newHTML }: IframeMessageEvent = event.data;

        textNodes.updateTextNode(id, newText, newHTML);
        // Clear any previous messages
        setMessage('');
      }
    },
    [textNodes],
  );

  // Effect to add and remove event listener for iframe messages
  useEffect(() => {
    window.addEventListener('message', handleIframeMessage);
    return () => {
      window.removeEventListener('message', handleIframeMessage);
    };
  }, [handleIframeMessage]);

  // Effect to update the editedHtml when htmlTemplate changes
  useEffect(() => {
    if (htmlTemplate) {
      setEditedHtml(textNodes.prepareEditableHtml(htmlTemplate));
    } else {
      setEditedHtml('');
    }
  }, [htmlTemplate, textNodes]);

  // Function to reconstruct the original HTML template with changes
  const reconstructHtmlWithChanges = useCallback((): void => {
    if (!htmlTemplate) {
      setMessage('No HTML template to update.');
      return;
    }

    try {
      // Parse the original HTML template
      const parser: DOMParser = new DOMParser();
      const doc: Document = parser.parseFromString(htmlTemplate, 'text/html');

      let changesMade = false;

      // Group segmented nodes by path to handle multiple segments per text node
      const segmentedNodesByPath = new Map<
        string,
        Array<EditableTextNode & { id: string }>
      >();
      const regularNodes: Array<EditableTextNode & { id: string }> = [];

      // Categorize nodes
      textNodes
        .getAllTextNodes()
        .forEach((nodeData: EditableTextNode, id: string) => {
          if (nodeData.parentSegments && nodeData.segmentIndex !== undefined) {
            // This is a segmented node
            const pathKey = nodeData.path.join(',');
            if (!segmentedNodesByPath.has(pathKey)) {
              segmentedNodesByPath.set(pathKey, []);
            }
            segmentedNodesByPath.get(pathKey)!.push({ ...nodeData, id });
          } else {
            // This is a regular node
            regularNodes.push({ ...nodeData, id });
          }
        });

      // Process segmented nodes (grouped by path)
      segmentedNodesByPath.forEach(
        (
          nodesAtPath: Array<EditableTextNode & { id: string }>,
          pathKey: string,
        ) => {
          // Check if any segment in this group has changes
          const hasChanges = nodesAtPath.some(
            (nodeData) =>
              nodeData.newText !== nodeData.originalText ||
              nodeData.newHTML !== nodeData.originalHTML,
          );

          if (hasChanges) {
            console.log(
              `Processing segmented changes for path ${pathKey}:`,
              nodesAtPath,
            );

            // Get the original segments from any node (they should all be the same)
            const originalSegments = nodesAtPath[0].parentSegments!;

            // Reconstruct all segments, applying changes where they exist
            const reconstructedSegments = originalSegments.map(
              (originalSegment, segmentIndex) => {
                // Find if this segment was edited
                const editedNode = nodesAtPath.find(
                  (node) => node.segmentIndex === segmentIndex,
                );

                if (editedNode && !originalSegment.isFreemarker) {
                  // This segment was edited - use the new content
                  return {
                    content:
                      editedNode.newHTML !== editedNode.originalHTML
                        ? editedNode.newHTML
                        : editedNode.newText,
                    isFreemarker: false,
                  };
                }
                // This segment was not edited or is a FreeMarker variable - keep original
                return originalSegment;
              },
            );

            // Combine all segments back into full text
            const reconstructedText = reconstructedSegments
              .map((s) => s.content)
              .join('');
            const originalText = originalSegments
              .map((s) => s.content)
              .join('');

            console.log('Reconstructed text:', reconstructedText);
            console.log('Original text:', originalText);

            // Check if the reconstructed text contains HTML formatting
            const containsHTML =
              reconstructedText.includes('<') &&
              reconstructedText.includes('>');

            // Apply the reconstruction
            if (containsHTML) {
              // Handle HTML content
              const targetNode = findNodeByPath(doc.body, nodesAtPath[0].path);

              if (targetNode && targetNode.nodeType === Node.TEXT_NODE) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = reconstructedText;

                const fragment = document.createDocumentFragment();
                while (tempDiv.firstChild) {
                  fragment.appendChild(tempDiv.firstChild);
                }

                targetNode.parentNode!.replaceChild(fragment, targetNode);
                changesMade = true;
                console.log(
                  'Successfully replaced segmented HTML content for path:',
                  pathKey,
                );
              } else {
                console.log(
                  'Failed to find target node for segmented HTML content:',
                  pathKey,
                );
              }
            } else {
              // Handle plain text
              const success: boolean = findAndReplaceTextByPath(
                doc.body,
                nodesAtPath[0].path,
                originalText,
                reconstructedText,
                false,
              );

              if (success) {
                changesMade = true;
                console.log(
                  'Successfully replaced segmented text content for path:',
                  pathKey,
                );
              } else {
                console.log(
                  'Failed to replace segmented text content for path:',
                  pathKey,
                );
              }
            }
          }
        },
      );

      // 🔧 CRITICAL FIX: Process HTML changes in multiple passes to handle DOM structure changes
      console.log('🔄 DEBUG: Starting multi-pass processing for regular nodes...');
      
      // Separate HTML changes from text changes
      const htmlChanges: typeof regularNodes = [];
      const textChanges: typeof regularNodes = [];
      
      regularNodes.forEach((nodeData) => {
        if (
          nodeData.newText !== nodeData.originalText ||
          nodeData.newHTML !== nodeData.originalHTML
        ) {
          const isHTMLChange =
            nodeData.newHTML !== nodeData.originalHTML &&
            (nodeData.newHTML.includes('<') ||
              nodeData.originalHTML.includes('<'));
              
          if (isHTMLChange) {
            htmlChanges.push(nodeData);
          } else {
            textChanges.push(nodeData);
          }
        }
      });
      
      console.log(`🔄 DEBUG: Found ${htmlChanges.length} HTML changes and ${textChanges.length} text changes`);
      
      // Process HTML changes one by one, recalculating DOM after each change
      for (let i = 0; i < htmlChanges.length; i++) {
        const nodeData = htmlChanges[i];
        console.log(`🔄 DEBUG: Processing HTML change ${i + 1}/${htmlChanges.length}:`, nodeData);
        
        const success: boolean = findAndReplaceTextByPath(
          doc.body,
          nodeData.path,
          nodeData.originalText,
          nodeData.newHTML,
          true, // This is HTML content
        );

        if (success) {
          changesMade = true;
          console.log(`✅ Successfully applied HTML formatting change ${i + 1}/${htmlChanges.length}`);
          
          // 🔧 CRITICAL: Recalculate DOM paths for remaining changes
          if (i < htmlChanges.length - 1) {
            console.log('🔄 DEBUG: Recalculating DOM paths for remaining HTML changes...');
            
            // Update paths for remaining HTML changes
            for (let j = i + 1; j < htmlChanges.length; j++) {
              const remainingChange = htmlChanges[j];
              const updatedNode = textNodes.editableTextNodes.current.get(remainingChange.id);
              if (updatedNode) {
                htmlChanges[j] = { ...remainingChange, path: updatedNode.path };
                console.log(`🔄 DEBUG: Updated path for HTML change ${j + 1}: ${updatedNode.path}`);
              }
            }
            console.log('✅ DEBUG: DOM paths recalculated for remaining HTML changes');
          }
        } else {
          console.log(`❌ Failed to apply HTML formatting change ${i + 1}/${htmlChanges.length}`);
        }
      }
      
      // Process text changes (these don't change DOM structure significantly)
      textChanges.forEach((nodeData) => {
        console.log('Processing text change:', nodeData);
        
        const success: boolean = findAndReplaceTextByPath(
          doc.body,
          nodeData.path,
          nodeData.originalText,
          nodeData.newText,
          false,
        );

        if (success) {
          changesMade = true;
          console.log('Successfully applied text change');
        } else {
          console.log('Failed to apply text change');
        }
      });
      
      console.log('✅ DEBUG: Multi-pass processing completed');

      if (changesMade) {
        const updatedHtml: string = doc.documentElement.outerHTML;

        // Save the NEW version with updated HTML
        versionControl.saveVersion(
          updatedHtml, // ✅ Save the NEW state, not the old one
          editedHtml,
          textNodes.editableTextNodes.current,
          'Document changes saved',
        );

        setHtmlTemplate(updatedHtml);
        setMessage('HTML template updated successfully with your changes!');
        console.log('Final updated HTML:', updatedHtml);
      } else {
        setMessage('No changes detected to save.');
        console.log('No changes were detected in the editable text nodes.');
      }
    } catch (error) {
      console.error('Error reconstructing HTML:', error);
      setMessage('Error updating HTML template. Please check the console.');
    }
  }, [htmlTemplate, textNodes, versionControl, editedHtml]);

  /**
   * Undo to previous version
   */
  const undoVersion = useCallback(() => {
    console.log('🔄 DEBUG: undoVersion called in useDocumentEditor');

    const snapshot = versionControl.undo();
    if (snapshot) {
      console.log('📦 DEBUG: Snapshot received for restoration:', {
        description: snapshot.description,
        id: snapshot.id.slice(-6),
        htmlTemplatePreview: `${snapshot.htmlTemplate.slice(0, 100)}...`,
        editedHtmlPreview: `${snapshot.editedHtml.slice(0, 100)}...`,
      });

      // Restore document state from snapshot
      console.log('🔄 DEBUG: Restoring htmlTemplate...');
      setHtmlTemplate(snapshot.htmlTemplate);

      console.log('🔄 DEBUG: Restoring editedHtml...');
      setEditedHtml(snapshot.editedHtml);

      // Restore textNodes state
      console.log('🔄 DEBUG: Deserializing and restoring textNodes...');
      const restoredTextNodes = versionControl.deserializeTextNodes(
        snapshot.textNodesData,
      );
      console.log(
        '📊 DEBUG: Restored textNodes count:',
        restoredTextNodes.size,
      );
      textNodes.editableTextNodes.current = restoredTextNodes;

      setMessage(`Undone to: ${snapshot.description}`);
      console.log('✅ DEBUG: Document state restored from undo successfully');
    } else {
      console.log('❌ DEBUG: No snapshot returned from undo');
      setMessage('Cannot undo - no previous versions available.');
    }
  }, [versionControl, textNodes]);

  /**
   * Go to specific version with complete state restoration (for timeline navigation)
   */
  const goToVersionWithRestore = useCallback(
    (index: number) => {
      console.log(`🎯 DEBUG: goToVersionWithRestore called for index ${index}`);

      const snapshot = versionControl.goToVersion(index);
      if (snapshot) {
        console.log('📦 DEBUG: Snapshot received for timeline restoration:', {
          description: snapshot.description,
          id: snapshot.id.slice(-6),
          htmlTemplatePreview: `${snapshot.htmlTemplate.slice(0, 100)}...`,
          editedHtmlPreview: `${snapshot.editedHtml.slice(0, 100)}...`,
        });

        // Restore complete document state from snapshot
        console.log(
          '🔄 DEBUG: Restoring htmlTemplate for timeline navigation...',
        );
        setHtmlTemplate(snapshot.htmlTemplate);

        console.log(
          '🔄 DEBUG: Restoring editedHtml for timeline navigation...',
        );
        setEditedHtml(snapshot.editedHtml);

        // Restore textNodes state
        console.log(
          '🔄 DEBUG: Deserializing and restoring textNodes for timeline navigation...',
        );
        const restoredTextNodes = versionControl.deserializeTextNodes(
          snapshot.textNodesData,
        );
        console.log(
          '📊 DEBUG: Restored textNodes count for timeline:',
          restoredTextNodes.size,
        );
        textNodes.editableTextNodes.current = restoredTextNodes;

        setMessage(`Navigated to: ${snapshot.description}`);
        console.log(
          '✅ DEBUG: Complete state restored from timeline navigation successfully',
        );
      } else {
        console.log('❌ DEBUG: No snapshot returned from timeline navigation');
        setMessage('Cannot navigate to that version.');
      }
    },
    [versionControl, textNodes],
  );

  /**
   * Redo to next version
   */
  const redoVersion = useCallback(() => {
    const snapshot = versionControl.redo();
    if (snapshot) {
      // Restore document state from snapshot
      setHtmlTemplate(snapshot.htmlTemplate);
      setEditedHtml(snapshot.editedHtml);

      // Restore textNodes state
      const restoredTextNodes = versionControl.deserializeTextNodes(
        snapshot.textNodesData,
      );
      textNodes.editableTextNodes.current = restoredTextNodes;

      setMessage(`Redone to: ${snapshot.description}`);
      console.log('DEBUG: Document state restored from redo');
    } else {
      setMessage('Cannot redo - no newer versions available.');
    }
  }, [versionControl, textNodes]);

  // Generate iframe content with CSS and JavaScript
  const getIframeContent = useCallback(
    (htmlContent: string): string => {
      const iframeCSS = `
      body { 
        font-family: sans-serif; 
        margin: 20px; 
        text-align: justify; 
      }
      [contenteditable="true"] {
        text-decoration: inherit;
        outline: none;
        display: inline;
        cursor: text;
      }
      u {
        text-decoration: underline;
      }
      strong {
        font-weight: bold;
      }
      em {
        font-style: italic;
      }
      .freemarker-variable {
        background-color: rgba(255, 193, 7, 0.2);
        border: 1px solid #ffc107;
        border-radius: 3px;
        padding: 1px 3px;
        font-family: monospace;
        font-size: 0.9em;
      }
      /* Inherit styles from your original HTML template */
      ${htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1] || ''}
    `;

      const iframeJS = `
      function enableInlineEditing() {
        const editableElements = document.querySelectorAll('[contenteditable="true"][data-editable-id]');
        
        editableElements.forEach(function(element) {
          const id = element.getAttribute('data-editable-id');
          
          // Add multiple event listeners to catch text changes
          function sendUpdate() {
            const newText = element.textContent || element.innerText || '';
            const newHTML = element.innerHTML || '';
            console.log('Sending update for', id, ':', newText, newHTML);
            
            window.parent.postMessage({
              type: 'TEXT_EDITED',
              id: id,
              newText: newText,
              newHTML: newHTML
            }, '*');
          }
          
          // Listen for various events that indicate text change
          element.addEventListener('blur', sendUpdate);
          element.addEventListener('input', sendUpdate);
          element.addEventListener('keyup', sendUpdate);
          
          // Handle paste events
          element.addEventListener('paste', function(e) {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
            setTimeout(sendUpdate, 10); // Small delay to ensure DOM is updated
          });
          
          // Prevent rich text formatting
          element.addEventListener('keydown', function(e) {
            // Allow basic editing keys
            const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
            
            // Prevent formatting shortcuts
            if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
              e.preventDefault();
            }
          });
          
          // Add visual feedback
          element.addEventListener('focus', function() {
            this.style.backgroundColor = 'rgba(34, 208, 129, 0.2)';
          });
          
          element.addEventListener('blur', function() {
            this.style.backgroundColor = '';
          });
        });
      }

      // Run the function once the iframe content is loaded
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enableInlineEditing);
      } else {
        enableInlineEditing();
      }
      
      // Also run when window loads as a fallback
      window.addEventListener('load', enableInlineEditing);

      ${formatting.generateIframeJS()}
    `;

      return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Preview</title>
        <style>${iframeCSS}</style>
      </head>
      <body>
        ${htmlContent.replace(/<style[^>]*>([\s\S]*?)<\/style>/i, '')}
        <script>${iframeJS}</script>
      </body>
      </html>
    `;
    },
    [formatting],
  );

  return {
    // State
    htmlTemplate,
    setHtmlTemplate,
    editedHtml,
    message,

    // Functions
    reconstructHtmlWithChanges,
    getIframeContent,

    // Formatting
    applyFormatting: formatting.applyFormatting,
    activeFormatters: formatting.activeFormatters,

    // Text nodes
    editableTextNodes: textNodes.editableTextNodes,

    // Version Control
    undoVersion,
    redoVersion,
    canUndo: versionControl.canUndo,
    canRedo: versionControl.canRedo,
    versionInfo: versionControl.getCurrentVersionInfo(),
    clearVersionHistory: versionControl.clearHistory,
    goToVersion: goToVersionWithRestore, // Use complete state restoration function
    versions: versionControl.versions,
  };
};
