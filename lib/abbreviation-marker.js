'use strict';

import expandAbbreviation, { extractAbbreviation, parseAbbreviation } from './expand-abbreviation';
import { hasAutoActivateContext } from './detect-syntax';

const emmetMarkerClass = 'emmet-abbreviation';

/**
 * Registers handlers on given editor that will automatically mark Emmet
 * abbrevation in given editor when user types text and ensures that marker
 * covers valid abbreviation
 * @param  {CodeMirror} editor
 * @return {Function}   A function which, when invoked, unregisters all marker
 *                      handlers
 */
export default function(editor) {
	const onChange = () => {
		const marker = findMarker(editor, editor.getCursor());
		if (marker && isValidMarker(editor, marker)) {
			return;
		}

		// No valid marker under caret, remove all registered markers
		// and create a new one
		clearMarkers(editor);
		if (hasAutoActivateContext(editor)) {
			markAbbreviation(editor, editor.getCursor());
		}
	};

	editor.on('change', onChange);

	return () => {
		editor.off('change', onChange);
		clearMarkers(editor);
	};
}

/**
 * Returns *valid* Emmet abbreviation marker (if any) for given position of editor
 * @param  {CodeMirror}     editor
 * @param  {CodeMirror.Pos} [pos]
 * @return {CodeMirror.TextMarker}
 */
export function findMarker(editor, pos) {
	const markers = editor.findMarksAt(pos);
	for (let i = 0; i < markers.length; i++) {
		if (markers[i].className === emmetMarkerClass) {
			return markers[i];
		}
	}
}

/**
 * Marks Emmet abbreviation for given editor position, if possible
 * @param  {TextEditor} editor   Editor where abbreviation marker should be created
 * @param  {Point}      pos      Buffer position where abbreviation should be created.
 *                               Abbreviation will be automatically extracted from
 *                               given position
 * @param  {Boolean}    [forced] Indicates that user forcibly requested abbreviation
 *                               marker (e.g. was not activated automatically).
 *                               Affects abbreviation detection policy
 * @return {DisplayMarker} Returns `undefined` if no valid abbreviation under caret
 */
export function markAbbreviation(editor, pos, forced) {
	const marker = findMarker(editor, pos);
	if (marker) {
		// there’s active marker with valid abbreviation
		return marker;
	}

	// No active marker: remove previous markers and create new one, if possible
	clearMarkers(editor);

	const extracted = extractAbbreviation(editor, pos);
	const model = extracted && createAbbreviationModel(extracted.abbreviation, editor);

	if (model && (forced || allowedForAutoActivation(model))) {
		const from = { line: pos.line, ch: extracted.location };
		const to = { line: pos.line, ch: extracted.location + extracted.abbreviation.length };


		const marker = editor.markText(from, to, {
			inclusiveRight: true,
			clearWhenEmpty: true,
			className: emmetMarkerClass
		});
		marker.model = model;
		return marker;
	}
}

/**
 * Removes Emmmet abbreviation markers from given editor
 * @param  {TextEditor} editor
 */
export function clearMarkers(editor) {
	const markers = editor.getAllMarks();
	for (let i = 0; i < markers.length; i++) {
		if (markers[i].className = emmetMarkerClass) {
			markers[i].clear();
		}
	}
}

/**
 * Returns abbreviation model: object with `ast` and `snippet` properties
 * that contains parsed and expanded abbreviation respectively
 * @param  {String} abbreviation
 * @param  {TextEditor} editor
 * @return {Object} Returns `null` if abbreviation cannot be parsed
 */
function createAbbreviationModel(abbreviation, editor) {
	try {
		const ast = parseAbbreviation(abbreviation, editor);
		return {
			ast,
			abbreviation,
			snippet: expandAbbreviation(abbreviation, editor)
		};
	} catch (err) {
		return null;
	}
}

/**
 * Check if given abbreviation model is allowed for auto-activated abbreviation
 * marker. Used to reduce falsy activations
 * @param  {Object} model Parsed abbreviation model (see `createAbbreviationModel()`)
 * @return {Boolean}
 */
function allowedForAutoActivation(model) {
	const rootNode = model.ast.children[0];
	// The very first node should start with alpha character
	// Skips falsy activations for something like `$foo` etc.
	return rootNode && /^[a-z]/i.test(rootNode.name);
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

	// No newlines inside abreviation
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
		marker.model = createAbbreviationModel(text, editor);
	}

	return !!(marker.model && marker.model.snippet);
}
