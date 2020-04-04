import { AttributeToken } from '@emmetio/html-matcher';
import { CSSProperty, TextRange } from '@emmetio/action-utils';

/** Characters to indicate tab stop start and end in generated snippet */
export const tabStopStart = String.fromCodePoint(0xFFF0);
export const tabStopEnd = String.fromCodePoint(0xFFF1);

/**
 * Returns copy of region which starts and ends at non-space character
 */
export function narrowToNonSpace(editor: CodeMirror.Editor, range: TextRange): TextRange {
    const text = substr(editor, range);
    let startOffset = 0;
    let endOffset = text.length;

    while (startOffset < endOffset && isSpace(text[startOffset])) {
        startOffset++;
    }

    while (endOffset > startOffset && isSpace(text[endOffset - 1])) {
        endOffset--;
    }

    return [range[0] + startOffset, range[0] + endOffset];
}

/**
 * Replaces given range in editor with snippet contents
 */
export function replaceWithSnippet(editor: CodeMirror.Editor, range: TextRange, snippet: string): boolean {
    let fieldStartIx = snippet.indexOf(tabStopStart);
    let fieldEndIx = snippet.indexOf(tabStopEnd);
    let selFrom: number | undefined;
    let selTo: number | undefined;

    if (fieldStartIx !== -1 && fieldEndIx !== -1) {
        selFrom = range[0] + fieldStartIx;
        selTo = range[0] + fieldEndIx - tabStopStart.length;
        snippet = snippet.slice(0, fieldStartIx)
            + snippet.slice(fieldStartIx + tabStopStart.length, fieldEndIx)
            + snippet.slice(fieldEndIx + tabStopEnd.length);
    } else if (fieldStartIx !== -1) {
        selFrom = range[0] + fieldStartIx;
        snippet = snippet.slice(0, fieldStartIx)
            + snippet.slice(fieldStartIx + tabStopStart.length);
    }

    return editor.operation(() => {
        const [from, to] = toRange(editor, range);
        editor.replaceRange(snippet, from, to);

        // Position cursor
        if (selFrom != null) {
            const selFromPos = editor.posFromIndex(selFrom);
            const selToPos = selTo != null ? editor.posFromIndex(selTo) : void 0;
            if (selToPos) {
                editor.setSelection(selFromPos, selToPos);
            } else {
                editor.setCursor(selFromPos);
            }
        }

        return true;
    });
}

/**
 * Returns current caret position for single selection
 */
export function getCaret(editor: CodeMirror.Editor): number {
    const pos = editor.getCursor();
    return editor.indexFromPos(pos);
}

/**
 * Returns full text content of given editor
 */
export function getContent(editor: CodeMirror.Editor): string {
    return editor.getValue();
}

/**
 * Returns substring of given editor content for specified range
 */
export function substr(editor: CodeMirror.Editor, range: TextRange): string {
    const [from, to] = toRange(editor, range);
    return editor.getRange(from, to);
}

/**
 * Converts given index range to editor’s position range
 */
export function toRange(editor: CodeMirror.Editor, range: TextRange): [CodeMirror.Position, CodeMirror.Position] {
    return [
        editor.posFromIndex(range[0]),
        editor.posFromIndex(range[1])
    ];
}

/**
 * Returns value of given attribute, parsed by Emmet HTML matcher
 */
export function attributeValue(attr: AttributeToken): string | undefined {
    const { value } = attr
    return value && isQuoted(value)
        ? value.slice(1, -1)
        : value;
}

/**
 * Returns region that covers entire attribute
 */
export function attributeRange(attr: AttributeToken): TextRange {
    const end = attr.value != null ? attr.valueEnd! : attr.nameEnd;
    return [attr.nameStart, end];
}

/**
 * Returns patched version of given HTML attribute, parsed by Emmet HTML matcher
 */
export function patchAttribute(attr: AttributeToken, value: string | number, name = attr.name) {
    let before = '';
    let after = '';

    if (attr.value != null) {
        if (isQuoted(attr.value)) {
            // Quoted value or React-like expression
            before = attr.value[0];
            after = attr.value[attr.value.length - 1];
        }
    } else {
        // Attribute without value (boolean)
        before = after = '"';
    }

    return `${name}=${before}${value}${after}`;
}

/**
 * Returns patched version of given CSS property, parsed by Emmet CSS matcher
 */
export function patchProperty(editor: CodeMirror.Editor, prop: CSSProperty, value: string, name?: string) {
    if (name == null) {
        name = substr(editor, prop.name);
    }

    const before = substr(editor, [prop.before, prop.name[0]]);
    const between = substr(editor, [prop.name[1], prop.value[0]]);
    const after = substr(editor, [prop.value[1], prop.after]);

    return [before, name, between, value, after].join('');
}

/**
 * Check if given value is either quoted or written as expression
 */
export function isQuoted(value: string | undefined): boolean {
    return !!value && (isQuotedString(value) || isExprString(value));
}

export function isQuote(ch: string | undefined) {
    return ch === '"' || ch === "'";
}

/**
 * Check if given string is quoted with single or double quotes
 */
export function isQuotedString(str: string): boolean {
    return str.length > 1 && isQuote(str[0]) && str[0] === str.slice(-1);
}

/**
 * Check if given string contains expression, e.g. wrapped with `{` and `}`
 */
function isExprString(str: string): boolean {
    return str[0] === '{' && str.slice(-1) === '}';
}

export function isSpace(ch: string): boolean {
    return /^[\s\n\r]+$/.test(ch);
}

export function htmlEscape(str: string): string {
    const replaceMap = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
    };
    return str.replace(/[<>&]/g, ch => replaceMap[ch]);
}

/**
 * Returns special object for bypassing command handling
 */
export function pass(editor: CodeMirror.Editor) {
    return editor.constructor['Pass'];
}
