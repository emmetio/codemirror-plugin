'use strict';

/**
 * Returns available completions from given editor
 * @param  {CodeMirror} editor CodeMirror editor instance
 * @param  {Object}     [pos]  Position in editor for which completions should
 *                             be calculated. Uses last cursor if not given
 * @return {Completion[]}
 */
export default function(editor, pos) {
	pos = pos || editor.getCursor();


}

/**
 * Returns completions for markup syntaxes (HTML, Slim, Pug etc.)
 * @param  {CodeMirror} editor
 * @param  {Object} pos
 * @return {Completion[]}
 */
function getMarkupCompletions(editor, pos) {

}

function getStylesheetCompletions(editor, pos) {

}

class EmmetCompletion {
	constructor(editor, range, snippet, newSelection) {
		this.editor = editor;
		this.range = range;
		this.snippet = snippet;
		this.newSelection = newSelection;

		this._inserted = false;
	}

	insert() {
		if (!this._inserted) {
			this._inserted = true;
			this.editor.replaceRange(this.snippet, this.range.from, this.range.to);
			if (this.newSelection) {
				editor.setSelection(this.newSelection.from, this.newSelection.to);
			}
		}
	}
}
