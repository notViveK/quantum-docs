// DocumentEditor V2 - Main component with modular architecture
import React, { useState } from 'react';
import './DocumentEditorV2.css';
import { useDocumentEditor } from './hooks/useDocumentEditor';
import { DEFAULT_FORMATTERS } from './formatters';

const DocumentEditorV2: React.FC = () => {
  // Use the composition hook with default formatters
  const {
    htmlTemplate,
    setHtmlTemplate,
    editedHtml,
    message,
    reconstructHtmlWithChanges,
    getIframeContent,
    applyFormatting,
    activeFormatters,
    // Version Control
    undoVersion,
    redoVersion,
    canUndo,
    canRedo,
    versionInfo,
    goToVersion,
    versions,
  } = useDocumentEditor(DEFAULT_FORMATTERS);

  // Timeline UI state
  const [showTimeline, setShowTimeline] = useState(false);

  return (
    <div className="document-editor-container">
      <h1 className="document-editor-title">Document Template Editor V2</h1>

      <div className="document-editor-main">
        {/* Left Pane: HTML Template Input */}
        <div className="document-editor-pane">
          <h2 className="document-editor-pane-title">
            Input HTML Template (FreeMarker)
          </h2>
          <textarea
            className="document-editor-textarea"
            placeholder="Paste your FreeMarker HTML template here..."
            value={htmlTemplate}
            onChange={(e) => setHtmlTemplate(e.target.value)}
          />
          {message && (
            <p
              className={`document-editor-message ${
                message.includes('Error') ? 'error' : 'success'
              }`}
            >
              {message}
            </p>
          )}
          {/* Version Control and Save Controls */}
          <div className="document-editor-controls">
            <div className="document-editor-version-controls">
              <button
                type="button"
                onClick={undoVersion}
                disabled={!canUndo}
                className="document-editor-button document-editor-version-button"
                title="Undo to previous version"
              >
                ↶ Undo
              </button>
              <button
                type="button"
                onClick={redoVersion}
                disabled={!canRedo}
                className="document-editor-button document-editor-version-button"
                title="Redo to next version"
              >
                ↷ Redo
              </button>
              <span className="document-editor-version-info">
                {versionInfo.total > 0
                  ? `Version ${versionInfo.current}/${versionInfo.total}`
                  : 'No versions saved'}
              </span>
              <button
                type="button"
                onClick={() => setShowTimeline(!showTimeline)}
                className="document-editor-version-button"
              >
                <span role="img" aria-label="Timeline">
                  📋
                </span>{' '}
                {showTimeline ? 'Hide' : 'Timeline'}
              </button>
            </div>

            {/* Timeline UI */}
            {showTimeline && versions.length > 0 && (
              <div className="document-editor-timeline">
                <h3 className="document-editor-timeline-title">
                  Version History Timeline
                </h3>
                <div className="document-editor-timeline-container">
                  <div className="document-editor-timeline-line" />
                  {versions.map((version, index) => {
                    const isCurrent = index === versionInfo.current - 1;
                    const isPast = index < versionInfo.current - 1;
                    const isFuture = index > versionInfo.current - 1;

                    // Determine timeline point class
                    let timelineClass = 'future';
                    if (isCurrent) {
                      timelineClass = 'current';
                    } else if (isPast) {
                      timelineClass = 'past';
                    }

                    const handleKeyDown = (event: React.KeyboardEvent) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        if (goToVersion) {
                          goToVersion(index);
                        }
                      }
                    };

                    return (
                      <div
                        key={version.id}
                        className={`document-editor-timeline-point ${timelineClass}`}
                        onClick={() => goToVersion && goToVersion(index)}
                        onKeyDown={handleKeyDown}
                        role="button"
                        tabIndex={0}
                        title={`${
                          version.description
                        }\n${version.timestamp.toLocaleString()}`}
                        style={{
                          left: `${
                            (index / Math.max(versions.length - 1, 1)) * 100
                          }%`,
                        }}
                      >
                        <div className="document-editor-timeline-dot" />
                        <div className="document-editor-timeline-label">
                          <div className="document-editor-timeline-version">
                            v{index + 1}
                          </div>
                          <div className="document-editor-timeline-time">
                            {version.timestamp.toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                        <div className="document-editor-timeline-tooltip">
                          <div className="document-editor-timeline-tooltip-title">
                            {version.description}
                          </div>
                          <div className="document-editor-timeline-tooltip-time">
                            {version.timestamp.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={reconstructHtmlWithChanges}
              className="document-editor-button document-editor-save-button"
            >
              Save HTML (Update Left Panel)
            </button>
          </div>
        </div>

        {/* Right Pane: Live Preview with Editable Text */}
        <div className="document-editor-pane">
          <h2 className="document-editor-pane-title">
            Live Preview (Editable Static Text)
          </h2>

          {/* Compact Formatting Toolbar */}
          <div className="document-editor-formatting-toolbar">
            {activeFormatters.map((formatter) => (
              <button
                key={formatter.name}
                type="button"
                onClick={() => applyFormatting(formatter.name)}
                className="document-editor-format-button"
                title={formatter.toolbarButton.title}
              >
                {formatter.toolbarButton.label}
              </button>
            ))}
          </div>

          <div className="document-editor-preview-container">
            {htmlTemplate ? (
              <iframe
                srcDoc={getIframeContent(editedHtml)}
                title="HTML Preview"
                className="document-editor-iframe"
                sandbox="allow-scripts allow-same-origin" // Essential for script injection to work
              />
            ) : (
              <div className="document-editor-placeholder">
                Paste HTML into the left editor to see a preview.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentEditorV2;
