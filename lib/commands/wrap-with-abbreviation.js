'use strict';

import { containsPos, rangeFromNode, narrowToNonSpace } from '../utils';
import { Abbreviation, getExpandOptions } from '../abbreviation';

/**
 * Marks selected text or matched node content with abbreviation
 * @param {CodeMirror} editor 
 */
export default function wrapWithAbbreviation(editor) {
	const range = getWrappingContentRange(editor);

	if (range) {
		const prompt = editor.getOption('emmetPrompt') || defaultPrompt;
		const text = editor.getRange(range.from, range.to, '\n')
			.split('\n')
			.map(line => line.trim());

		prompt(editor, 'Enter abbreviation to wrap with:', abbr => {
			if (abbr) {
				const model = new Abbreviation(abbr, null, getExpandOptions(editor, range.from), { text });
				model.insert(editor, range);
			}
		});
	} else {
		console.warn('Nothing to wrap');
	}
}

/**
 * Returns content range that should be wrapped
 * @param {CodeMirror} editor 
 */
function getWrappingContentRange(editor) {
	if (editor.somethingSelected()) {
		const sel = editor.listSelections().filter(sel => sel.anchor !== sel.head)[0];
		if (sel) {
			return { from: sel.anchor, to: sel.head };
		}
	}

	// Nothing selected, find parent HTML node and return range for its content
	return getTagRangeForPos(editor, editor.getCursor());
}

/**
 * Returns either inner or outer tag range (depending on `pos` location) 
 * for given position
 * @param {CodeMirror} editor 
 * @param {Object} pos 
 * @return {Object}
 */
function getTagRangeForPos(editor, pos) {
	const model = editor.getEmmetDocumentModel();
	const tag = model && model.nodeForPoint(pos);

	if (!tag) {
		return null;
	}

	// Depending on given position, return either outer or inner tag range
	if (inRange(tag.open, pos) || inRange(tag.close, pos)) {
		// Outer range
		return rangeFromNode(tag);
	}

	// Inner range
	const from = tag.open.end;
	const to = tag.close ? tag.close.start : tag.open.end;

	return narrowToNonSpace(editor, from, to);
}

function inRange(tag, pos) {
	return tag && containsPos(rangeFromNode(tag), pos);
}

function defaultPrompt(editor, message, callback) {
	callback(window.prompt(message));
}
