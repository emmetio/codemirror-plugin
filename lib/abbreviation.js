'use strict';

import resolveConfig from '@emmetio/config';
import extract from '@emmetio/extract-abbreviation';
import { expand, parse } from '@emmetio/expand-abbreviation';
import detectSyntax from './detect-syntax';
import { normalizeText } from './utils';

const cursorMark = '[[::emmet-cursor::]]';
const emmetMarkerClass = 'emmet-abbreviation';

// NB CodeMirror doesn’t natively supports tabstops
const editorField = (index, placeholder = '') => placeholder;

/**
 * Returns parsed abbreviation from given position in `editor`, if possible.
 * @param {CodeMirror.Editor} editor
 * @param {CodeMirror.Position} pos
 * @returns {Abbreviation}
 */
export default function abbreviationFromPosition(editor, pos) {
	// Try to find abbreviation marker from given position
	const marker = findMarker(editor, pos);
	if (marker && marker.model) {
		return marker.model;
	}

	// Try to extract abbreviation from given position
	const config = getExpandOptions(editor, pos);
	const extracted = extract(editor.getLine(pos.line), pos.ch, {
		lookAhead: true,
		syntax: config.type
	});

	if (extracted) {
		const abbrLocation = {
			line: pos.line,
			ch: extracted.location
		};
		try {
			return new Abbreviation(extracted.abbreviation, abbrLocation, config);
		} catch (err) {
			// skip
		}
	}
}

/**
 * Returns options object for syntax from given editor. In most cases, it detects
 * XML-style syntax (HTML, XML, XHTML) and returns options configured for proper
 * output
 * @param  {CodeMirror.Editor} editor
 * @param  {CodeMirror.Position} [pos]  Point in editor where syntax should be detected.
 * Uses `editor.getCursor()` in not given
 * @param  {Object} [options]
 * @return {Object}
 */
export function getExpandOptions(editor, pos, options) {
	pos = pos || editor.getCursor();

	/** @type {EmmetConfig} */
	const config = resolveConfig(Object.assign({
		field: editorField
	}, editor.getOption('emmet'), options), {
		syntax: detectSyntax(editor, pos)
	});

	const mode = editor.getModeAt(pos);
	if (mode.name === 'xml') {
		config.profile = Object.assign({ selfClosingStyle: mode.configuration }, config.profile);
	}

	return config;
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
	const text = editor.getRange(range.from, range.to);
	if (!text || /^\s|\s$/g.test(text)) {
		return false;
	}

	if (!marker.model || marker.model.abbreviation !== text) {
		// marker contents was updated, re-parse abbreviation
		try {
			marker.model = new Abbreviation(text, marker.model.pos, marker.model.config);
		} catch (err) {
			marker.model = null;
		}
	}

	return Boolean(marker.model && marker.model.snippet);
}

export class Abbreviation {
	/**
	 * @param {String} abbreviation Abbreviation string
	 * @param {CodeMirror.Position} [pos] Abbreviation location in editor
	 * @param {Object} [config]
	 */
	constructor(abbreviation, pos, config) {
		this.abbreviation = abbreviation;
		this.pos = pos || { line: 0, ch: 0 };
		this.range = {
			from: this.pos,
			to: {
				line: this.pos.line,
				ch: this.pos.ch + this.abbreviation.length
			}
		};
		this.config = config;
		this.ast = parse(abbreviation, config);

		let cursorMarked = false;

		this._selectionSize = 0;
		this._expanded = expand(this.ast, Object.assign({}, config, {
			// CodeMirror doesn’t support snippets with tab-stops natively so we have
			// to mark first output with a special token so we can find it later
			// to properly plant cursor into new position
			field: (index, placeholder = '') => {
				if (!cursorMarked) {
					cursorMarked = true;
					this._selectionSize = placeholder.length;
					placeholder = cursorMark + placeholder;
				}

				return placeholder;
			}
		}));

		this.snippet = this._expanded.replace(cursorMark, '');
	}

	/**
	 * Inserts current expanded abbreviation into given `editor` by replacing
	 * `range`
	 * @param {CodeMirror.Editor} editor
	 * @param {CodeMirror.Range} [range]
	 */
	insert(editor, range) {
		range = range || this.range;
		const line = editor.getLine(range.from.line);
		const matchIndent = line.match(/^\s+/);
		let snippet = normalizeText(editor, this._expanded, matchIndent && matchIndent[0]);
		let newCursorPos = snippet.indexOf(cursorMark);

		if (newCursorPos !== -1) {
			// Remove cursor stub and re-position cursor
			snippet = snippet.slice(0, newCursorPos) + snippet.slice(newCursorPos + cursorMark.length);
		} else {
			newCursorPos = snippet.length;
		}

		return editor.operation(() => {
			editor.replaceRange(snippet, range.from, range.to);

			// Position cursor
			const startIx = editor.indexFromPos(range.from);
			const newCursor = editor.posFromIndex(newCursorPos + startIx);
			if (this._selectionSize) {
				editor.setSelection(newCursor, {
					line: newCursor.line,
					ch: newCursor.ch + this._selectionSize
				});
			} else {
				editor.setCursor(newCursor);
			}

			return true;
		});
	}
}
