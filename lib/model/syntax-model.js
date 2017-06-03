'use strict';

import { containsPos } from '../utils';

/**
 * A syntax-specific model container, used to get unified access to underlying
 * parsed document
 */
export default class SyntaxModel {
	/**
	 * @param  {Object} dom      Parsed document tree
	 * @param  {String} type     Type of document (html, stylesheet, etc.)
	 * @param  {String} [syntax] Optional document syntax like html, xhtml or xml
	 */
	constructor(dom, type, syntax) {
		this.dom = dom;
		this.type = type;
		this.syntax = syntax;
	}

	/**
	 * Returns best matching node for given point
	 * @param  {CodeMirror.Pos}   pos
	 * @param  {Boolean} [exclude] Exclude node’s start and end positions from
	 *                             search
	 * @return {Node}
	 */
	nodeForPoint(pos, exclude) {
		let ctx = this.dom.firstChild;
		let found = null;

		while (ctx) {
			if (containsPos(range(ctx), pos, exclude)) {
				// Found matching tag. Try to find deeper, more accurate match
				found = ctx;
				ctx = ctx.firstChild;
			} else {
				ctx = ctx.nextSibling;
			}
		}

		return found;
	}
}

function range(node) {
	return {
		from: node.start,
		to: node.end
	};
}
