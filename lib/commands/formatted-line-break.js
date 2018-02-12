'use strict';

export default function(editor) {
	const between = editor.listSelections().map(sel => betweenTags(editor, sel));

	if (!between.some(Boolean)) {
		return editor.constructor.Pass;
	}

	editor.operation(() => {
		let sels = editor.listSelections();
		const singleSep = editor.doc.lineSeparator();
		const doubleSep = singleSep + singleSep;

		// Step 1: insert newlines either single or double depending on selection
		for (let i = sels.length - 1; i >= 0; i--) {
			editor.replaceRange(between[i] ? doubleSep : singleSep, sels[i].anchor, sels[i].head, '+newline');
		}

		// Step 2: indent inserted lines
		sels = editor.listSelections();
		for (let i = 0; i < sels.length; i++) {
			editor.indentLine(sels[i].from().line, null, true);

			if (between[i]) {
				editor.indentLine(sels[i].from().line - 1, null, true);
			}
		}

		// Step 3: adjust caret positions
		editor.setSelections(editor.listSelections().map((sel, i) => {
			if (between[i]) {
				const line = sel.from().line - 1;
				const cursor = {
					line,
					ch: editor.getLine(line).length
				};
				return { anchor: cursor, head: cursor };
			}

			return sel;
		}));
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

