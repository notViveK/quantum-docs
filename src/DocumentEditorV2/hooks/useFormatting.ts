// Formatting management hook for DocumentEditor V2
import { useCallback, useState } from 'react';
import type { FormatterModule } from '../types';

export const useFormatting = (formatters: FormatterModule[]) => {
  const [activeFormatters] = useState<FormatterModule[]>(formatters);

  /**
   * Apply formatting to selected text in iframe
   */
  const applyFormatting = useCallback(
    (formatterName: string) => {
      console.log(`DEBUG: Applying ${formatterName} formatting`);

      // Find the formatter to get its configuration
      const formatter = activeFormatters.find((f) => f.name === formatterName);
      if (!formatter) {
        console.error(`Formatter '${formatterName}' not found`);
        return;
      }

      // Send message to iframe to apply the specific formatting
      const iframe = document.querySelector(
        '.document-editor-iframe',
      ) as HTMLIFrameElement;

      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          {
            type: 'APPLY_FORMATTING',
            formatterName,
            action: 'toggle', // Could be 'apply', 'remove', or 'toggle'
          },
          '*',
        );
      }
    },
    [activeFormatters],
  );

  /**
   * Get formatter by name
   */
  const getFormatter = useCallback(
    (name: string): FormatterModule | undefined => {
      return activeFormatters.find((formatter) => formatter.name === name);
    },
    [activeFormatters],
  );

  /**
   * Get all active formatters
   */
  const getActiveFormatters = useCallback(() => {
    return activeFormatters;
  }, [activeFormatters]);

  /**
   * Generate iframe JavaScript for formatting functionality using serialized formatter methods
   */
  const generateIframeJS = useCallback(() => {
    // Serialize formatter methods to inject into iframe
    const serializeFormatterMethods = () => {
      return activeFormatters.map((formatter) => ({
        name: formatter.name,
        detect: formatter.detect.toString(),
        apply: formatter.apply.toString(),
        remove: formatter.remove.toString(),
      }));
    };

    const serializedFormatters = serializeFormatterMethods();

    // Generate formatter logic that uses the actual serialized methods
    const generateFormatterLogic = (formatterName: string) => {
      return `
        console.log('DEBUG: Processing ${formatterName} formatting with action:', action);
        
        // Get the formatter methods
        const formatter = formatters['${formatterName}'];
        if (!formatter) {
          console.error('Formatter ${formatterName} not found');
          return;
        }
        
        // Use the actual detect method to check current state
        const isAlreadyFormatted = formatter.detect(range.startContainer) && formatter.detect(range.endContainer);
        console.log('DEBUG: ${formatterName} detection result:', isAlreadyFormatted, 'Action:', action);
        
        // Handle different actions using the actual formatter methods
        if (action === 'toggle') {
          if (isAlreadyFormatted) {
            console.log('DEBUG: Toggling OFF - removing ${formatterName}');
            formatter.remove(range, parentEditable);
          } else {
            console.log('DEBUG: Toggling ON - applying ${formatterName}');
            formatter.apply(range, parentEditable);
          }
        } else if (action === 'apply') {
          console.log('DEBUG: Force applying ${formatterName}');
          if (!isAlreadyFormatted) {
            formatter.apply(range, parentEditable);
          }
        } else if (action === 'remove') {
          console.log('DEBUG: Force removing ${formatterName}');
          if (isAlreadyFormatted) {
            formatter.remove(range, parentEditable);
          }
        }
      `;
    };

    return `
      // Inject serialized formatter methods into iframe context
      const formatters = {
        ${serializedFormatters
          .map(
            (f) => `
          '${f.name}': {
            detect: ${f.detect},
            apply: ${f.apply},
            remove: ${f.remove}
          }`,
          )
          .join(',')}
      };
      
      console.log('DEBUG: Formatters injected into iframe:', Object.keys(formatters));
      
      // Listen for messages from parent to apply formatting
      window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'APPLY_FORMATTING') {
          const { formatterName, action } = event.data;
          console.log('DEBUG: Applying formatting:', formatterName, action);
          
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            
            // Check if we have selected text
            if (!range.collapsed) {
              try {
                // Find the parent editable element BEFORE making any DOM changes
                const editableElements = document.querySelectorAll('[contenteditable="true"][data-editable-id]');
                let parentEditable = null;
                
                for (const el of editableElements) {
                  if (el.contains(range.commonAncestorContainer)) {
                    parentEditable = el;
                    break;
                  }
                }
                
                if (!parentEditable) {
                  console.log('ERROR: No parent editable element found');
                  return;
                }
                
                console.log('DEBUG: Found parent editable element:', parentEditable.getAttribute('data-editable-id'));
                
                // Apply formatter-specific logic using serialized methods
                ${activeFormatters
                  .map(
                    (formatter) => `
                if (formatterName === '${formatter.name}') {
                  ${generateFormatterLogic(formatter.name)}
                }`,
                  )
                  .join('')}
                
                // Clear selection
                selection.removeAllRanges();
                
                // Send update back to parent
                const id = parentEditable.getAttribute('data-editable-id');
                const newText = parentEditable.textContent || parentEditable.innerText || '';
                const newHTML = parentEditable.innerHTML || '';
                
                console.log('DEBUG: Sending update to parent:', {
                  id,
                  newText,
                  newHTML
                });
                
                window.parent.postMessage({
                  type: 'TEXT_EDITED',
                  id: id,
                  newText: newText,
                  newHTML: newHTML
                }, '*');
              } catch (error) {
                console.error('Error applying formatting:', error);
              }
            } else {
              console.log('No text selected for formatting');
            }
          }
        }
      });
    `;
  }, [activeFormatters]);

  return {
    activeFormatters,
    applyFormatting,
    getFormatter,
    getActiveFormatters,
    generateIframeJS,
  };
};
