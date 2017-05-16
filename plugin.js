'use strict';

import emmetExpandAbbreviation from './lib/commands/expand-abbreviation';
import emmetInsertLineBreak from './lib/commands/formatted-line-break';

const globalCommands = { emmetExpandAbbreviation, emmetInsertLineBreak };

/**
 * Adds Emmet support to given CodeMirror editor instance
 * @param  {CodeMirror} editor
 * @return {Function} A function that, when called, completely removes Emmet
 * support from editor instance
 */
export default function(editor, options) {
	options = options || {};
	const keymap = options.keymap || {
		Tab: 'emmetExpandAbbreviation',
		'Enter': 'emmetInsertLineBreak'
	};

	registerCommands(editor, globalCommands);
	editor.addKeyMap(keymap);
	editor.setOption('emmet', options);

	return () => {
		editor.setOption('emmet', null);
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
