import { UserConfig, CSSAbbreviationScope } from 'emmet';
import { TokenType } from '@emmetio/css-matcher';
import { getHTMLContext, getCSSContext, CSSContext } from '@emmetio/action-utils';
import AbbreviationTracker, { handleChange, handleSelectionChange, stopTracking, startTracking } from './AbbreviationTracker';
import getEmmetConfig from '../lib/config';
import { isSupported, isJSX, syntaxFromPos, isCSS, isHTML, docSyntax, syntaxInfo, enabledForSyntax, isXML, getEmbeddedStyleSyntax, getMarkupAbbreviationContext, getStylesheetAbbreviationContext, getSyntaxType } from '../lib/syntax';
import { getCaret, substr, getContent, pairs } from '../lib/utils';
import { JSX_PREFIX, extract } from '../lib/emmet';
import getOutputOptions from '../lib/output';

const reJSXAbbrStart = /^[a-zA-Z.#\[\(]$/;
const reWordBound = /^[\s>;"\']?[a-zA-Z.#!@\[\(]$/;
const reStylesheetWordBound = /^[\s;"\']?[a-zA-Z!@]$/;

export default function initAbbreviationTracker(editor: CodeMirror.Editor) {
    let lastPos: number | null = null;

    const onChange = (ed: CodeMirror.Editor) => {
        const pos = getCaret(ed);
        let tracker = handleChange(ed, pos);

        if (!tracker && lastPos !== null && lastPos === pos - 1 && allowTracking(ed, pos)) {
            tracker = startAbbreviationTracking(ed, pos);
        }

        lastPos = pos;
    };
    const onSelectionChange = (ed: CodeMirror.Editor) => {
        const caret = getCaret(ed);
        if (!isEnabled(ed, caret)) {
            return;
        }

        const tracker = handleSelectionChange(ed, caret);
        if (tracker) {
            if (tracker.abbreviation && tracker.contains(caret)) {
                tracker.showPreview(ed);
            } else {
                tracker.hidePreview();
            }
        }

        lastPos = caret;
    };

    editor.on('change', onChange);
    editor.on('focus', onSelectionChange);
    editor.on('cursorActivity', onSelectionChange);

    return () => {
        editor.off('change', onChange);
        editor.off('focus', onSelectionChange);
        editor.off('cursorActivity', onSelectionChange);
    };
}

/**
 * If allowed, tries to extract abbreviation from given completion context
 */
export function extractTracker(editor: CodeMirror.Editor, pos: number): AbbreviationTracker | undefined {
    const syntax = docSyntax(editor);
    const prefix = isJSX(syntax) ? JSX_PREFIX : '';
    const options = getActivationContext(editor, pos);
    const abbr = extract(getContent(editor), pos, getSyntaxType(options?.syntax), { prefix });
    if (abbr) {
        return startTracking(editor, abbr.start, abbr.end, {
            offset: prefix.length,
            options
        });
    }
}

/**
 * Check if abbreviation tracking is allowed in editor at given location
 */
function allowTracking(editor: CodeMirror.Editor, pos: number): boolean {
    if (isEnabled(editor, pos)) {
        const syntax = syntaxFromPos(editor, pos);
        return syntax ? isSupported(syntax) || isJSX(syntax) : false;
    }

    return false;
}

/**
 * Check if Emmet auto-complete is enabled
 */
function isEnabled(editor: CodeMirror.Editor, pos: number): boolean {
    const config = getEmmetConfig(editor);
    return enabledForSyntax(config.mark, syntaxInfo(editor, pos));
}

/**
 * Check if we can start abbreviation tracking at given location in editor
 */
function startAbbreviationTracking(editor: CodeMirror.Editor, pos: number): AbbreviationTracker | undefined {
    // Start tracking only if user starts abbreviation typing: entered first
    // character at the word bound
    // NB: get last 2 characters: first should be a word bound(or empty),
    // second must be abbreviation start
    const prefix = substr(editor, [Math.max(0, pos - 2), pos]);
    const syntax = docSyntax(editor);
    let start = -1
    let end = pos;
    let offset = 0;

    if (isJSX(syntax)) {
        // In JSX, abbreviations should be prefixed
        if (prefix.length === 2 && prefix[0] === JSX_PREFIX && reJSXAbbrStart.test(prefix[1])) {
            start = pos - 2;
            offset = JSX_PREFIX.length;
        }
    } else if (reWordBound.test(prefix)) {
        start = pos - 1;
    }

    if (start >= 0) {
        // Check if there’s paired character
        const lastCh = prefix[prefix.length - 1];
        if (lastCh in pairs && substr(editor, [pos, pos + 1]) === pairs[lastCh]) {
            end++;
        }

        const options = getActivationContext(editor, pos);
        if (options) {
            if (options.type === 'stylesheet' && !reStylesheetWordBound.test(prefix)) {
                // Additional check for stylesheet abbreviation start: it’s slightly
                // differs from markup prefix, but we need activation context
                // to ensure that context under caret is CSS
                return;
            }

            const tracker = startTracking(editor, start, end, { offset, options });
            if (tracker.abbreviation?.type === 'abbreviation' && options.context?.name === CSSAbbreviationScope.Section) {
                // Make a silly check for section context: if user start typing
                // CSS selector at the end of file, it will be treated as property
                // name and provide unrelated completion by default.
                // We should check if captured abbreviation actually matched
                // snippet to continue. Otherwise, ignore this abbreviation.
                // By default, unresolved abbreviations are converted to CSS properties,
                // e.g. `a` → `a: ;`. If that’s the case, stop tracking
                const { abbr, preview } = tracker.abbreviation;
                if (preview.startsWith(abbr) && /^:\s*;?$/.test(preview.slice(abbr.length))) {
                    stopTracking(editor);
                    return;
                }
            }

            return tracker;
        }
    }
}

/**
 * Detects and returns valid abbreviation activation context for given location
 * in editor which can be used for abbreviation expanding.
 * For example, in given HTML code:
 * `<div title="Sample" style="">Hello world</div>`
 * it’s not allowed to expand abbreviations inside `<div ...>` or `</div>`,
 * yet it’s allowed inside `style` attribute and between tags.
 *
 * This method ensures that given `pos` is inside location allowed for expanding
 * abbreviations and returns context data about it
 */
export function getActivationContext(editor: CodeMirror.Editor, pos: number): UserConfig | undefined {
    const syntax = docSyntax(editor);

    if (isCSS(syntax)) {
        return getCSSActivationContext(editor, pos, syntax, getCSSContext(getContent(editor), pos));
    }

    if (isHTML(syntax)) {
        const content = getContent(editor);
        const ctx = getHTMLContext(content, pos, { xml: isXML(syntax) });

        if (ctx.css) {
            return getCSSActivationContext(editor, pos, getEmbeddedStyleSyntax(content, ctx) || 'css', ctx.css);
        }

        if (!ctx.current) {
            return {
                syntax,
                type: 'markup',
                context: getMarkupAbbreviationContext(content, ctx),
                options: getOutputOptions(editor, pos)
            };
        }
    } else {
        return { syntax, type: 'markup' };
    }
}

function getCSSActivationContext(editor: CodeMirror.Editor, pos: number, syntax: string, ctx: CSSContext): UserConfig | undefined {
    // CSS abbreviations can be activated only when a character is entered, e.g.
    // it should be either property name or value.
    // In come cases, a first character of selector should also be considered
    // as activation context
    if (!ctx.current) {
        return void 0;
    }

    const allowedContext = ctx.current.type === TokenType.PropertyName
        || ctx.current.type === TokenType.PropertyValue
        || isTypingBeforeSelector(editor, pos, ctx);

    if (allowedContext) {
        return {
            syntax,
            type: 'stylesheet',
            context: getStylesheetAbbreviationContext(ctx),
            options: getOutputOptions(editor, pos, ctx.inline)
        };
    }
}

/**
 * Handle edge case: start typing abbreviation before selector. In this case,
 * entered character becomes part of selector
 * Activate only if it’s a nested section and it’s a first character of selector
 */
function isTypingBeforeSelector(editor: CodeMirror.Editor, pos: number, { current }: CSSContext): boolean {
    if (current && current.type === TokenType.Selector && current.range[0] === pos - 1) {
        // Typing abbreviation before selector is tricky one:
        // ensure it’s on its own line
        const line = substr(editor, current.range).split(/[\n\r]/)[0];
        return line.trim().length === 1;
    }

    return false;
}
