'use strict';

import { getIndentation } from '../utils';

/**
 * Inserts formatted line tag between tags
 * @param  {CodeMirror} editor
 */
export function prev(editor) {
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

export default function(editor) {
	let sels = editor.listSelections().map(sel => ({
		sel,
		between: betweenTags(editor, sel)
	}));

	console.log(sels);

	if (!sels.some(item => item.between)) {
		return editor.constructor.Pass;
	}

	editor.operation(function() {
		const indent = getIndentation(editor);
		const newline = editor.doc.lineSeparator();
		sels.reverse();

		const newSels = sels.map(item => {
			const sel = item.sel;

			if (item.between) {
				const cursor = sel.anchor;
				const matchIndent = editor.getLine(cursor.line).match(/^\s+/);
				const curIndent = matchIndent ? matchIndent[0] : '';

				// Insert formatted line break
				const before = `\n${curIndent}${indent}`;
				const after = `\n${curIndent}`;
				editor.replaceRange(before + after, sel.anchor, sel.head, "+input");

				// Position cursor
				const startIx = editor.indexFromPos(cursor);
				const newCursor = editor.posFromIndex(startIx + before.length);
				return {
					anchor: newCursor,
					head: newCursor
				};
			}

			editor.replaceRange(newline, sel.anchor, sel.head, "+input");
			return {
				anchor: sel.anchor,
				head: sel.anchor,
				indent: true
			};
		});

		console.log('new sels', newSels);
		newSels.reverse();
		editor.setSelections(newSels);
	
		sels = editor.listSelections()
		for (let i = 0; i < sels.length; i++) {
			if (newSels[i] && newSels[i].indent) {
				editor.indentLine(sels[i].from().line, null, true);
			}
		}
	});
}

/**
 * Check if given range is a single caret between tags
 * @param {CodeMirror} editor 
 * @param {CodeMirror.range} range 
 */
function betweenTags(editor, range) {
	if (equalCursorPos(range.anchor, range.head)) {
		const cursor = range.anchor;
		const mode = editor.getModeAt(cursor);

		if (mode.name === 'xml') {
			const next = Object.assign({}, cursor, { ch: cursor.ch + 1 });
			const left = editor.getTokenAt(cursor);
			const right = editor.getTokenAt(Object.assign({}, cursor, { ch: cursor.ch + 1 }));

			return left.type === 'tag bracket' && left.string === '>'
				&& right.type === 'tag bracket' && right.string === '</';
		}
	}
}


// Compare two positions, return 0 if they are the same, a negative
// number when a is less, and a positive number otherwise.
function cmp(a, b) {
	return a.line - b.line || a.ch - b.ch;
}

function equalCursorPos(a, b) {
	return a.sticky === b.sticky && cmp(a, b) === 0;
}
