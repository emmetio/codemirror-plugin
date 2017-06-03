'use babel';

import parseHTML from './html';

export default function getModel(editor) {
	const syntax = getSyntax(editor);
	return parseHTML(editor, syntax);
}

export function getCachedModel(editor) {
	if (!editor.state._emmetModel) {
		editor.state._emmetModel = getModel(editor);
	}

	return editor.state._emmetModel;
}

export function resetCachedModel(editor) {
	editor.state._emmetModel = null;
}

/**
 * Returns parser-supported syntax of given editor (like 'html', 'css' etc.).
 * Returns `null` if editor’s syntax is unsupported
 * @param  {CodeMirror} editor
 * @return {String}
 */
function getSyntax(editor) {
	const mode = editor.getMode();

	if (mode.name === 'htmlmixed') {
		return 'html';
	}

	return mode.name === 'xml' ? mode.configuration : mode.name;
}
