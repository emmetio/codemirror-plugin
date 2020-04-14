import { TextRange } from '@emmetio/action-utils';
import { isCSS, isHTML, docSyntax } from '../lib/syntax';
import { getContent, toRange, textRange, rangesEqual, rangeContains } from '../lib/utils';
import { selectItem } from '../lib/emmet';

export default function selectItemCommand(editor: CodeMirror.Editor, isPrev = false) {
    const syntax = docSyntax(editor);

    if (!isCSS(syntax) && !isHTML(syntax)) {
        return;
    }

    const sel = editor.listSelections()[0];
    const selRange = textRange(editor, sel);
    const code = getContent(editor);
    let model = selectItem(code, selRange[0], isCSS(syntax), isPrev);

    if (model) {
        let range = findRange(selRange, model.ranges, isPrev);
        if (!range) {
            // Out of available selection range, move to next item
            const nextPos = isPrev ? model.start : model.end;
            model = selectItem(code, nextPos, isCSS(syntax), isPrev);
            if (model) {
                range = findRange(selRange, model.ranges, isPrev)
            }
        }

        if (range) {
            const [from, to] = toRange(editor, range);
            editor.setSelection(from, to);
        }
    }
}

function findRange(sel: TextRange, ranges: TextRange[], reverse = false) {
    if (reverse) {
        ranges = ranges.slice().reverse();
    }

    let getNext = false;
    let candidate: TextRange | undefined;

    for (const r of ranges) {
        if (getNext) {
            return r;
        }
        if (  rangesEqual(r, sel)) {
            // This range is currently selected, request next
            getNext = true;
        } else if (!candidate && (rangeContains(r, sel) || (reverse && r[0] <= sel[0]) || (!reverse && r[0] >= sel[0]))) {
            candidate = r;
        }
    }

    if (!getNext) {
        return candidate;
    }
}
