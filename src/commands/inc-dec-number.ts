import { isNumber } from '@emmetio/scanner';
import { textRange, rangeEmpty, substr, replaceWithSnippet } from '../lib/utils';

export default function incrementNumber(editor: CodeMirror.Editor, delta = 1) {
    editor.operation(() => {
        const nextRanges = editor.listSelections().slice().reverse().map(sel => {
            let selRange = textRange(editor, sel);
            if (rangeEmpty(selRange)) {
                // No selection, extract number
                const line = editor.getLine(sel.anchor.line);
                const offset = sel.anchor.ch;
                const numRange = extractNumber(line, offset);
                if (numRange) {
                    selRange = [
                        selRange[0] - offset + numRange[0],
                        selRange[0] - offset + numRange[1],
                    ]
                }
            }

            if (!rangeEmpty(selRange)) {
                // Try to update value in given region
                let value = updateNumber(substr(editor, selRange), delta);
                replaceWithSnippet(editor, selRange, value);
                sel = {
                    anchor: editor.posFromIndex(selRange[0]),
                    head: editor.posFromIndex(selRange[0] + value.length)
                };
            }

            return sel;
        });

        editor.setSelections(nextRanges);
    });
}

/**
 * Extracts number from text at given location
 */
function extractNumber(text: string, pos: number): [number, number] | undefined {
    let hasDot = false;
    let end = pos;
    let start = pos;
    let ch: number;
    const len = text.length;

    // Read ahead for possible numbers
    while (end < len) {
        ch = text.charCodeAt(end);
        if (isDot(ch)) {
            if (hasDot) {
                break;
            }
            hasDot = true;
        } else if (!isNumber(ch)) {
            break;
        }
        end++;
    }

    // Read backward for possible numerics
    while (start >= 0) {
        ch = text.charCodeAt(start - 1);
        if (isDot(ch)) {
            if (hasDot) {
                break;
            }
            hasDot = true;
        } else if (!isNumber(ch)) {
            break;
        }
        start--;
    }

    // Negative number?
    if (start > 0 && text[start - 1] === '-') {
        start--;
    }

    if (start !== end) {
        return [start, end];
    }
}

function updateNumber(num: string, delta: number, precision = 3): string {
    const value = parseFloat(num) + delta;

    if (isNaN(value)) {
        return num;
    }

    const neg = value < 0;
    let result = Math.abs(value).toFixed(precision);

    // Trim trailing zeroes and optionally decimal number
    result = result.replace(/\.?0+$/, '');

    // Trim leading zero if input value doesn't have it
    if ((num[0] === '.' || num.startsWith('-.')) && result[0] === '0') {
        result = result.slice(1);
    }

    return (neg ? '-' : '') + result;
}

function isDot(ch: number) {
    return ch === 46;
}
