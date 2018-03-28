'use strict';

import extract from '@emmetio/extract-abbreviation';
import createConfig from './config';
import { isCSSPropertyValue, getCSSPropertyName } from './utils';

/**
 * Context-aware abbreviation extraction from given editor.
 * Detects syntax context in `pos` editor location and, if it allows Emmet 
 * abbreviation to be extracted here, returns object with extracted abbreviation,
 * its location and config. 
 * @param {CodeMirror.Editor} editor 
 * @param {CodeMirror.Position} pos 
 */
export default function extractAbbreviation(editor, pos, contextAware) {
	const config = createConfig(editor, pos);

	if (contextAware && !canExtract(editor, pos, config)) {
		return null;
	}

	const extracted = extract(editor.getLine(pos.line), pos.ch, {
		lookAhead: true,
		syntax: config.type
	});

	if (extracted) {
		const from = {
			line: pos.line,
			ch: extracted.location
		};
		const to = {
			line: pos.line,
			ch: from.ch + extracted.abbreviation.length
		};

		if (config.syntax === 'jsx' && editor.getOption('jsxBracket')) {
			// For JSX, in order to properly handle JS snippets and contexts,
			// assume that user should start abbreviation with `<` to indicate it’s
			// JSX and we will replace it after expand
			const tokenType = editor.getTokenTypeAt(from) || '';
			if (tokenType.includes('tag') && tokenType.includes('bracket')) {
				from.ch--;
			} else {
				return null;
			}
		} else if (config.type === 'stylesheet' && contextAware) {
			// In case of stylesheet syntaxes (CSS, LESS) we should narrow down
			// expand context to property value, if possible
			if (isCSSPropertyValue(editor, pos)) {
				config.options = Object.assign({ property: getCSSPropertyName(editor, pos) }, config.options);
			}
		}

		return {
			abbreviation: extracted.abbreviation,
			range: { from, to },
			config
		};
	}
}

/**
 * Check if abbreviation can be extracted from given position
 * @param {CodeMirror.Editor} editor 
 * @param {CodeMirror.Position} pos 
 * @param {Object} config 
 * @return {Boolean}
 */
function canExtract(editor, pos, config) {
	const tokenType = editor.getTokenTypeAt(pos);
	
	if (config.type === 'stylesheet') {
		return tokenType !== 'comment' && tokenType !== 'string';
	}

	if (config.syntax === 'html') {
		return tokenType === null;
	}

	if (config.syntax === 'slim' || config.syntax === 'pug') {
		return tokenType === null || tokenType === 'tag' 
			|| (tokenType && /attribute/.test(tokenType));
	}

	if (config.syntax === 'haml') {
		return tokenType === null || tokenType === 'attribute';
	}

	if (config.syntax === 'jsx') {
		// JSX a bit tricky, delegate it to caller
		return true;
	}

	return false;
}
