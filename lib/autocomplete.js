'use strict';

import { createSnippetsRegistry, isStylesheet } from '@emmetio/expand-abbreviation';
import { findMarker, markAbbreviation } from './abbreviation-marker';
import detectSyntax from './detect-syntax';
import expandAbbreviation, { expandAndInsert } from './expand-abbreviation';

/**
 * Returns available completions from given editor
 * @param  {CodeMirror}     editor   CodeMirror editor instance
 * @param  {CodeMirror.Pos} [pos]    Position in editor for which completions should
 *                                   be calculated. Uses last cursor if not given
 * @param  {Boolean}        [forced] Force completions for given position. By default,
 *                                   completions are populated from automatically
 *                                   marked Emmet abbreviation from editor
 * @return {EmmetCompletion[]}
 */
export default function(editor, pos, forced) {
	pos = pos || editor.getCursor();
	const syntax = detectSyntax(editor, pos);
	if (!syntax) {
		// Unsupported syntax
		return [];
	}

	return isStylesheet(syntax)
		? getStylesheetCompletions(editor, pos, forced)
		: getMarkupCompletions(editor, pos, forced);
}

/**
 * Returns completions for markup syntaxes (HTML, Slim, Pug etc.)
 * @param  {CodeMirror} editor
 * @param  {CodeMirror.Pos} [pos]
 * @return {EmmetCompletion[]}
 */
function getMarkupCompletions(editor, pos, forced) {
	let result = [];
	const marker = getAbbreviationMarker(editor, pos, forced);

	if (!marker) {
		// No valid abbreviation for given position
		return result;
	}

	// Add expanded abbreviation as completion option
	const range = marker.find();
	result.push(new EmmetCompletion('expanded-abbreviation', editor, range, 'Expand abbreviation',
		marker.model.snippet, () => expandAndInsert(editor, marker.model.abbreviation, range.from)));

	// Make sure that current position precedes element name (e.g. not attribute,
	// class, id etc.)
	const prefix = getPrefix(editor, pos);
	if (isInElementNameContext(editor, pos, prefix)) {
		const emmetOpt = editor.getOption('emmet') || {};
		const syntax = detectSyntax(editor, pos);
		const registry = createSnippetsRegistry(syntax, emmetOpt.snippets);
		const field = (index, placeholder) => placeholder || '';
		const prefixRange = {
			from: { line: pos.line, ch: pos.ch - prefix.length },
			to: pos
		};

		const completions = registry.all({type: 'string'})
		.filter(snippet => snippet.key !== prefix && snippet.key.indexOf(prefix) === 0)
		.map(snippet => new EmmetCompletion('snippet', editor, prefixRange, snippet.key,
			expandAbbreviation(snippet.value, editor, { syntax, field }), snippet.key));

		result = result.concat(completions);
	}

	return result;
}

function getStylesheetCompletions(editor, pos) {
	return [];
}

function getAbbreviationMarker(editor, pos, forced) {
	return findMarker(editor, pos) || (forced && markAbbreviation(editor, pos, true));
}

/**
 * Check if given abbreviation in editor at given position precedes Emmet
 * abbreviation name
 * @param  {CodeMirror} editor
 * @param  {CodeMirror.Pos} pos
 * @param  {String} prefix
 * @return {Boolean}
 */
function isInElementNameContext(editor, pos, prefix) {
	const marker = findMarker(editor, pos);
	if (!marker) {
		return false;
	}

	const markerRange = marker.find();
	const abbr = marker.model.abbreviation;
	let offset = pos.ch - markerRange.from.ch - prefix.length;

	if (offset === 0) {
		// Word prefix is at the beginning of abbreviation: it’s an element
		// context for sure
		return true;
	} else if (offset > 0) {
		// Check if prefix is at the element bound, e.g. right after operator
		return /[>\^\+\(\)]/.test(abbr[offset - 1]);
	}

	return false;
}

/**
 * Returns work prefix for completion at given position in editor
 * @param  {CodeMirror} editor
 * @param  {CodeMirror.Pos} pos
 * @return {String}
 */
function getPrefix(editor, pos) {
	const line = editor.getLine(pos.line).slice(0, pos.ch);
	const m = line.match(/[\w:\-\$@]+$/);
	return m && m[0] || '';
}

class EmmetCompletion {
	constructor(type, editor, range, label, preview, snippet) {
		this.type = type;
		this.editor = editor;
		this.range = range;
		this.label = label;
		this.preview = preview;
		this.snippet = snippet;

		this._inserted = false;
	}

	insert() {
		if (!this._inserted) {
			this._inserted = true;
			if (typeof this.snippet === 'function') {
				this.snippet(this.editor, this.range);
			} else {
				this.editor.replaceRange(this.snippet, this.range.from, this.range.to);

				// Position cursor
				const startIx = this.editor.indexFromPos(this.range.from);
				const newCursor = this.editor.posFromIndex(startIx + this.snippet.length);
				this.editor.setCursor(newCursor);
			}
		}
	}
}
