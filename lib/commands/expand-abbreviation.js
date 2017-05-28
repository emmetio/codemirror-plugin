'use strict';

import { findMarker, clearMarkers } from '../abbreviation-marker';
import { extractAbbreviation, expandAndInsert } from '../expand-abbreviation';

/**
 * Expand abbreviation command
 * @param  {CodeMirror} editor
 */
export default function(editor) {
	const pos = editor.getCursor();
	const marker = findMarker(editor, pos);

	let result = false;

	// Handle two possible options: expand abbreviation from Emmet marker that
	// matches given location or extract & expand abbreviation from cursor
	// position. The last one may happen if either `markeEmmetAbbreviation`
	// option is turned off or user moved cursor away from Emmet marker and
	// tries to expand another abbreviation

	if (marker) {
		result = expandAndInsert(editor, marker.model.ast, marker.find().from);
	} else {
		const abbrData = extractAbbreviation(editor, pos);
		if (abbrData) {
			result = expandAndInsert(editor, abbrData.abbreviation, {
				line: pos.line,
				ch: abbrData.location
			});
		}
	}

	clearMarkers(editor);

	// If no abbreviation was expanded, allow editor to handle different
	// action for keyboard shortcut (Tab key mostly)
	return result || editor.constructor.Pass;
}
