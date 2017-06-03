'use strict';

import { containsPos } from './utils';

const openTagMark = 'emmet-open-tag';
const closeTagMark = 'emmet-close-tag';

/**
 * Finds matching tag pair for given position in editor
 * @param  {CodeMirror} editor
 * @param  {CodeMirror.Pos} pos
 * @return {Object}
 */
export default function matchTag(editor, pos) {
	pos = pos || editor.getCursor();

	// First, check if there are tag markers in editor
	const marked = getMarkedTag(editor);

	// If marks found, validate them: make sure cursor is either in open
	// or close tag
	if (marked) {
		if (containsPos(marked.open.find(), pos)) {
			// Point is inside open tag, make sure if there’s a closing tag,
			// it matches open tag content
			if (!marked.close || text(editor, marked.open) === text(editor, marked.close)) {
				return marked;
			}
		} else if (marked.close) {
			// There’s a close tag, make sure pointer is inside it and it matches
			// open tag
			if (containsPos(marked.close.find(), pos) && text(editor, marked.open) === text(editor, marked.close)) {
				return marked;
			}
		}
	}
	
	// Markers are not valid anymore, remove them
	clearTagMatch(editor);

	// Find new tag pair from parsed HTML model and mark them
	const node = findTagPair(editor, pos);
	if (node && node.type === 'tag') {
		return {
			open: createTagMark(editor, node.open.name, openTagMark),
			close: node.close && createTagMark(editor, node.close.name, closeTagMark)
		};
	}
}

export function getMarkedTag(editor) {
	let open, close;
	editor.getAllMarks().forEach(mark => {
		if (mark.className === openTagMark) {
			open = mark;
		} else if (mark.className === closeTagMark) {
			close = mark;
		}
	});

	return open ? { open, close } : null;
}

/**
 * Removes all matched tag pair markers from editor
 * @param  {CodeMirror} editor
 */
export function clearTagMatch(editor) {
	editor.getAllMarks().forEach(mark => {
		if (mark.className === openTagMark || mark.className === closeTagMark) {
			mark.clear();
		}
	});
}

/**
 * Finds tag pair (open and close, if any) form parsed HTML model of given editor
 * @param  {CodeMirror} editor
 * @param  {CodeMirror.Pos} pos
 * @return {Object}
 */
export function findTagPair(editor, pos) {
	const model = editor.getEmmetDocumentModel();
	return model && model.nodeForPoint(pos || editor.getCursor());
}

function createTagMark(editor, tag, className) {
	return editor.markText(tag.start, tag.end, {
		className,
		inclusiveLeft: true,
		inclusiveRight: true
	});
}

function text(editor, mark) {
	const range = mark.find();
	return range ? editor.getRange(range.from, range.to) : '';
}
