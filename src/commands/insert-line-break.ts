import { pass } from '../lib/utils';
import { getIndentation, lineIndent } from '../lib/output';

interface Sel {
    anchor: CodeMirror.Position;
    head: CodeMirror.Position;
}

export default function insertLineBreak(editor: CodeMirror.Editor) {
    const between = editor.listSelections().map(sel => betweenTags(editor, sel.anchor, sel.head));

    if (!between.some(Boolean)) {
        return pass(editor);
    }

    editor.operation(() => {
        const sels = editor.listSelections();
        // @ts-ignore Invalid docs for Document
        const nl = editor.getDoc().lineSeparator();
        const indent = getIndentation(editor);

        // Step 1: insert newlines either single or double depending on selection
        const nextSels: Sel[] = [];
        for (let i = sels.length - 1; i >= 0; i--) {
            const sel = sels[i];
            const base = lineIndent(editor, sel.anchor.line);
            let nextIndent = base;
            if (between[i]) {
                nextIndent += indent;
                editor.replaceRange( nl + nextIndent + nl + base, sel.anchor, sel.head);
            } else {
                editor.replaceRange(nl + base, sel.anchor, sel.head);
            }

            const nextPos: CodeMirror.Position = {
                line: sel.anchor.line + 1,
                ch: nextIndent.length
            };
            nextSels.unshift({ anchor: nextPos, head: nextPos });
        }

        editor.setSelections(nextSels);
    });
}

/**
 * Check if given range is a single caret between tags
 */
function betweenTags(editor: CodeMirror.Editor, anchor: CodeMirror.Position, head: CodeMirror.Position) {
    if (equalCursorPos(anchor, head)) {
        const mode = editor.getModeAt(anchor);

        if (mode.name === 'xml') {
            const left = editor.getTokenAt(anchor);
            const right = editor.getTokenAt(Object.assign({}, anchor, { ch: anchor.ch + 1 }));

            return left.type === 'tag bracket' && left.string === '>'
                && right.type === 'tag bracket' && right.string === '</';
        }
    }
}

// Compare two positions, return 0 if they are the same, a negative
// number when a is less, and a positive number otherwise.
function cmp(a: CodeMirror.Position, b: CodeMirror.Position) {
    return a.line - b.line || a.ch - b.ch;
}

function equalCursorPos(a: CodeMirror.Position, b: CodeMirror.Position) {
    return a.sticky === b.sticky && cmp(a, b) === 0;
}
