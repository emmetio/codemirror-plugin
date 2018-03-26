'use strict';

import { createSnippetsRegistry, expand } from '@emmetio/expand-abbreviation';
import { convertToCSSSnippets } from '@emmetio/css-snippets-resolver';
import createConfig from './config';
import getAbbreviation, { clearMarkers } from './abbreviation';
import { removeFields, isCSSPropertyValue, getCSSPropertyName } from './utils';
import insertSnippet from './snippet';

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

	const abbreviation = getAbbreviation(editor, pos, true);
	if (abbreviation) {
		completions.push(expandedAbbreviationCompletion(editor, pos, abbreviation));
	}

	const config = abbreviation ? abbreviation.config : createConfig(editor, pos);

	if (config.type === 'stylesheet') {
		completions = completions.concat(getStylesheetCompletions(editor, pos, config));
	} else {
		completions = completions.concat(getMarkupCompletions(editor, pos, config));
	}

	return {
		type: config.type,
		syntax: config.syntax,
		abbreviation,
		completions: completions.filter(Boolean)
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
			.filter(completion => completion.key !== prefix && completion.key.indexOf(prefix) === 0)
			.map(completion => new EmmetCompletion('snippet', editor, prefixRange, completion.key, completion.preview, completion.snippet));
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

	if (prefix) {
		// Make sure that current position precedes element name (e.g. not attribute,
		// class, id etc.)
		const prefixRange = {
			from: { line: pos.line, ch: pos.ch - prefix.length },
			to: pos
		};

		if (isCSSPropertyValue(editor, pos)) {
			const prop = getCSSPropertyName(editor, pos);
			if (prop) {
				const lowerProp = prop.toLowerCase();
				// Find matching CSS property snippet for keyword completions
				const completion = getSnippetCompletions(editor, pos, config)
					.find(item => item.property && item.property === lowerProp);
	
				if (completion && completion.keywords.length) {
					return completion.keywords.map(kw => {
						return kw.key.indexOf(prefix) === 0 && new EmmetCompletion('value', editor, prefixRange, kw.key, kw.preview, kw.snippet);
					}).filter(Boolean);
				}
			}
		} else {
			return getSnippetCompletions(editor, pos, config)
				.filter(completion => completion.key !== prefix && completion.key.indexOf(prefix) === 0)
				.map(completion => new EmmetCompletion('snippet', editor, prefixRange, completion.key, completion.preview, completion.snippet));
		}
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

		cache[syntax] = type === 'stylesheet'
			? getStylesheetSnippets(registry, config)
			: getMarkupSnippets(registry, config);
	}

	return cache[syntax];
}

/**
 * Returns stylesheet snippets list
 * @param {SnippetsRegistry} registry 
 * @return {Array}
 */
function getStylesheetSnippets(registry) {
	return convertToCSSSnippets(registry).map(snippet => {
		let preview = snippet.property;
		const keywords = snippet.keywords();
		if (keywords.length) {
			preview += `: ${removeFields(keywords.join(' | '))}`;
		} else if (snippet.value) {
			preview += `: ${removeFields(snippet.value)}`;
		}

		return {
			key: snippet.key,
			value: snippet.value,
			snippet: snippet.key,
			property: snippet.property,
			keywords: keywords.map(kw => {
				const m = kw.match(/^[\w-]+/);
				return m && {
					key: m[0],
					preview: removeFields(kw),
					snippet: kw
				};
			}).filter(Boolean),
			preview
		};
	});
}

/**
 * Returns markup snippets list
 * @param {SnippetsRegistry} registry 
 * @param {Object} config 
 * @return {Array}
 */
function getMarkupSnippets(registry, config) {
	return registry.all({ type: 'string' }).map(snippet => ({
		key: snippet.key,
		value: snippet.value,
		preview: removeFields(expand(snippet.value, config)),
		snippet: snippet.key
	}));
}

function expandedAbbreviationCompletion(editor, pos, abbrModel) {
	// For CSS properties, we should provide only value-based expanded abbreviation,
	// (actually, only one so far: CSS color like `#f`, `#a.3` etc)
	if (!isCSSPropertyValue(editor, pos) || abbrModel.abbreviation[0] === '#') {
		return new EmmetCompletion('expanded-abbreviation', editor, abbrModel.range,
			'Expand abbreviation', abbrModel.preview, (editor, range) => abbrModel.insert(editor, range));
	}
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
	 * @param {String} name
	 * @param {String} preview
	 * @param {Function} snippet
	 */
	constructor(type, editor, range, name, preview, snippet) {
		this.type = type;
		this.editor = editor;
		this.range = range;
		this.name = name;
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
				insertSnippet(this.editor, this.range, this.snippet);
			}
			clearMarkers(this.editor);
		}
	}
}
