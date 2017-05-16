'use strict';

import extract from '@emmetio/extract-abbreviation';
import { expand } from '@emmetio/expand-abbreviation';
import { normalizeText } from '../utils';

const cursorMark = '[[::emmet-cursor::]]';

/**
 * Expand abbreviation command
 * @param  {CodeMirror} editor
 */
export default function(editor) {
	const cursor = editor.getCursor();
	const line = editor.getLine(cursor.line);

	// Extract Emmet abbreviation from current line with “look-ahead”,
	// e.g. capture auto-closed braces like `)`, `}` or `]` right after current
	// cursor position
	const extracted = extract(line, cursor.ch, true);
	if (!extracted) {
		// No valid abbreviation, abort key handling
		return editor.constructor.Pass;
	}

	let cursorMarked = false;
	const expandOpt = {
		// CodeMirror doesn’t support snippets with tab-stops natively so we have
		// to mark first output with a special token so we can find it later
		// to properly plant cursor into new position
		field(index, placeholder = '') {
			if (!cursorMarked) {
				cursorMarked = true;
				placeholder = cursorMark + placeholder;
			}

			return placeholder;
		}
	};

	let expanded = expand(extracted.abbreviation, expandOpt);
	let newCursorPos = expanded.length;
	if (cursorMarked) {
		newCursorPos = expanded.indexOf(cursorMark);
		expanded = expanded.slice(0, newCursorPos) + expanded.slice(newCursorPos + cursorMark.length);
	}

	const matchIndent = line.match(/^\s+/);

	// Replace abbreviation with expaned result
	const rangeStart = pos(cursor.line, extracted.location);
	const rangeEnd = pos(cursor.line, extracted.location + extracted.abbreviation.length);
	editor.replaceRange(normalizeText(editor, expanded, matchIndent && matchIndent[0]), rangeStart, rangeEnd);

	// Position cursor
	const startIx = editor.indexFromPos(rangeStart);
	editor.setCursor(startIx + editor.posFromIndex(newCursorPos));

	return expanded;
}

function pos(line, ch) {
	return { line, ch };
}
