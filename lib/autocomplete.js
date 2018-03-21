'use strict';

import { createSnippetsRegistry, isStylesheet, expand } from '@emmetio/expand-abbreviation';
import { convertToCSSSnippets } from '@emmetio/css-snippets-resolver';
import detectSyntax from './detect-syntax';
import getAbbreviation from './abbreviation';
import { removeFields } from './utils';

/**
 * Returns available completions from given editor
 * @param  {CodeMirror.Editor} editor
 * @param  {Abbreviation} abbrModel Parsed Emmet abbreviation model for which 
 * completions should be populated
 * @param  {CodeMirror.Position} abbrPos Abbreviation location in editor
 * @param  {CodeMirror.Position} [cursorPos] Cursor position in editor
 * @return {EmmetCompletion[]}
 */
export default function(editor, cursorPos) {
	cursorPos = cursorPos || editor.getCursor();
	const abbreviation = getAbbreviation(editor, cursorPos);
	const syntax = detectSyntax(editor, cursorPos);

	if (abbreviation && syntax) {
		const completions = isStylesheet(syntax)
			? getStylesheetCompletions(editor, abbreviation, cursorPos)
			: getMarkupCompletions(editor, abbreviation, cursorPos);
	
		return { abbreviation, completions };
	}
}

/**
 * Returns completions for markup syntaxes (HTML, Slim, Pug etc.)
 * @param  {CodeMirror} editor
 * @param  {Abbreviation} abbrModel Parsed Emmet abbreviation model for which
 * completions should be populated
 * @param  {CodeMirror.Position} [cursorPos] Cursor position in editor
 * @return {EmmetCompletion[]}
 */
export function getMarkupCompletions(editor, abbrModel, cursorPos) {
	let result = [];
	cursorPos = cursorPos || editor.getCursor();

	result.push(expandedAbbreviationCompletion(editor, abbrModel));

	// Make sure that current position precedes element name (e.g. not attribute,
	// class, id etc.)
	const prefix = getMarkupPrefix(abbrModel.abbreviation, cursorPos.ch - abbrModel.pos.ch);
	if (prefix !== null) {
		const prefixRange = {
			from: { line: cursorPos.line, ch: cursorPos.ch - prefix.length },
			to: cursorPos
		};

		const completions = getSnippetCompletions(editor, cursorPos)
			.filter(snippet => snippet.key !== prefix && snippet.key.indexOf(prefix) === 0)
			.map(snippet => new EmmetCompletion('snippet', editor, prefixRange, snippet.key, snippet.preview, snippet.key));

		result = result.concat(completions);
	}

	return result;
}

/**
 * Returns completions for stylesheet syntaxes
 * @param  {CodeMirror.Editor} editor
 * @param  {Object} abbrModel
 * @param  {CodeMirror.Position} abbrPos
 * @param  {CodeMirror.Position} cursorPos
 * @return {EmmetCompletion[]}
 */
function getStylesheetCompletions(editor, abbrModel, cursorPos) {
	let result = [];
	cursorPos = cursorPos || editor.getCursor();

	result.push(expandedAbbreviationCompletion(editor, abbrModel));

	// Make sure that current position precedes element name (e.g. not attribute,
	// class, id etc.)
	const prefix = getStylesheetPrefix(abbrModel.abbreviation, cursorPos.ch - abbrModel.pos.ch);
	if (prefix !== null) {
		const prefixRange = {
			from: { line: cursorPos.line, ch: cursorPos.ch - prefix.length },
			to: cursorPos
		};

		const completions = getSnippetCompletions(editor, cursorPos)
			.filter(snippet => snippet.key !== prefix && snippet.key.indexOf(prefix) === 0)
			.map(snippet => new EmmetCompletion('snippet', editor, prefixRange, snippet.key, snippet.preview, snippet.key));

		result = result.concat(completions);
	}

	return result;
}

/**
 * Returns all possible snippets completions for given editor context.
 * Completions are cached in editor for for re-use
 * @param  {CodeMirror.Editor} editor
 * @param  {CodeMirror.Position} pos
 * @param  {Abbreviation} abbrModel
 * @return {Array}
 */
function getSnippetCompletions(editor, pos, abbrModel) {
	const config = abbrModel.config;
	const syntax = config.syntax;

	if (!editor.state.emmetCompletions) {
		editor.state.emmetCompletions = {};
	}

	const cache = editor.state.emmetCompletions;

	if (!(syntax in cache)) {
		const registry = createSnippetsRegistry(syntax, config.snippets);

		if (config.type === 'stylesheet') {
			// Collect snippets for stylesheet context: just a plain list of
			// snippets, converted specifically for CSS context
			cache[syntax] = convertToCSSSnippets(registry).map(snippet => {
				let preview = snippet.property;
				const keywords = snippet.keywords();
				if (keywords.length) {
					preview += `: ${removeFields(keywords.join(' | '))}`;
				}

				return {
					key: snippet.key,
					value: snippet.value,
					keywords,
					preview
				};
			});
		} else {
			// Collect snippets for markup syntaxes: HTML, XML, Slim, Pug etc.
			// Not just a plain snippets list but their expanded result as well
			cache[syntax] = registry.all({ type: 'string' }).map(snippet => ({
				key: snippet.key,
				value: snippet.value,
				preview: expand(snippet.value, config)
			}));
		}
	}

	return cache[syntax];
}

function expandedAbbreviationCompletion(editor, abbrModel) {
	return new EmmetCompletion('expanded-abbreviation', editor, abbrModel.range,
		'Expand abbreviation', abbrModel.snippet, () => abbrModel.insert(editor));
}

/**
 * Returns node element prefix, if applicable, for given `pos` in abbreviation
 * for markup syntaxes completions
 * @param  {String} abbr
 * @param  {Number} pos
 * @return {String} Returns `null` if not in element name context
 */
function getMarkupPrefix(abbr, pos) {
	return getPrefix(abbr, pos, /[\w:\-$@]+$/);
}

/**
 * Returns node element prefix, if applicable, for given `pos` in abbreviation
 * for stylesheet syntaxes completions
 * @param  {String} abbr
 * @param  {Number} pos
 * @return {String} Returns `null` if not in element name context
 */
function getStylesheetPrefix(abbr, pos) {
	return getPrefix(abbr, pos, /[\w-@$]+$/);
}

/**
 * Get snippet completion prefix that matches given `match` regexp from `pos`
 * character position of given `abbr` abbreviation
 * @param  {String} abbr
 * @param  {Number} pos
 * @param  {RegExp} match
 * @return {String}
 */
function getPrefix(abbr, pos, match) {
	if (pos === 0) {
		// Word prefix is at the beginning of abbreviation: it’s an element
		// context for sure
		return '';
	}

	const m = abbr.slice(0, pos).match(match);
	const prefix = m && m[0] || '';

	// Check if matched prefix is either at the beginning of abbreviation or
	// at the element bound, e.g. right after operator
	if (prefix && (prefix === abbr || /[>^+()]/.test(abbr[pos - prefix.length - 1]))) {
		return prefix;
	}

	return null;
}

class EmmetCompletion {
	/**
	 * @param {String} type 
	 * @param {CodeMirror.Editor} editor 
	 * @param {CodeMirror.Range} range 
	 * @param {String} label 
	 * @param {String} preview
	 * @param {Function} snippet
	 */
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
