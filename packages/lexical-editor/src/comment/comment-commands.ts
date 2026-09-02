import { createCommand } from 'lexical';

/**
 * Open / close the comment composer for the current selection.
 * Payload: open (true) or close (false).
 */
export const TOGGLE_COMMENT_INPUT_COMMAND = createCommand<boolean>(
  'TOGGLE_COMMENT_INPUT_COMMAND',
);
