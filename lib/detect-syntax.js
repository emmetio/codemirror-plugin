'use strict';

/**
 * Syntaxes known by Emmet. All other syntaxes shoud map to one of these
 * @type {Set}
 */
const knownSyntaxes = new Set([
	'html', 'xml', 'xsl', 'jsx', 'js', 'pug', 'slim', 'haml',
	'css', 'sass', 'scss', 'less', 'sss', 'stylus'
]);

/**
 * Common context checker for abbreviation auto-activation for
 * stylesheet syntaxes (CSS, SCSS, LESS etc.)
 * @param  {CodeMirror} editor
 * @return {Boolean}
 */
const stylesheetAutoActivationContext = (editor, pos) => {
	const tokenType = editor.getTokenTypeAt(pos || editor.getCursor());
	// NB may return `property` or `property error` type
	return tokenType && /^property\b/.test(tokenType);
};

const autoActivationContext = {
	html(editor, pos) {
		// Do not provide automatic abbreviation completion inside HTML tags,
		// e.g. work only inside plain text token
		return editor.getTokenTypeAt(pos || editor.getCursor()) === null;
	},

	css:  stylesheetAutoActivationContext,
	less: stylesheetAutoActivationContext,
	sass: stylesheetAutoActivationContext,
	scss: stylesheetAutoActivationContext
};

/**
 * Detect Emmet syntax from given editor’s position.
 * @param {CodeMirror}     editor
 * @param {CodeMirror.Pos} [pos]
 * @return {String}        Returns `null` if Emmet syntax can’t be detected
 */
export default function detectSyntax(editor, pos) {
	const mode = editor.getModeAt(pos || editor.getCursor());
	const syntax = mode.name === 'xml' ? 'html' : mode.name;

	if (isSupported(syntax)) {
		return syntax;
	}

	// No supported syntax found, try from Emmet-specific options
	const emmetOpt = editor.getOption('emmet');
	if (emmetOpt && isSupported(emmetOpt.syntax)) {
		return emmetOpt.syntax;
	}

	return null;
}

/**
 * Check if given syntax is supported by Emmet
 * @param  {String}  syntax
 * @return {Boolean}
 */
export function isSupported(syntax) {
	return knownSyntaxes.has(syntax);
}

/**
 * Check if current editor’s context (syntax, scope) allows automatic Emmet
 * abbreviation activation as user types text. If this function returns `false`,
 * it is recommended to not create any Emmet completions when user types text,
 * but insert them when user activated autocomplete popup manually
 * @param  {CodeMirror}  editor
 * @param  {CodeMirror.Pos} [pos]
 * @return {Boolean}
 */
export function hasAutoActivateContext(editor, pos) {
	const syntax = detectSyntax(editor, pos);
	return syntax && (!autoActivationContext[syntax] || autoActivationContext[syntax](editor, pos));
}
