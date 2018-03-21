'use strict';

import { hasAutoActivateContext } from './detect-syntax';
import getAbbreviation, { findMarker, createMarker, clearMarkers } from './abbreviation';

/**
 * Editor’s `change` event handler that marks Emmet abbreviation when editor
 * content is updated
 * @param  {CodeMirror.Editor} editor
 */
export function markOnEditorChange(editor) {
	const marker = findMarker(editor, editor.getCursor());
	if (marker) {
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
 * Marks Emmet abbreviation for given editor position, if possible
 * @param  {CodeMirror.Editor} editor Editor where abbreviation marker should be created
 * @param  {CodeMirror.Position} pos Editor position where abbreviation marker 
 * should be created. Abbreviation will be automatically extracted from given position
 * @param  {Boolean} [forced] Indicates that user forcibly requested abbreviation
 * marker (e.g. was not activated automatically). Affects abbreviation detection policy
 * @return {CodeMirror.TextMarker} Returns `undefined` if no valid abbreviation under caret
 */
export function markAbbreviation(editor, pos, forced) {
	const marker = findMarker(editor, pos);
	if (marker) {
		// there’s active marker with valid abbreviation
		return marker;
	}

	// No active marker: remove previous markers and create new one, if possible
	clearMarkers(editor);

	const model = getAbbreviation(editor, pos);

	if (model && (forced || allowedForAutoActivation(model))) {
		return createMarker(editor, model);
	}
}

/**
 * Check if given abbreviation model is allowed for auto-activated abbreviation
 * marker. Used to reduce falsy activations
 * @param  {Abbreviation} model Parsed abbreviation model (see `createAbbreviationModel()`)
 * @return {Boolean}
 */
function allowedForAutoActivation(model) {
	const rootNode = model.ast.children[0];
	// The very first node should start with alpha character
	// Skips falsy activations for something like `$foo` etc.
	return rootNode && /^[a-z]/i.test(rootNode.name);
}
