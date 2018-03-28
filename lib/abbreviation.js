'use strict';

import { expand, parse } from '@emmetio/expand-abbreviation';
import extract from './extract-abbreviation';
import insertSnippet from './snippet';
import { removeFields, isCSSPropertyValue } from './utils';

const emmetMarkerClass = 'emmet-abbreviation';

/**
 * Returns parsed abbreviation from given position in `editor`, if possible.
 * @param {CodeMirror.Editor} editor
 * @param {CodeMirror.Position} pos
 * @param {Boolean} [contextAware] Use context-aware abbreviation detection
 * @returns {Abbreviation}
 */
export default function abbreviationFromPosition(editor, pos, contextAware) {
	// Try to find abbreviation marker from given position
	const marker = findMarker(editor, pos);
	if (marker && marker.model) {
		return marker.model;
	}

	// Try to extract abbreviation from given position
	const extracted = extract(editor, pos, contextAware);
	if (extracted) {
		try {
			const abbr = new Abbreviation(extracted.abbreviation, extracted.range, extracted.config);
			return abbr.valid(editor, contextAware) ? abbr : null;
		} catch (err) {
			// skip
			// console.warn(err);
		}
	}
}

/**
 * Returns *valid* Emmet abbreviation marker (if any) for given position of editor
 * @param  {CodeMirror.Editor} editor
 * @param  {CodeMirror.Position} [pos]
 * @return {CodeMirror.TextMarker}
 */
export function findMarker(editor, pos) {
	const markers = editor.findMarksAt(pos);
	for (let i = 0, marker; i < markers.length; i++) {
		marker = markers[i];
		if (marker.className === emmetMarkerClass) {
			if (isValidMarker(editor, marker)) {
				return marker;
			}

			marker.clear();
		}
	}
}

/**
 * Removes Emmet abbreviation markers from given editor
 * @param {CodeMirror.Editor} editor
 */
export function clearMarkers(editor) {
	const markers = editor.getAllMarks();
	for (let i = 0; i < markers.length; i++) {
		if (markers[i].className === emmetMarkerClass) {
			markers[i].clear();
		}
	}
}

/**
 * Marks Emmet abbreviation for given editor position, if possible
 * @param  {CodeMirror.Editor} editor Editor where abbreviation marker should be created
 * @param  {Abbreviation} model Parsed abbreviation model
 * @return {CodeMirror.TextMarker} Returns `undefined` if no valid abbreviation under caret
 */
export function createMarker(editor, model) {
	const { from, to } = model.range;
	const marker = editor.markText(from, to, {
		inclusiveLeft: true,
		inclusiveRight: true,
		clearWhenEmpty: true,
		className: emmetMarkerClass
	});
	marker.model = model;
	return marker;
}

/**
 * Ensures that given editor Emmet abbreviation marker contains valid Emmet abbreviation
 * and updates abbreviation model if required
 * @param {CodeMirror} editor
 * @param {CodeMirror.TextMarket} marker
 * @return {Boolean} `true` if marker contains valid abbreviation
 */
function isValidMarker(editor, marker) {
	const range = marker.find();

	// No newlines inside abbreviation
	if (range.from.line !== range.to.line) {
		return false;
	}

	// Make sure marker contains valid abbreviation
	let text = editor.getRange(range.from, range.to);
	if (!text || /^\s|\s$/g.test(text)) {
		return false;
	}

	if (marker.model && marker.model.config.syntax === 'jsx' && text[0] === '<') {
		text = text.slice(1);
	}

	if (!marker.model || marker.model.abbreviation !== text) {
		// marker contents was updated, re-parse abbreviation
		try {
			marker.model = new Abbreviation(text, range, marker.model.config);
			if (!marker.model.valid(editor, true)) {
				marker.model = null;
			}
		} catch (err) {
			console.warn(err);
			marker.model = null;
		}
	}

	return Boolean(marker.model && marker.model.snippet);
}

export class Abbreviation {
	/**
	 * @param {String} abbreviation Abbreviation string
	 * @param {CodeMirror.Range} range Abbreviation location in editor
	 * @param {Object} [config]
	 */
	constructor(abbreviation, range, config) {
		this.abbreviation = abbreviation;
		this.range = range;
		this.config = config;
		this.ast = parse(abbreviation, config);
		this.snippet = expand(this.ast, config);
		this.preview = removeFields(this.snippet);
	}

	/**
	 * Inserts current expanded abbreviation into given `editor` by replacing
	 * `range`
	 * @param {CodeMirror.Editor} editor
	 * @param {CodeMirror.Range} [range]
	 */
	insert(editor, range) {
		return insertSnippet(editor, range || this.range, this.snippet);
	}

	/**
	 * Check if parsed abbreviation is valid
	 * @param {Boolean} [contextAware] Perform context-aware validation: ensure 
	 * that expanded result is expected at abbreviation location
	 */
	valid(editor, contextAware) {
		if (this.preview && this.abbreviation !== this.preview) {
			return contextAware && this.config.type === 'stylesheet'
				? this._isValidForStylesheet(editor)
				: true;
		}

		return false;
	}

	_isValidForStylesheet(editor) {
		const pos = this.range.from;
		const token = editor.getTokenAt(pos);

		if (/^[#!]/.test(this.abbreviation)) {
			// Abbreviation is a property value
			return isCSSPropertyValue(editor, pos);
		}

		// All expanded nodes are properties? Properties has names, regular snippets don’t.
		const isProperty = this.ast.children.every(node => node.name);
		const state = token.state && token.state.localState || token.state;

		if (isProperty) {
			// Expanded abbreviation consists of properties: make sure we’re inside 
			// block context
			return state && state.context && state.context.type === 'block';
		}

		// Expanded abbreviations are basic snippets: allow them everywhere, but forbid
		// if expanded result equals abbreviation (meaningless).
		return true;
	}
}
