'use strict';

import parseFields from '@emmetio/field-parser';
import { normalizeText } from './utils';

/**
 * Replaces `range` in `editor` with `text` snippet. A snippet is a string containing
 * tabstops/fields like `${index:placeholder}`: this function will locate such 
 * fields and place cursor at first one.
 * Inserted snippet will be automatically matched with current editor indentation
 * @param {CodeMirror.Editor} editor 
 * @param {CodeMirror.Range} range 
 * @param {String} text
 */
export default function insertSnippet(editor, range, text) {
	const line = editor.getLine(range.from.line);
	const matchIndent = line.match(/^\s+/);
	let snippet = normalizeText(editor, text, matchIndent && matchIndent[0]);
	const fieldModel = parseFields(snippet);
	
	return editor.operation(() => {
		editor.replaceRange(fieldModel.string, range.from, range.to);

		// Position cursor
		const startIx = editor.indexFromPos(range.from);
		if (fieldModel.fields.length) {
			const field = fieldModel.fields[0];
			const from = editor.posFromIndex(field.location + startIx);
			const to = editor.posFromIndex(field.location + field.length + startIx);
			editor.setSelection(from, to);
		} else {
			editor.setCursor(editor.posFromIndex(startIx + fieldModel.string.length));
		}

		return true;
	});
}
