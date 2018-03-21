'use strict';

import StreamReader from '@emmetio/stream-reader';

const LINE_END = 10; // \n

/**
 * A stream reader for CodeMirror editor
 */
export default class CodeMirrorStreamReader extends StreamReader {
	/**
	 * @param  {CodeMirror.Editor} editor
	 * @param  {CodeMirror.Position} [pos]
	 * @param  {CodeMirror.Range} [limit]
	 */
	constructor(editor, pos, limit) {
		super();
		const CodeMirror = editor.constructor;
		this.editor = editor;
		this.start = this.pos = pos || CodeMirror.Pos(0, 0);

		const lastLine = editor.lastLine();
		this._eof = limit ? limit.to   : CodeMirror.Pos(lastLine, this._lineLength(lastLine));
		this._sof = limit ? limit.from : CodeMirror.Pos(0, 0);
	}

	/**
	 * Returns true only if the stream is at the beginning of the file.
	 * @returns {Boolean}
	 */
	sof() {
		return comparePos(this.pos, this._sof) <= 0;
	}

	/**
	 * Returns true only if the stream is at the end of the file.
	 * @returns {Boolean}
	 */
	eof() {
		return comparePos(this.pos, this._eof) >= 0;
	}

	/**
	 * Creates a new stream instance which is limited to given `start` and `end`
	 * points for underlying buffer
	 * @param  {CodeMirror.Pos} start
	 * @param  {CodeMirror.Pos} end
	 * @return {CodeMirrorStreamReader}
	 */
	limit(from, to) {
		return new this.constructor(this.editor, from, { from, to });
	}

	/**
	 * Returns the next character code in the stream without advancing it.
	 * Will return NaN at the end of the file.
	 * @returns {Number}
	 */
	peek() {
		const { line, ch } = this.pos;
		const lineStr = this.editor.getLine(line);
		return ch < lineStr.length ? lineStr.charCodeAt(ch) : LINE_END;
	}

	/**
	 * Returns the next character in the stream and advances it.
	 * Also returns NaN when no more characters are available.
	 * @returns {Number}
	 */
	next() {
		if (!this.eof()) {
			const code = this.peek();
			this.pos = Object.assign({}, this.pos, { ch: this.pos.ch + 1 });

			if (this.pos.ch >= this._lineLength(this.pos.line)) {
				this.pos.line++;
				this.pos.ch = 0;
			}

			if (this.eof()) {
				// handle edge case where position can move on next line
				// after EOF
				this.pos = Object.assign({}, this._eof);
			}

			return code;
		}

		return NaN;
	}

	/**
	 * Backs up the stream n characters. Backing it up further than the
	 * start of the current token will cause things to break, so be careful.
	 * @param {Number} n
	 */
	backUp(n) {
		const CodeMirror = this.editor.constructor;

		let { line, ch } = this.pos;
		ch -= (n || 1);

		while (line >= 0 && ch < 0) {
			line--;
			ch += this._lineLength(line);
		}

		this.pos = line < 0 || ch < 0
			? CodeMirror.Pos(0, 0)
			: CodeMirror.Pos(line, ch);

		return this.peek();
	}

	/**
	 * Get the string between the start of the current token and the
	 * current stream position.
	 * @returns {String}
	 */
	current() {
		return this.substring(this.start, this.pos);
	}

	/**
	 * Returns contents for given range
	 * @param  {Point} from
	 * @param  {Point} to
	 * @return {String}
	 */
	substring(from, to) {
		return this.editor.getRange(from, to);
	}

	/**
	 * Creates error object with current stream state
	 * @param {String} message
	 * @return {Error}
	 */
	error(message) {
		const err = new Error(`${message} at line ${this.pos.line}, column ${this.pos.ch}`);
		err.originalMessage = message;
		err.pos = this.pos;
		err.string = this.string;
		return err;
	}

	/**
	 * Returns length of given line, including line ending
	 * @param  {Number} line
	 * @return {Number}
	 */
	_lineLength(line) {
		const isLast = line === this.editor.lastLine();
		return this.editor.getLine(line).length + (isLast ? 0 : 1);
	}
}

function comparePos(a, b) {
	return a.line - b.line || a.ch - b.ch;
}
