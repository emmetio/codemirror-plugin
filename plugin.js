'use strict';

import emmetExpandAbbreviation from './lib/commands/expand-abbreviation';

const globalCommands = { emmetExpandAbbreviation };

/**
 * Adds Emmet support to given CodeMirror editor instance
 * @param  {CodeMirror} editor
 * @return {Function} A function that, when called, completely removes Emmet
 * support from editor instance
 */
export default function(editor) {
	const keymap = {
		Tab: 'emmetExpandAbbreviation'
	};

	registerCommands(editor, globalCommands);
	editor.addKeyMap(keymap);

	return () => {
		editor.removeKeyMap(keymap);
	};
}

/**
 * Registers editor commands in given editor, if required
 * @param  {CodeMirror} editor   Editor instance
 * @param  {Object}     commands Commands map
 */
function registerCommands(editor, commands) {
	const CodeMirror = editor.constructor;

	Object.keys(commands).forEach(name => {
		if (!CodeMirror.commands[name]) {
			CodeMirror.commands[name] = commands[name];
		}
	});
}
