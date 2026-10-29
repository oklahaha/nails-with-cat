/**
 * For list rows with a long-press ContextMenu: the row draws its own padding
 * and background, with zero list insets, so the long press lifts the whole
 * row. Otherwise iOS lifts a see-through cut-out of the row's content, and
 * the rounded first and last rows of a section vanish while the menu is open.
 */
import {
  background,
  contentShape,
  listRowInsets,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';

/** insetGrouped's row colour in dark mode (secondarySystemGroupedBackground). */
export const LIST_ROW_COLOR = '#1C1C1E';

/** On the row's outermost view in the List (the ContextMenu, or an Alert around it). */
export const ownRowInsets = listRowInsets({ top: 0, bottom: 0, leading: 0, trailing: 0 });

/** On the row's content: the insets and background the List would have drawn. */
export function ownRowBackground(vertical = 10) {
  return [
    padding({ horizontal: 16, vertical }),
    background(LIST_ROW_COLOR),
    contentShape(shapes.rectangle(), 'contextMenuPreview'),
  ];
}
