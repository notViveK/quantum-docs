// Export all formatter modules
import { BoldFormatter } from './BoldFormatter';
import type { FormatterModule } from '../types';

// Array of default formatters that can be easily configured
export const DEFAULT_FORMATTERS: FormatterModule[] = [
  BoldFormatter,
  // Future formatters can be added here:
  // ItalicFormatter,
  // UnderlineFormatter,
  // etc.
];

// Individual exports for selective usage
export { BoldFormatter };

// Export types
export type { FormatterModule } from '../types';
