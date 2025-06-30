// Type definitions for DocumentEditor V2
export interface EditableTextNode {
  originalText: string;
  originalHTML: string; // Store original HTML content
  newText: string;
  newHTML: string; // Store HTML content with formatting
  path: number[];
  segmentIndex?: number;
  parentSegments?: { content: string; isFreemarker: boolean }[];
}

// Interface for text segments when parsing FreeMarker content
export interface TextSegment {
  content: string;
  isFreemarker: boolean;
  startIndex: number;
  endIndex: number;
}

// Interface for formatter modules
export interface FormatterModule {
  name: string;
  detect: (node: Node) => boolean;
  apply: (range: Range) => void;
  remove: (range: Range) => void;
  toolbarButton: {
    label: string;
    title: string;
    shortcut?: string;
  };
}

// Interface for iframe message events
export interface IframeMessageEvent {
  type: 'TEXT_EDITED';
  id: string;
  newText: string;
  newHTML: string;
}
