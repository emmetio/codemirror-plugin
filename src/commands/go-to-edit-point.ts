import { getContent, isQuote, isSpace, getCaret } from '../lib/utils';

export default function goToEditPoint(editor: CodeMirror.Editor, inc: number) {
    const caret = getCaret(editor);
    const pos = findNewEditPoint(editor, caret + inc, inc);
    if (pos != null) {
        editor.setCursor(editor.posFromIndex(pos));
    }
}

function findNewEditPoint(editor: CodeMirror.Editor, pos: number, inc: number): number | undefined {
    const doc = getContent(editor);
    const docSize = doc.length;
    let curPos = pos;

    while (curPos < docSize && curPos >= 0) {
        curPos += inc;
        const cur = doc[curPos];
        const next = doc[curPos + 1];
        const prev = doc[curPos - 1];

        if (isQuote(cur) && next === cur && prev === '=') {
            // Empty attribute value
            return curPos + 1;
        }

        if (cur === '<' && prev === '>') {
            // Between tags
            return curPos;
        }

        if (isNewLine(cur)) {
            const pt = editor.posFromIndex(curPos);
            const line = editor.getLine(pt.line);
            if (!line || isSpace(line)) {
                // Empty line
                return editor.indexFromPos({
                    line: pt.line,
                    ch: line.length
                });
            }
        }
    }
}

function isNewLine(ch: string) {
    return ch === '\r' || ch === '\n';
}
