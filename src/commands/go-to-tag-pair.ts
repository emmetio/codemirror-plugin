import { TextRange } from '@emmetio/action-utils';
import { getCaret, substr } from '../lib/utils';
import { isHTML, isXML, syntaxInfo } from '../lib/syntax';
import { getTagContext } from '../lib/emmet';

export default function goToTagPair(editor: CodeMirror.Editor) {
    let caret = getCaret(editor);
    const nextRange: TextRange = [caret, Math.min(caret + 1, editor.getValue().length)];
    if (substr(editor, nextRange) === '<') {
        caret++;
    }

    const { syntax } = syntaxInfo(editor, caret);
    if (isHTML(syntax)) {
        const ctx = getTagContext(editor, caret, isXML(syntax));
        if (ctx && ctx.open && ctx.close) {
            const { open, close } = ctx;
            const nextPos = open[0] <= caret && caret < open[1]
                ? close[0]
                : open[0];

            editor.setCursor(editor.posFromIndex(nextPos));
        }
    }
}
