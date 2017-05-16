'use strict';

/**
 * Normalizes text according to given CodeMirror instance indentation
 * preferences
 * @param  {String}     text
 * @param  {CodeMirror} editor
 * @param  {String}     [indentation] Applies `indentText()` with given argument,
 *                                    if provided
 * @return {String}
 */
export function normalizeText(editor, text, indentation) {
	let lines = splitByLines(text);

	if (!editor.getOption('indentWithTabs')) {
		const indent = repeatString(' ', editor.getOption('indentUnit'));
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
