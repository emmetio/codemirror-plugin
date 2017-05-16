'use strict';

import { getIndentation } from '../utils';

/**
 * Inserts formatted line tag between tags
 * @param  {CodeMirror} editor
 */
export default function(editor) {
	const cursor = editor.getCursor();
	const mode = editor.getModeAt(cursor);

	if (mode.name === 'xml') {
		const next = Object.assign({}, cursor, { ch: cursor.ch + 1 });
		const left = editor.getTokenAt(cursor);
		const right = editor.getTokenAt(Object.assign({}, cursor, { ch: cursor.ch + 1 }));

		if (left.type === 'tag bracket' && left.string === '>'
			&& right.type === 'tag bracket' && right.string === '</') {
				const matchIndent = editor.getLine(cursor.line).match(/^\s+/);
				const curIndent = matchIndent ? matchIndent[0] : '';
				const indent = getIndentation(editor);

				// Insert formatted line break
				const before = `\n${curIndent}${indent}`;
				const after = `\n${curIndent}`;
				editor.replaceRange(before + after, cursor, cursor);

				// Position cursor
				const startIx = editor.indexFromPos(cursor);
				const newCursor = editor.posFromIndex(startIx + before.length);
				editor.setCursor(newCursor);

				return;
			}
	}

	return editor.constructor.Pass;
}
