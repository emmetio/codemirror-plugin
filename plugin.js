'use strict';

import emmetExpandAbbreviation from './lib/commands/expand-abbreviation';
import emmetInsertLineBreak from './lib/commands/formatted-line-break';
import markAbbreviation from './lib/abbreviation-marker';
import autocompleteProvider from './lib/autocomplete';
import { findMarker } from './lib/abbreviation-marker';

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
		Enter: 'emmetInsertLineBreak'
	};

	registerCommands(editor, globalCommands);
	registerAutocomplete(editor);

	editor.addKeyMap(keymap);
	editor.setOption('emmet', options);
	const disposeMarker = markAbbreviation(editor);

	return {
		getCompletions(pos, force) {
			return autocompleteProvider(editor, pos, force);
		},
		dispose() {
			disposeMarker();
			editor.setOption('emmet', null);
			editor.removeKeyMap(keymap);
		}
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

function registerAutocomplete(editor) {
	const CodeMirror = editor.constructor;

	CodeMirror.registerGlobalHelper('hint', 'emmet',
		(mode, editor) => {
			return !!findMarker(editor, editor.getCursor());
		},
		(editor, options) => {
			const pos = editor.getCursor();
			const marker = findMarker(editor, pos);
			const markeRange = marker.find();

			return {
				from: markeRange.from,
				to: markeRange.to,
				list: autocompleteProvider(editor, pos).map(transformCompletion)
			};
		});
}

function transformCompletion(completion) {
	return {
		from: completion.range.from,
		to: completion.range.to,
		render(elt) {
			elt.textContent = completion.label;
		},
		hint() {
			completion.insert();
		}
	};
}
