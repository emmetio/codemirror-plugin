'use strict';

import { getMarkedTag, clearTagMatch } from './match-tag';
import { containsPos } from './utils';

export default function renameTag(editor, obj) {
	const tag = getMarkedTag(editor);
	const pos = obj.from;

	if (!tag) {
		return;
	}

	if (containsPos(tag.open.find(), pos) && tag.close) {
		// Update happened inside open tag, update close tag as well
		updateTag(editor, tag.open, tag.close);
	} else if (tag.close && containsPos(tag.close.find(), pos)) {
		// Update happened inside close tag, update open tag as well
		updateTag(editor, tag.close, tag.open);
	}
}

export function updateTag(editor, source, dest) {
	const name = text(editor, source);
	const range = dest.find();
	const m = name.match(/[\w:\-]+/);
	const newName = !name ? '' : (m && m[0]);

	if (newName != null) {
		if (editor.getRange(range.from, range.to) !== newName) {
			editor.replaceRange(newName, range.from, range.to);
		}
	} else {
		// User entered something that wasn’t a valid tag name.
		clearTagMatch(editor);
	}
}

function text(editor, mark) {
	const range = mark.find();
	return range ? editor.getRange(range.from, range.to) : '';
}
