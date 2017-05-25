'use strict';

import { createSnippetsRegistry, isStylesheet } from '@emmetio/expand-abbreviation';
import detectSyntax from './detect-syntax';
import expandAbbreviation, { expandAndInsert } from './expand-abbreviation';

/**
 * Returns available completions from given editor
 * @param  {CodeMirror}      editor
 * @param  {String}          abbrModel   Parsed Emmet abbreviation model for which
 *                                       completions should be populated
 *                                       (see `createAbbreviationModel()`)
 * @param  {CodeMirror.Pos}  abbrPos     Abbreviation location in editor
 * @param  {CodeMirror.Pos}  [cursorPos] Cursor position in editor
 * @return {EmmetCompletion[]}
 */
export default function(editor, abbrModel, abbrPos, cursorPos) {
	cursorPos = cursorPos || editor.getCursor();
	const syntax = detectSyntax(editor, cursorPos);
	if (!syntax) {
		// Unsupported syntax
		return [];
	}

	return isStylesheet(syntax)
		? getStylesheetCompletions(editor, abbrModel, abbrPos, cursorPos)
		: getMarkupCompletions(editor, abbrModel, abbrPos, cursorPos);
}

/**
 * Returns completions for markup syntaxes (HTML, Slim, Pug etc.)
 * @param  {CodeMirror}      editor
 * @param  {String}          abbrModel   Parsed Emmet abbreviation model for which
 *                                       completions should be populated
 *                                       (see `createAbbreviationModel()`)
 * @param  {CodeMirror.Pos}  abbrPos     Abbreviation location in editor
 * @param  {CodeMirror.Pos}  [cursorPos] Cursor position in editor
 * @return {EmmetCompletion[]}
 */
export function getMarkupCompletions(editor, abbrModel, abbrPos, cursorPos) {
	let result = [];
	cursorPos = cursorPos || editor.getCursor()

	const abbrRange = {
		from: abbrPos,
		to: { line: abbrPos.line, ch: abbrPos.ch + abbr.length }
	};

	result.push(new EmmetCompletion('expanded-abbreviation', editor, abbrRange, 'Expand abbreviation',
		abbrModel.snippet, () => expandAndInsert(editor, abbrModel.abbreviation, abbrPos)));

	// Make sure that current position precedes element name (e.g. not attribute,
	// class, id etc.)
	const prefix = getElementPrefix(abbrModel.abbreviation, abbrPos.ch - cursorPos.ch);
	if (prefix !== null) {
		const emmetOpt = editor.getOption('emmet') || {};
		const syntax = detectSyntax(editor, cursorPos);
		const registry = createSnippetsRegistry(syntax, emmetOpt.snippets);
		const field = (index, placeholder) => placeholder || '';
		const prefixRange = {
			from: { line: cursorPos.line, ch: cursorPos.ch - prefix.length },
			to: cursorPos
		};
		const expandOpt = { syntax, field };

		const completions = registry.all({type: 'string'})
		.filter(snippet => snippet.key !== prefix && snippet.key.indexOf(prefix) === 0)
		.map(snippet => new EmmetCompletion('snippet', editor, prefixRange, snippet.key,
			expandAbbreviation(snippet.value, editor, expandOpt), snippet.key));

		result = result.concat(completions);
	}

	return result;
}

function getStylesheetCompletions(editor, abbrModel, abbrPos, cursorPos) {
	return [];
}

/**
 * Returns node element prefix, if applicable, for given `pos` in abbreviation
 * @param  {String} abbr
 * @param  {Number} pos
 * @return {String} Returns `null` if not in element name context
 */
function getElementPrefix(abbr, pos) {
	if (pos === 0) {
		// Word prefix is at the beginning of abbreviation: it’s an element
		// context for sure
		return '';
	}

	const m = abbr.slice(0, pos).match(/[\w:\-\$@]+$/);
	const prefix = m && m[0] || '';

	if (prefix && /[>\^\+\(\)]/.test(abbr[pos - prefix.length - 1])) {
		// Check if prefix is at the element bound, e.g. right after operator
		return prefix;
	}

	return null;
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
