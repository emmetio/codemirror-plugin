import { SyntaxType } from 'emmet';
import { EnableForSyntax } from './config';

const markupSyntaxes = ['html', 'xml', 'xsl', 'jsx', 'haml', 'jade', 'pug', 'slim'];
const stylesheetSyntaxes = ['css', 'scss', 'sass', 'less', 'sss', 'stylus', 'postcss'];
const xmlSyntaxes = ['xml', 'xsl', 'jsx'];
const htmlSyntaxes = ['html', 'htmlmixed', 'vue'];
const cssSyntaxes = ['css', 'scss', 'less'];
const jsxSyntaxes = ['jsx', 'tsx'];

export interface SyntaxInfo {
    type: SyntaxType;
    syntax?: string;
    inline?: boolean;
}

export interface StylesheetRegion {
    range: [number, number];
    syntax: string;
    inline?: boolean;
}

export interface SyntaxCache {
    stylesheetRegions?: StylesheetRegion[];
}

/**
 * Returns Emmet syntax info for given location in view.
 * Syntax info is an abbreviation type (either 'markup' or 'stylesheet') and syntax
 * name, which is used to apply syntax-specific options for output.
 *
 * By default, if given location doesn’t match any known context, this method
 * returns `null`, but if `fallback` argument is provided, it returns data for
 * given fallback syntax
 */
export function syntaxInfo(editor: CodeMirror.Editor, pos: number): SyntaxInfo {
    const syntax = syntaxFromPos(editor, pos) || 'html';

    return {
        type: getSyntaxType(syntax),
        syntax,
        // TODO handle inline
        inline: false
    };
}

/**
 * Returns syntax for given position in editor
 */
export function syntaxFromPos(editor: CodeMirror.Editor, pos: number): string | undefined {
    const p = editor.posFromIndex(pos);
    const mode = editor.getModeAt(p);
    if (mode && mode.name === 'xml') {
        // XML mode is used for styling HTML as well
        return mode.configuration || mode.name;
    }
    return mode && mode.name;
}

/**
 * Returns main editor syntax
 */
export function docSyntax(editor: CodeMirror.Editor): string {
    const mode = editor.getMode();
    if (mode) {
        return mode.name === 'htmlmixed' ? 'html' : (mode.name || '');
    }
    return '';
}

/**
 * Returns Emmet abbreviation type for given syntax
 */
export function getSyntaxType(syntax?: string): SyntaxType {
    return syntax && stylesheetSyntaxes.includes(syntax) ? 'stylesheet' : 'markup';
}

/**
 * Check if given syntax is XML dialect
 */
export function isXML(syntax?: string): boolean {
    return syntax ? xmlSyntaxes.includes(syntax) : false;
}

/**
 * Check if given syntax is HTML dialect (including XML)
 */
export function isHTML(syntax?: string): boolean {
    return syntax
        ? htmlSyntaxes.includes(syntax) || isXML(syntax)
        : false;
}

/**
 * Check if given syntax name is supported by Emmet
 */
export function isSupported(syntax: string): boolean {
    return syntax
        ? markupSyntaxes.includes(syntax) || stylesheetSyntaxes.includes(syntax)
        : false;
}

/**
 * Check if given syntax is a CSS dialect. Note that it’s not the same as stylesheet
 * syntax: for example, SASS is a stylesheet but not CSS dialect (but SCSS is)
 */
export function isCSS(syntax?: string): boolean {
    return syntax ? cssSyntaxes.includes(syntax) : false;
}

/**
 * Check if given syntax is JSX dialect
 */
export function isJSX(syntax?: string): boolean {
    return syntax ? jsxSyntaxes.includes(syntax) : false;
}

/**
 * Check if given option if enabled for specified syntax
 */
export function enabledForSyntax(opt: EnableForSyntax, info: SyntaxInfo) {
    if (opt === true) {
        return true;
    }

    if (Array.isArray(opt)) {
        const candidates: string[] = [info.type, info.syntax!];
        if (info.inline) {
            candidates.push(`${info.type}-inline`, `${info.syntax!}-inline`);
        }

        return candidates.some(c => opt.includes(c));
    }

    return false;
}
