'use strict';

import getAbbreviation, { findMarker, createMarker, clearMarkers } from './abbreviation';

/**
 * Marks Emmet abbreviation for given editor position, if possible
 * @param  {CodeMirror.Editor} editor Editor where abbreviation marker should be created
 * @param  {CodeMirror.Position} pos Editor position where abbreviation marker
 * should be created. Abbreviation will be automatically extracted from given position
 * @return {CodeMirror.TextMarker} Returns `undefined` if no valid abbreviation under caret
 */
export default function markAbbreviation(editor, pos) {
	const marker = findMarker(editor, pos);
	if (marker) {
		// there’s active marker with valid abbreviation
		return marker;
	}

	// No active marker: remove previous markers and create new one, if possible
	clearMarkers(editor);

	const model = getAbbreviation(editor, pos, true);

	if (model) {
		return createMarker(editor, model);
	}
}
