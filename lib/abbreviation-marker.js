'use strict';

import getAbbreviation, { findMarker, createMarker, clearMarkers } from './abbreviation';

/**
 * Marks Emmet abbreviation for given editor position, if possible
 * @param  {CodeMirror.Editor} editor Editor where abbreviation marker should be created
 * @param  {CodeMirror.Position} pos Editor position where abbreviation marker
 * should be created. Abbreviation will be automatically extracted from given position
 * @param  {Boolean} [forced] Indicates that user forcibly requested abbreviation
 * marker (e.g. was not activated automatically). Affects abbreviation detection policy
 * @return {CodeMirror.TextMarker} Returns `undefined` if no valid abbreviation under caret
 */
export default function markAbbreviation(editor, pos, forced) {
	const marker = findMarker(editor, pos);
	if (marker) {
		// there’s active marker with valid abbreviation
		return marker;
	}

	// No active marker: remove previous markers and create new one, if possible
	clearMarkers(editor);

	const model = getAbbreviation(editor, pos, true);

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
