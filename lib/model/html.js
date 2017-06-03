'use strict';

import parseHTML from '@emmetio/html-matcher';
import SyntaxModel from './syntax-model';
import StreamReader from '../stream-reader';

/**
 * Creates DOM-like model for given text editor
 * @param  {CodeMirror} editor
 * @param  {String}     syntax
 * @return {Node}
 */
export default function create(editor, syntax) {
	const stream = new StreamReader(editor);
	const xml = syntax === 'xml';

	try {
		return new SyntaxModel(parseHTML(stream, { xml }), 'html', syntax || 'html');
	} catch (err) {
		console.warn(err);
	}
}
