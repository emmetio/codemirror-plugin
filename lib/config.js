'use strict';

import resolveConfig from '@emmetio/config';

const editorField = (index, placeholder = '') => `\${${index}${placeholder ? ':' + placeholder : ''}}`;

/**
 * Returns resolved Emmet config for `pos` location of given editor
 * @param  {CodeMirror.Editor} editor
 * @param  {CodeMirror.Position} [pos]  Point in editor where syntax should be detected.
 * Uses `editor.getCursor()` if not given
 * @param  {Object} [options] Additional options to override before config resolve
 * @return {Object}
 */
export default function createConfig(editor, pos, options) {
	pos = pos || editor.getCursor();
	const syntax = getSyntax(editor, pos);

	/** @type {EmmetConfig} */
	const config = resolveConfig(Object.assign(
		{ field: editorField },
		editor.getOption('emmet'),
		options
	), { syntax });

	const mode = editor.getModeAt(pos);
	if (syntax === 'jsx') {
		config.profile = Object.assign({ selfClosingStyle: 'xml' }, config.profile);
		config.options = Object.assign({ jsx: true }, config.options);
	} else if (mode.name === 'xml') {
		config.profile = Object.assign({ selfClosingStyle: mode.configuration }, config.profile);
	}

	return config;
}

/**
 * Detect Emmet syntax from given editor’s position.
 * @param {CodeMirror.Editor} editor
 * @param {CodeMirror.Position} [pos]
 * @return {String} Returns `null` if Emmet syntax can’t be detected
 */
export function getSyntax(editor, pos) {
	const rootMode = editor.getMode();
	if (rootMode.name === 'jsx' || rootMode.name === 'javascript') {
		return rootMode.name;
	}

	const mode = editor.getModeAt(pos);
	return mode.name === 'xml' ? 'html' : mode.name;
}
