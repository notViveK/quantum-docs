// Version control hook for DocumentEditor V2
import { useState, useCallback } from 'react';
import type { EditableTextNode } from '../types';

/**
 * Document snapshot interface for version control
 */
export interface DocumentSnapshot {
  id: string;
  htmlTemplate: string;
  editedHtml: string;
  textNodesData: string; // Serialized textNodes Map
  timestamp: Date;
  description: string;
}

/**
 * Version control hook for managing document history
 */
export const useVersionControl = () => {
  // State for version history
  const [versions, setVersions] = useState<DocumentSnapshot[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // Maximum number of versions to keep
  const MAX_VERSIONS = 10;

  /**
   * Serialize textNodes Map to string for storage
   */
  const serializeTextNodes = useCallback(
    (textNodes: Map<string, EditableTextNode>): string => {
      try {
        const entries = Array.from(textNodes.entries());
        return JSON.stringify(entries);
      } catch (error) {
        console.error('Error serializing textNodes:', error);
        return '[]';
      }
    },
    [],
  );

  /**
   * Deserialize string back to textNodes Map
   */
  const deserializeTextNodes = useCallback(
    (serializedData: string): Map<string, EditableTextNode> => {
      try {
        const entries = JSON.parse(serializedData);
        return new Map(entries);
      } catch (error) {
        console.error('Error deserializing textNodes:', error);
        return new Map();
      }
    },
    [],
  );

  /**
   * Save a new version snapshot
   */
  const saveVersion = useCallback(
    (
      htmlTemplate: string,
      editedHtml: string,
      textNodes: Map<string, EditableTextNode>,
      description = 'Document saved',
    ) => {
      console.log('🔄 DEBUG: saveVersion called');
      console.log('📊 DEBUG: Current state before save:', {
        currentIndex,
        versionsLength: versions.length,
        description,
      });
      const newSnapshot: DocumentSnapshot = {
        id: `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        htmlTemplate,
        editedHtml,
        textNodesData: serializeTextNodes(textNodes),
        timestamp: new Date(),
        description,
      };

      setVersions((prevVersions) => {
        console.log(
          '🔍 DEBUG: setVersions callback - prevVersions:',
          prevVersions.map((v, i) => ({ index: i, desc: v.description })),
        );

        // Remove any versions after current index (if user was in middle of history)
        const trimmedVersions = prevVersions.slice(0, currentIndex + 1);
        console.log(
          '✂️ DEBUG: trimmedVersions:',
          trimmedVersions.map((v, i) => ({ index: i, desc: v.description })),
        );

        // Add new version
        const newVersions = [...trimmedVersions, newSnapshot];
        console.log(
          '➕ DEBUG: newVersions after adding:',
          newVersions.map((v, i) => ({ index: i, desc: v.description })),
        );

        // Keep only last MAX_VERSIONS
        const finalVersions = newVersions.slice(-MAX_VERSIONS);
        console.log(
          '🎯 DEBUG: finalVersions:',
          finalVersions.map((v, i) => ({ index: i, desc: v.description })),
        );

        const newCurrentIndex = finalVersions.length - 1;
        console.log(`📍 DEBUG: Setting currentIndex to: ${newCurrentIndex}`);

        // Update current index to point to the new version (last in array)
        setCurrentIndex(newCurrentIndex);

        console.log(
          `✅ DEBUG: Saved version "${description}" (${finalVersions.length}/${MAX_VERSIONS})`,
        );

        return finalVersions;
      });
    },
    [currentIndex, serializeTextNodes, versions.length],
  );

  /**
   * Undo to previous version
   */
  const undo = useCallback((): DocumentSnapshot | null => {
    console.log('⏪ DEBUG: undo called');
    console.log('📊 DEBUG: Current state before undo:', {
      currentIndex,
      versionsLength: versions.length,
      versions: versions.map((v, i) => ({
        index: i,
        desc: v.description,
        id: v.id.slice(-6),
      })),
    });

    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      console.log(`🎯 DEBUG: Moving from index ${currentIndex} to ${newIndex}`);

      setCurrentIndex(newIndex);
      const snapshot = versions[newIndex];

      console.log('📄 DEBUG: Retrieved snapshot:', {
        index: newIndex,
        description: snapshot.description,
        id: snapshot.id.slice(-6),
        htmlPreview: `${snapshot.htmlTemplate.slice(0, 100)}...`,
      });

      console.log(
        `✅ DEBUG: Undo to version "${snapshot.description}" (${newIndex + 1}/${
          versions.length
        })`,
      );
      return snapshot;
    }
    console.log('❌ DEBUG: Cannot undo - already at oldest version');
    return null;
  }, [currentIndex, versions]);

  /**
   * Redo to next version
   */
  const redo = useCallback((): DocumentSnapshot | null => {
    if (currentIndex < versions.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      const snapshot = versions[newIndex];
      console.log(
        `DEBUG: Redo to version "${snapshot.description}" (${newIndex + 1}/${
          versions.length
        })`,
      );
      return snapshot;
    }
    console.log('DEBUG: Cannot redo - already at newest version');
    return null;
  }, [currentIndex, versions.length]);

  /**
   * Go to specific version by index
   */
  const goToVersion = useCallback(
    (index: number): DocumentSnapshot | null => {
      if (index >= 0 && index < versions.length) {
        setCurrentIndex(index);
        const snapshot = versions[index];
        console.log(
          `DEBUG: Navigate to version "${snapshot.description}" (${index + 1}/${
            versions.length
          })`,
        );
        return snapshot;
      }
      console.log(`DEBUG: Invalid version index: ${index}`);
      return null;
    },
    [versions],
  );

  /**
   * Get current version info
   */
  const getCurrentVersionInfo = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < versions.length) {
      return {
        current: currentIndex + 1,
        total: versions.length,
        description: versions[currentIndex].description,
        timestamp: versions[currentIndex].timestamp,
      };
    }
    return {
      current: 0,
      total: versions.length,
      description: 'No versions saved',
      timestamp: new Date(),
    };
  }, [currentIndex, versions]);

  /**
   * Clear all version history
   */
  const clearHistory = useCallback(() => {
    setVersions([]);
    setCurrentIndex(-1);
    console.log('DEBUG: Version history cleared');
  }, []);

  // Computed properties
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < versions.length - 1;
  const hasVersions = versions.length > 0;

  return {
    // State
    versions,
    currentIndex,
    canUndo,
    canRedo,
    hasVersions,

    // Actions
    saveVersion,
    undo,
    redo,
    goToVersion,
    clearHistory,

    // Utilities
    getCurrentVersionInfo,
    deserializeTextNodes,
  };
};
