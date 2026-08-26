import { createCommand } from 'lexical';

/**
 * Open / close the comment composer for the current selection.
 * Payload: open (true) or close (false).
 */
export const TOGGLE_COMMENT_INPUT_COMMAND = createCommand<boolean>(
  'TOGGLE_COMMENT_INPUT_COMMAND',
);

/**
 * Wrap the current selection in a mark tagged with the given thread id.
 */
export const WRAP_SELECTION_IN_MARK_COMMAND = createCommand<string>(
  'WRAP_SELECTION_IN_MARK_COMMAND',
);

/**
 * Remove all marks tagged with the given thread id (e.g. when the last
 * comment of a thread is deleted).
 */
export const UNWRAP_MARK_COMMAND = createCommand<string>('UNWRAP_MARK_COMMAND');
