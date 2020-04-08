import { TextRange } from '@emmetio/action-utils';
import { getTagContext, ContextTag } from '../lib/emmet';
import { narrowToNonSpace, isSpace as isSpaceText, replaceWithSnippet, substr, rangeEmpty } from '../lib/utils';
import { lineIndent } from '../lib/output';

export default function removeTagCommand(editor: CodeMirror.Editor) {
    editor.operation(() => {
        const nextRanges = editor.listSelections().slice().reverse().map(sel => {
            const tag = getTagContext(editor, editor.indexFromPos(sel.anchor));
            if (tag) {
                removeTag(editor, tag);
                const pos = editor.posFromIndex(tag.open[0]);
                return {
                    anchor: pos,
                    head: pos
                };
            }

            return sel;
        });

        editor.setSelections(nextRanges);
    });
}

function removeTag(editor: CodeMirror.Editor, { open, close }: ContextTag) {
    if (close) {
        // Remove open and close tag and dedent inner content
        const innerRange = narrowToNonSpace(editor, [open[1], close[0]]);
        if (!rangeEmpty(innerRange)) {
            // Gracefully remove open and close tags and tweak indentation on tag contents
            replaceWithSnippet(editor, [innerRange[1], close[1]], '');

            const start = editor.posFromIndex(open[0]);
            const end = editor.posFromIndex(close[1]);
            if (start.line !== end.line) {
                // Skip two lines: first one for open tag, on second one
                // indentation will be removed with open tag
                let line = start.line + 2;
                const baseIndent = getLineIndent(editor, open[0]);
                const innerIndent = getLineIndent(editor, innerRange[0]);

                while (line <= end.line) {
                    const lineStart = editor.indexFromPos({ line, ch: 0 });
                    const indentRange: TextRange = [lineStart, lineStart + innerIndent.length];
                    if (isSpaceText(substr(editor, indentRange))) {
                        console.log('replace "%s" with "%s"', substr(editor, indentRange), baseIndent);
                        replaceWithSnippet(editor, indentRange, baseIndent);
                    }
                    line++;
                }
            }

            replaceWithSnippet(editor, [open[0], innerRange[0]], '');
        } else {
            replaceWithSnippet(editor, [open[0], close[1]], '');
        }
    } else {
        replaceWithSnippet(editor, open, '');
    }
}

/**
 * Returns indentation for line found from given character location
 */
function getLineIndent(editor: CodeMirror.Editor, ix: number): string {
    return lineIndent(editor, editor.posFromIndex(ix).line);
}

