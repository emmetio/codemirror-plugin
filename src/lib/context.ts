import { AbbreviationContext, Options } from 'emmet';
import { scan, createOptions, attributes, ElementType, AttributeToken, ScannerOptions } from '@emmetio/html-matcher';
import { scan as scanCSS, TokenType } from '@emmetio/css-matcher';
import { isQuote, isQuotedString, getContent } from './utils';
import { isCSS, isXML, isJSX, isHTML, syntaxFromPos } from './syntax';
import getOutputOptions from './output';

export interface ActivationContext extends SyntaxContext {
    options: Partial<Options>;
}

interface HTMLContextOptions {
    xml?: boolean;
    skipCSS?: boolean;
}

interface SyntaxContext {
    syntax: string;
    context?: AbbreviationContext;
    inline?: boolean;
}

interface Tag {
    name: string;
    start: number;
    end: number;
}

/**
 * Returns valid abbreviation context for given location in editor which can be
 * used for abbreviation expanding.
 * For example, in given HTML code:
 * `<div title="Sample" style="">Hello world</div>`
 * it’s not allowed to expand abbreviations inside `<div ...>` or `</div>`,
 * yet it’s allowed inside `style` attribute and between tags.
 *
 * This method ensures that given `pos` is inside location allowed for expanding
 * abbreviations and returns context data about it
 */
export default function getAbbreviationContext(editor: CodeMirror.Editor, pos: number): ActivationContext | undefined {
    const syntax = syntaxFromPos(editor, pos);

    if (syntax) {
        let context: SyntaxContext | undefined;
        if (isJSX(syntax)) {
            context = { syntax: 'jsx' }
        } else if (isCSS(syntax)) {
            context = getCSSContext(getContent(editor), pos);
        } else if (isHTML(syntax)) {
            context = getHTMLContext(getContent(editor), pos, {
                xml: isXML(syntax),
                skipCSS: isJSX(syntax)
            });
        }

        if (context) {
            return {
                ...context,
                options: getOutputOptions(editor, pos)
            };
        }
    }
}

/**
 * Returns HTML autocomplete activation context for given location in source code,
 * if available
 */
export function getHTMLContext(code: string, pos: number, opt: HTMLContextOptions = {}): SyntaxContext | undefined {
    // By default, we assume that caret is in proper location and if it’s not,
    // we’ll reset this value
    let result: SyntaxContext | null = { syntax: 'html' };

    // Since we expect large input document, we’ll use pooling technique
    // for storing tag data to reduce memory pressure and improve performance
    const pool: Tag[] = [];
    const stack: Tag[] = [];
    const options = createOptions({ xml: opt.xml, allTokens: true });
    let offset = 0;

    scan(code, (name, type, start, end) => {
        offset = start;

        if (start >= pos) {
            // Moved beyond location, stop parsing
            return false;
        }

        if (type === ElementType.Open && isSelfClose(name, options)) {
            // Found empty element in HTML mode, mark is as self-closing
            type = ElementType.SelfClose;
        }

        if (type === ElementType.Open) {
            // Allocate tag object from pool
            stack.push(allocTag(pool, name, start, end));
        } else if (type === ElementType.Close && stack.length && last(stack)!.name === name) {
            // Release tag object for further re-use
            releaseTag(pool, stack.pop()!);
        }

        if (end <= pos) {
            return;
        }

        if (type === ElementType.Open || type === ElementType.SelfClose) {
            // Inside opening or self-closed tag: completions prohibited by default
            // except in `style` attribute
            const tag = code.slice(start, end);
            if (!opt.skipCSS && tag.includes('style')) {
                for (const attr of attributes(tag, name)) {
                    if (attr.name === 'style' && attr.value != null) {
                        const [valueStart, valueEnd] = attributeValueRange(tag, attr, start);
                        if (pos >= valueStart && pos <= valueEnd) {
                            result!.syntax = 'css';
                            result!.inline = true;

                            const propName = inlineCSSContext(code.slice(valueStart, valueEnd), pos - valueStart);
                            if (propName) {
                                result!.context = { name: propName };
                            }

                            return false;
                        }
                    }
                }
            }
        }

        // If we reached here, `pos` is inside location where abbreviations
        // are not allowed
        result = null;
        return false;
    }, options);

    if (result && stack.length) {
        const lastTag = last(stack)!;

        if (!opt.skipCSS && lastTag.name === 'style' && pos >= lastTag.end) {
            // Location is inside <style> tag: we should detect if caret is in
            // proper stylesheet context, otherwise completions are prohibited
            const cssContext = getCSSContext(code.slice(lastTag.end, offset), pos - lastTag.end);
            if (!cssContext) {
                return;
            }
            result.syntax = getSyntaxForStyleTag(code, lastTag);
            if (cssContext.context) {
                result.context = cssContext.context;
            }

            return result;
        }

        if (!isCSS(result.syntax)) {
            result.context = createHTMLAbbreviationContext(code, lastTag);
        }
    }

    return result || void 0;
}

export function getCSSContext(code: string, pos: number): SyntaxContext | undefined {
    let section = 0;
    let valid = true;
    let name = '';

    scanCSS(code, (type, start, end) => {
        if (start >= pos) {
            // Moved beyond target location, stop parsing
            return false;
        }

        if (start <= pos && end >= pos) {
            // Direct hit into token: in this case, the only allowed tokens here
            // are property name and value
            valid = type === TokenType.PropertyValue || type === TokenType.PropertyName;
            return false;
        }

        switch (type) {
            case TokenType.Selector:
                section++; break;

            case TokenType.PropertyName:
                name = code.slice(start, end); break;

            case TokenType.PropertyValue:
                name = ''; break;

            case TokenType.BlockEnd:
                section--; name = ''; break;
        }
    });

    if (valid && (name || section)) {
        const result: SyntaxContext = { syntax: 'css' };
        if (name) {
            result.context = { name };
        }
        return result;
    }
}

function createHTMLAbbreviationContext(code: string, tag: Tag): AbbreviationContext {
    const attrs: { [name: string]: string } = {};
    for (const attr of attributes(code.slice(tag.start, tag.end), tag.name)) {
        let value = attr.value;
        if (value && isQuotedString(value)) {
            value = value.slice(1, -1);
        }
        attrs[attr.name] = value!;
    }

    return {
        name: tag.name,
        attributes: attrs
    };
}

/**
 * Returns context property name for inline CSS
 */
function inlineCSSContext(code: string, pos: number): string | undefined {
    let name = '';
    scanCSS(code, (type, start, end, delimiter) => {
        if (end >= pos) {
            return false;
        }

        name = type === TokenType.PropertyName
            ? code.slice(start, end)
            : '';
    });

    return name;
}

function attributeValueRange(tag: string, attr: AttributeToken, offset = 0): [number, number] {
    let valueStart = attr.valueStart!;
    let valueEnd = attr.valueEnd!;

    if (isQuote(tag[valueStart])) {
        valueStart++;
    }

    if (isQuote(tag[valueEnd - 1]) && valueEnd > valueStart) {
        valueEnd--;
    }

    return [offset + valueStart, offset + valueEnd];
}

function getSyntaxForStyleTag(code: string, tag: Tag): string {
    for (const attr of attributes(code.slice(tag.start, tag.end), tag.name)) {
        // In case if `type` attribute is provided, check its value
        // to override default syntax
        if (attr.name === 'type' && isCSS(attr.value)) {
            return attr.value!;
        }
    }

    return 'css';
}

/**
 * Check if given tag is self-close for current parsing context
 */
function isSelfClose(name: string, options: ScannerOptions) {
    return !options.xml && options.empty.includes(name);
}

function allocTag(pool: Tag[], name: string, start: number, end: number): Tag {
    if (pool.length) {
        const tag = pool.pop()!;
        tag.name = name;
        tag.start = start;
        tag.end = end;
        return tag;
    }
    return { name, start, end };
}

function releaseTag(pool: Tag[], tag: Tag) {
    pool.push(tag);
}

function last<T>(arr: T[]): T | undefined {
    return arr.length ? arr[arr.length - 1] : undefined;
}
