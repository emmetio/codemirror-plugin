import { isXML, syntaxInfo } from '../lib/syntax';
import { getTagContext } from '../lib/emmet';
import { isSpace, substr, replaceWithSnippet, CMRange } from '../lib/utils';

export default function splitJoinTag(editor: CodeMirror.Editor) {
    const selections = editor.listSelections().slice().reverse();
    const nextRanges: CMRange[] = [];

    editor.operation(() => {
        for (const sel of selections) {
            const pos = editor.indexFromPos(sel.anchor);
            const { syntax } = syntaxInfo(editor, pos);
            const tag = getTagContext(editor, pos, isXML(syntax));

            if (tag) {
                const { open, close } = tag;
                if (close) {
                    // Join tag: remove tag contents, if any, and add closing slash
                    replaceWithSnippet(editor, [open[1], close[1]], '');
                    let closing = isSpace(getChar(editor, open[1] - 2)) ? '/' : ' /';
                    replaceWithSnippet(editor, [open[1] - 1, open[1] - 1], closing);
                    nextRanges.push(createRange(editor, open[1] + closing.length));
                } else {
                    // Split tag: add closing part and remove closing slash
                    const endTag = `</${tag.name}>`;

                    replaceWithSnippet(editor, [open[1], open[1]], endTag);
                    if (getChar(editor, open[1] - 2) === '/') {
                        let start = open[1] - 2;
                        let end = open[1] - 1;
                        if (isSpace(getChar(editor, start - 1))) {
                            start--;
                        }

                        replaceWithSnippet(editor, [start, end], '');
                        nextRanges.push(createRange(editor, open[1] - end + start));
                    } else {
                        nextRanges.push(createRange(editor, open[1]));
                    }
                }
            } else {
                nextRanges.push(sel);
            }
        }
        editor.setSelections(nextRanges);
    });
}

function getChar(editor: CodeMirror.Editor, pos: number): string {
    return substr(editor, [pos, pos + 1]);
}

function createRange(editor: CodeMirror.Editor, pos: number): CMRange {
    const p = editor.posFromIndex(pos);
    return {
        anchor: p,
        head: p
    };
}
