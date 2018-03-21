'use strict';

import emmetExpandAbbreviation from './lib/commands/expand-abbreviation';
import emmetInsertLineBreak from './lib/commands/formatted-line-break';
import emmetWrapWithAbbreviation from './lib/commands/wrap-with-abbreviation';
import { markOnEditorChange } from './lib/abbreviation-marker';
import getAbbreviation, { findMarker, clearMarkers, createMarker } from './lib/abbreviation';
import autocompleteProvider from './lib/autocomplete';
import getModel, { getCachedModel, resetCachedModel } from './lib/model/index';
import matchTag, { clearTagMatch } from './lib/match-tag';
import renameTag from './lib/rename-tag';

const commands = { emmetExpandAbbreviation, emmetInsertLineBreak, emmetWrapWithAbbreviation };

/**
 * Registers Emmet extension on given CodeMirror constructor.
 * This file is designed to be imported somehow into the app (CommonJS, ES6,
 * Rollup/Webpack/whatever). If you simply want to add a <script> into your page
 * that registers Emmet extension on global CodeMirror constructor, use
 * `browser.js` instead
 */
export default function registerEmmetExtension(CodeMirror) {
	// Register Emmet commands
	Object.assign(CodeMirror.commands, commands);

	// Defines options that allows abbreviation marking in text editor
	CodeMirror.defineOption('markEmmetAbbreviation', true, (editor, value) => {
		if (value) {
			editor.on('change', markOnEditorChange);
		} else {
			editor.off('change', markOnEditorChange);
			clearMarkers(editor);
		}
	});

	CodeMirror.defineOption('autoRenameTags', true, (editor, value) => {
		value ? editor.on('change', renameTag) : editor.off('change', renameTag);
	});

	CodeMirror.defineOption('markTagPairs', false, (editor, value) => {
		if (value) {
			editor.on('cursorActivity', matchTag);
			editor.on('change', resetCachedModel);
		} else {
			editor.off('cursorActivity', matchTag);
			editor.off('change', resetCachedModel);
			resetCachedModel(editor);
			clearTagMatch(editor);
		}
	});

	// Emmet config: https://github.com/emmetio/config
	CodeMirror.defineOption('emmet', {});

	/**
	 * Returns Emmet completions for context from `pos` position.
	 * Abbreviations are calculated for marked abbreviation at given position.
	 * If no parsed abbreviation marker is available and `force` argument is
	 * given, tries to mark abbreviation and populate completions list again.
	 * @param  {CodeMirror.Position} [pos]
	 * @param  {Boolean} [force]
	 * @return {EmmetCompletion[]}
	 */
	CodeMirror.defineExtension('getEmmetCompletions', function(pos, force) {
		const editor = this;
		if (typeof pos === 'boolean') {
			force = pos;
			pos = null;
		}

		pos = pos || editor.getCursor();

		const autocomplete = autocompleteProvider(editor, pos);
		if (autocomplete && autocomplete.completions.length) {
			if (editor.getOption('markEmmetAbbreviation')) {
				// Ensure abbreviation marker exists
				if (!findMarker(editor, pos) && force) {
					clearMarkers(editor);
					createMarker(autocomplete.model);
				}
			}

			return {
				from: autocomplete.abbreviation.range.from,
				to: autocomplete.abbreviation.range.to,
				list: autocomplete.completions
			};
		}
	});

	/**
	 * Returns valid Emmet abbreviation and its location in editor from given
	 * position
	 * @param  {CodeMirror.Pos} [pos] Position from which abbreviation should be
	 * extracted. If not given, current cursor position is used
	 * @return {Abbreviation}
	 */
	CodeMirror.defineExtension('getEmmetAbbreviation', function(pos) {
		return getAbbreviation(this, pos || this.getCursor());
	});

	CodeMirror.defineExtension('findEmmetMarker', function(pos) {
		return findMarker(this, pos || this.getCursor());
	});

	CodeMirror.defineExtension('getEmmetDocumentModel', function() {
		const editor = this;
		return editor.getOption('markTagPairs')
			? getCachedModel(editor)
			: getModel(editor);
	});
}
