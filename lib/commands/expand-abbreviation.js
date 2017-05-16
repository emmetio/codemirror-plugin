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
	let newSelectionSize = 0;
	const expandOpt = Object.assign({
		// CodeMirror doesn’t support snippets with tab-stops natively so we have
		// to mark first output with a special token so we can find it later
		// to properly plant cursor into new position
		field(index, placeholder = '') {
			if (!cursorMarked) {
				cursorMarked = true;
				newSelectionSize = placeholder.length;
				placeholder = cursorMark + placeholder;
			}

			return placeholder;
		}
	}, getExpandOptions(editor, cursor));

	const matchIndent = line.match(/^\s+/);
	let expanded;
	try {
		expanded = normalizeText(editor, expand(extracted.abbreviation, expandOpt), matchIndent && matchIndent[0]);
	} catch (err) {
		// Invalid abbreviation, abort key handling
		console.warn(err);
		return editor.constructor.Pass;
	}

	if (extracted.abbreviation === expanded) {
		// Edge case: expanded result is the same as abbreviation.
		// May happen in CSS and indent-based syntaxes like Slim, Pug
		return editor.constructor.Pass;
	}

	let newCursorPos = expanded.length;

	if (cursorMarked) {
		// Remove cursor stub and re-position cursor
		newCursorPos = expanded.indexOf(cursorMark);
		expanded = expanded.slice(0, newCursorPos) + expanded.slice(newCursorPos + cursorMark.length);
	}

	// Replace abbreviation with expanded result
	const rangeStart = {
		line: cursor.line,
		ch: extracted.location
	};
	const rangeEnd = {
		line: cursor.line,
		ch: extracted.location + extracted.abbreviation.length
	};
	editor.replaceRange(expanded, rangeStart, rangeEnd);

	// Position cursor
	const startIx = editor.indexFromPos(rangeStart);
	const newCursor = editor.posFromIndex(newCursorPos + startIx);
	if (newSelectionSize) {
		editor.setSelection(newCursor, {
			line: newCursor.line,
			ch: newCursor.ch + newSelectionSize
		});
	} else {
		editor.setCursor(newCursor);
	}
}

/**
 * Returns options object for syntax from given editor. In most cases, it detects
 * XML-style syntax (HTML, XML, XHTML) and returns options configured for proper
 * output
 * @param  {CodeMirror} editor
 * @param  {Point}      [pos]  Point in editor where syntax should be detected.
 *                             Uses `editor.getCursor()` in not given
 * @return {Object}
 */
function getExpandOptions(editor, pos) {
	const mode = editor.getModeAt(pos || editor.getCursor());
	const emmetOpt = editor.getOption('emmet') || {};
	let syntax = emmetOpt.syntax || mode.name;
	let profile = emmetOpt.profile;

	if (syntax === 'xml') {
		syntax = 'html';
		profile = Object.assign({ selfClosingStyle: mode.configuration }, profile);
	}

	return Object.assign({ syntax, profile }, emmetOpt);
}
