'use strict';

import parseFields from '@emmetio/field-parser';
import CodeMirrorStreamReader from './stream-reader';
import { isSpace } from '@emmetio/stream-reader-utils';

/**
 * Returns token used for single indentation in given editor
 * @param  {CodeMirror.Editor} editor
 * @return {String}
 */
export function getIndentation(editor) {
	if (!editor.getOption('indentWithTabs')) {
		return repeatString(' ', editor.getOption('indentUnit'));
	}

	return '\t';
}

/**
 * Normalizes text according to given CodeMirror instance indentation
 * preferences
 * @param  {String} text
 * @param  {CodeMirror.Editor} editor
 * @param  {String} [indentation] Applies `indentText()` with given argument, if provided
 * @return {String}
 */
export function normalizeText(editor, text, indentation) {
	let lines = splitByLines(text);
	const indent = getIndentation(editor);

	if (indent !== '\t') {
		lines = lines.map(line => line.replace(/^\t+/,
			tabs => repeatString(indent, tabs.length)));
	}

	if (indentation) {
		lines = lines.map((line, i) => i ? indentation + line : line);
	}

	return lines.join('\n');
}

/**
 * Indents each line, except first one, in given text
 * @param  {String} text
 * @param  {String} indentation
 * @return {String}
 */
export function indentText(text, indentation) {
	return splitByLines(text)
		.map((line, i) => i ? indentation + line : line)
		.join('\n');
}

/**
 * Splits given text by lines
 * @param  {String} text
 * @return {String[]} Lines of text
 */
export function splitByLines(text) {
	return Array.isArray(text) ? text : text.split(/\r\n|\r|\n/g);
}

export function repeatString(str, count) {
	let result = '';
	while (0 < count--) {
		result += str;
	}

	return result;
}

/**
 * Quick and dirty way to remove fields from given string
 * @param  {String} str
 * @return {String}
 */
export function removeFields(str) {
	return parseFields(str).string;
}

/**
 * Check if given range contains point
 * @param  {CodeMirror.Range} range
 * @param  {CodeMirror.Position} pos
 * @param  {Boolean} [exclude] Exclude range and and start
 * @return {Boolean}
 */
export function containsPos(range, pos, exclude) {
	return exclude
		? comparePos(pos, range.from) > 0 && comparePos(pos, range.to) < 0
		: comparePos(pos, range.from) >= 0 && comparePos(pos, range.to) <= 0;
}

export function comparePos(a, b) {
	return a.line - b.line || a.ch - b.ch;
}

export function rangeFromNode(node) {
	return {
		from: node.start,
		to: node.end
	};
}

/**
 * Narrows given `{from, to}` range to first non-whitespace characters in given 
 * editor content
 * @param {CodeMirror.Editor} editor 
 * @param {CodeMirror.Position} from 
 * @param {CodeMirror.Position} [to] 
 * @returns {Object}
 */
export function narrowToNonSpace(editor, from, to) {
	const stream = new CodeMirrorStreamReader(editor, from);

	stream.eatWhile(isSpace);
	from = stream.pos;
	
	if (to) {
		stream.pos = to;
		stream.backUp();

		while (!stream.sof() && isSpace(stream.peek())) {
			stream.backUp();
		}

		stream.next();
		to = stream.pos;
	} else {
		to = from;
	}

	return { from, to };
}

/**
 * Returns nearest CSS property name, left to given position
 * @param {CodeMirror.Editor} editor 
 * @param {CodeMirror.Position} pos 
 * @returns {String}
 */
export function getCSSPropertyName(editor, pos) {
	const line = pos.line;
	let ch = pos.ch, token;

	while (ch >= 0) {
		token = editor.getTokenAt({ line, ch });
		if (token.type === 'property') {
			return token.string;
		}

		if (token.start !== ch) {
			ch = token.start;
		} else {
			break;
		}
	}
}

/**
 * Check if given position is inside CSS property value
 * @param {CodeMirror.Editor} editor 
 * @param {CodeMirror.Position} pos 
 * @return {Boolean}
 */
export function isCSSPropertyValue(editor, pos) {
	const mode = editor.getModeAt(pos);
	if (mode && mode.name === 'css') {
		const token = editor.getTokenAt(pos);
		const state = token.state && token.state.localState || token.state;
		return state && state.context && state.context.type === 'prop';
	}
}
