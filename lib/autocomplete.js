'use strict';

import { createSnippetsRegistry, expand } from '@emmetio/expand-abbreviation';
import { convertToCSSSnippets } from '@emmetio/css-snippets-resolver';
import getAbbreviation, { clearMarkers, getExpandOptions } from './abbreviation';
import { removeFields } from './utils';

/**
 * Returns available completions from given editor
 * @param  {CodeMirror.Editor} editor
 * @param  {Abbreviation} abbrModel Parsed Emmet abbreviation model for which
 * completions should be populated
 * @param  {CodeMirror.Position} abbrPos Abbreviation location in editor
 * @param  {CodeMirror.Position} [pos] Cursor position in editor
 * @return {EmmetCompletion[]}
 */
export default function(editor, pos) {
	pos = pos || editor.getCursor();
	let completions = [];

	// Provide two types of completions:
	// 1. Expanded abbreviation
	// 2. Snippets

	const abbreviation = getAbbreviation(editor, pos);
	// NB: Check for edge case: expanded abbreviation equals to original
	// abbreviation (for example, `li.item` expands to `li.item` in Slim),
	// no need to provide completion for this case
	if (abbreviation && abbreviation.abbreviation !== abbreviation.snippet) {
		completions.push(expandedAbbreviationCompletion(editor, abbreviation));
	}

	const config = abbreviation ? abbreviation.config : getExpandOptions(editor, pos);

	if (config.type === 'stylesheet') {
		completions = completions.concat(getStylesheetCompletions(editor, pos, config));
	} else {
		completions = completions.concat(getMarkupCompletions(editor, pos, config));
	}

	return {
		type: config.type,
		syntax: config.syntax,
		abbreviation,
		completions
	};
}

/**
 * Returns completions for markup syntaxes (HTML, Slim, Pug etc.)
 * @param  {CodeMirror} editor
 * @param  {CodeMirror.Position} pos Cursor position in editor
 * @param  {Object} config Resolved Emmet config
 * @return {EmmetCompletion[]}
 */
function getMarkupCompletions(editor, pos, config) {
	const line = editor.getLine(pos.line).slice(0, pos.ch);
	const prefix = extractPrefix(line, /[\w:\-$@]/);

	// Make sure that current position precedes element name (e.g. not attribute,
	// class, id etc.)
	if (prefix) {
		const prefixRange = {
			from: { line: pos.line, ch: pos.ch - prefix.length },
			to: pos
		};

		return getSnippetCompletions(editor, pos, config)
			.filter(snippet => snippet.key !== prefix && snippet.key.indexOf(prefix) === 0)
			.map(snippet => new EmmetCompletion('snippet', editor, prefixRange, snippet.key, snippet.preview, snippet.key));

	}

	return [];
}

/**
 * Returns completions for stylesheet syntaxes
 * @param  {CodeMirror} editor
 * @param  {CodeMirror.Position} pos Cursor position in editor
 * @param  {Object} config Resolved Emmet config
 * @return {EmmetCompletion[]}
 */
function getStylesheetCompletions(editor, pos, config) {
	const line = editor.getLine(pos.line).slice(0, pos.ch);
	const prefix = extractPrefix(line, /[\w-@$]/);

	// Make sure that current position precedes element name (e.g. not attribute,
	// class, id etc.)
	if (prefix) {
		const prefixRange = {
			from: { line: pos.line, ch: pos.ch - prefix.length },
			to: pos
		};

		return getSnippetCompletions(editor, pos, config)
			.filter(snippet => snippet.key !== prefix && snippet.key.indexOf(prefix) === 0)
			.map(snippet => new EmmetCompletion('snippet', editor, prefixRange, snippet.key, snippet.preview, snippet.key));
	}

	return [];
}

/**
 * Returns all possible snippets completions for given editor context.
 * Completions are cached in editor for for re-use
 * @param  {CodeMirror.Editor} editor
 * @param  {CodeMirror.Position} pos
 * @param  {Object} config
 * @return {Array}
 */
function getSnippetCompletions(editor, pos, config) {
	const { type, syntax } = config;

	if (!editor.state.emmetCompletions) {
		editor.state.emmetCompletions = {};
	}

	const cache = editor.state.emmetCompletions;

	if (!(syntax in cache)) {
		const registry = createSnippetsRegistry(type, syntax, config.snippets);

		if (type === 'stylesheet') {
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
		'Expand abbreviation', abbrModel.snippet, () => {
			abbrModel.insert(editor);
			clearMarkers(editor);
		});
}

/**
 * Extracts prefix from the end of given string that matches `match` regexp
 * @param {String} str 
 * @param {RegExp} match 
 * @return {String} Extracted prefix
 */
function extractPrefix(str, match) {
	let offset = str.length;

	while (offset > 0) {
		if (!match.test(str[offset - 1])) {
			break;
		}
		offset--;
	}

	return str.slice(offset);
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
