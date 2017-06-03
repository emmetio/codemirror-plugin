'use strict';

import { createAbbreviationModel, extractAbbreviation } from './expand-abbreviation';
import { hasAutoActivateContext } from './detect-syntax';

const emmetMarkerClass = 'emmet-abbreviation';

/**
 * Editor’s `change` event handler that marks Emmet abbreviation when editor
 * content is updated
 * @param  {CodeMirror} editor
 */
export function markOnEditorChange(editor) {
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
		if (markers[i].className === emmetMarkerClass) {
			markers[i].clear();
		}
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
