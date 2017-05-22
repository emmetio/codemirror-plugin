'use babel';

import extract from '@emmetio/extract-abbreviation';
import { expand, parse } from '@emmetio/expand-abbreviation';
import detectSyntax from './detect-syntax';

// NB CodeMirror doesn’t natively supports tabstops
const editorField = (index, placeholder = '') => placeholder;

/**
 * Expands given abbreviation for given editor.
 * The editor is used to detect abbreviation syntax and provide
 * tag context for markup abbreviations
 * @param  {String|Node} abbr
 * @param  {CodeMirror}  editor
 * @return {String}
 * @throws Error if abbreviation is invalid
 */
export default function expandAbbreviation(abbr, editor, options) {
	return expand(abbr, Object.assign({
		syntax: detectSyntax(editor),
		field: editorField
	}, options, getExpandOptions(editor)));
}

/**
 * Parses abbreviation for given editor
 * @param  {String} abbr
 * @param  {CodeMirror} editor
 * @return {Node}
 * @throws Error if abbreviation is invalid
 */
export function parseAbbreviation(abbr, editor) {
	return parse(abbr, { syntax: detectSyntax(editor) });
}

/**
 * Extracts abbreviation from given position of editor
 * @param  {CodeMirror}     editor
 * @param  {CodeMirror.Pos} [pos]
 * @return {Object}         Object with `{abbreviation, location}` properties or `null`
 */
export function extractAbbreviation(editor, pos) {
	pos = pos || pos.getCursor();
	const line = editor.getLine(pos.line);

	return extract(line, pos.ch, true);
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
	const emmetOpt = editor.getOption('emmet');
	let profile = emmetOpt && emmetOpt.profile;

	if (mode.name === 'xml') {
		profile = Object.assign({ selfClosingStyle: mode.configuration }, profile);
	}

	return Object.assign({ profile }, emmetOpt);
}
