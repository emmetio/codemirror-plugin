'use strict';

import resolveConfig from '@emmetio/config';
import extract from '@emmetio/extract-abbreviation';
import { expand, parse } from '@emmetio/expand-abbreviation';
import detectSyntax from './detect-syntax';
import { normalizeText } from './utils';

const cursorMark = '[[::emmet-cursor::]]';

// NB CodeMirror doesn’t natively supports tabstops
const editorField = (index, placeholder = '') => placeholder;

/**
 * Expands given abbreviation for given editor.
 * The editor is used to detect abbreviation syntax and provide
 * tag context for markup abbreviations
 * @param  {String|Node} abbr
 * @param  {CodeMirror.Editor} editor
 * @param  {CodeMirror.Editor} editor
 * @return {String}
 * @throws Error if abbreviation is invalid
 */
export default function expandAbbreviation(abbr, editor, options) {
	return expand(abbr, Object.assign(getExpandOptions(editor), options));
}

/**
 * Parses abbreviation for given editor
 * @param  {String} abbr
 * @param  {CodeMirror.Editor} editor
 * @return {Node}
 * @throws Error if abbreviation is invalid
 */
export function parseAbbreviation(abbr, editor) {
	return parse(abbr, Object.assign({
		syntax: detectSyntax(editor),
	}, getExpandOptions(editor)));
}

/**
 * Extracts abbreviation from given position of editor
 * @param  {CodeMirror.Editor} editor
 * @param  {CodeMirror.Position} [pos]
 * @return {Object} Object with `{abbreviation, location}` properties or `null`
 */
export function extractAbbreviation(editor, pos) {
	pos = pos || pos.getCursor();
	const line = editor.getLine(pos.line);

	return extract(line, pos.ch, true);
}

/**
 * Returns abbreviation model: object with `ast` and `snippet` properties
 * that contains parsed and expanded abbreviation respectively
 * @param  {String} abbreviation
 * @param  {CodeMirror.Editor} editor
 * @param  {EmmetConfig} [config]
 * @return {Object} Returns `null` if abbreviation cannot be parsed
 */
export function createAbbreviationModel(abbreviation, editor, config) {
	try {
		const ast = parseAbbreviation(abbreviation, editor, config);
		return {
			ast,
			abbreviation,
			snippet: expandAbbreviation(abbreviation, editor, config)
		};
	} catch (err) {
		// console.warn('Unable to build Emmet abbreviation model', err);
		return null;
	}
}

/**
 * Expands given abbreviation and inserts expanded result into editor, maintaining
 * proper indentation and final cursor position
 * @param  {CodeMirror.Editor} editor CodeMirror editor instance
 * @param  {String|Object} abbr  Abbreviation to expand (string or parsed)
 * @param  {CodeMirror.Range} range Location of abbreviation in editor
 * @param  {Object} [options] Additional abbreviation expander options
 * @return {Boolean} Returns `true` if abbreviation was successfully expanded and inserted
 */
export function expandAndInsert(editor, abbr, range, options) {
	let cursorMarked = false;
	let newSelectionSize = 0;
	let expanded;

	try {
		expanded = expandAbbreviation(abbr, editor, Object.assign({
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
		}, options));
	} catch (err) {
		// Invalid abbreviation
		// console.warn(err);
		return false;
	}

	const line = editor.getLine(range.from.line);
	const matchIndent = line.match(/^\s+/);
	expanded = normalizeText(editor, expanded, matchIndent && matchIndent[0]);

	let newCursorPos = expanded.length;

	if (cursorMarked) {
		// Remove cursor stub and re-position cursor
		newCursorPos = expanded.indexOf(cursorMark);
		expanded = expanded.slice(0, newCursorPos) + expanded.slice(newCursorPos + cursorMark.length);
	}

	// Replace abbreviation with expanded result
	return editor.operation(() => {
		editor.replaceRange(expanded, range.from, range.to);

		// Position cursor
		const startIx = editor.indexFromPos(range.from);
		const newCursor = editor.posFromIndex(newCursorPos + startIx);
		if (newSelectionSize) {
			editor.setSelection(newCursor, {
				line: newCursor.line,
				ch: newCursor.ch + newSelectionSize
			});
		} else {
			editor.setCursor(newCursor);
		}

		return true;
	});
}

/**
 * Returns options object for syntax from given editor. In most cases, it detects
 * XML-style syntax (HTML, XML, XHTML) and returns options configured for proper
 * output
 * @param  {CodeMirror.Editor} editor
 * @param  {CodeMirror.Position} [pos]  Point in editor where syntax should be detected.
 * Uses `editor.getCursor()` in not given
 * @return {Object}
 */
export function getExpandOptions(editor, pos) {
	/** @type {EmmetConfig} */
	const config = resolveConfig(Object.assign({
		type: 'markup',
		syntax: detectSyntax(editor, pos),
		field: editorField
	}, editor.getOption('emmet')));

	const mode = editor.getModeAt(pos || editor.getCursor());
	if (mode.name === 'xml') {
		config.profile = Object.assign({ selfClosingStyle: mode.configuration }, config.profile);
	}

	return config;
}
