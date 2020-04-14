import { TextRange } from '@emmetio/action-utils';
import { isCSS, isXML, docSyntax, isHTML } from '../lib/syntax';
import { balanceCSS, balance } from '../lib/emmet';
import { getContent, textRange, rangeContains, rangesEqual, pass } from '../lib/utils';

export default function balanceAction(editor: CodeMirror.Editor, inward?: boolean) {
    const syntax = docSyntax(editor);

    if (isHTML(syntax) || isCSS(syntax)) {
        const ranges = inward
            ? balanceActionInward(editor, syntax)
            : balanceActionOutward(editor, syntax);

        editor.setSelections(ranges.map(r => ({
            anchor: editor.posFromIndex(r[0]),
            head: editor.posFromIndex(r[1]),
        })));
    } else {
        return pass(editor);
    }
}

/**
 * Pushes given `range` into `ranges` list on if it’s not the same as last one
 */
function pushRange(ranges: TextRange[], range: TextRange) {
    const last = ranges[ranges.length - 1];
    if (!last || !rangesEqual(last, range)) {
        ranges.push(range);
    }
}

/**
 * Returns regions for balancing
 */
function getRanges(editor: CodeMirror.Editor, pos: number, syntax: string, inward?: boolean): TextRange[] {
    const content = getContent(editor);
    if (isCSS(syntax)) {
        return balanceCSS(content, pos, inward);
    }

    const result: TextRange[] = [];
    const tags = balance(content, pos, inward, isXML(syntax));

    for (const tag of tags) {
        if (tag.close) {
            // Inner range
            pushRange(result, [tag.open[1], tag.close[0]]);
            // Outer range
            pushRange(result, [tag.open[0], tag.close[1]]);
        } else {
            pushRange(result, [tag.open[0], tag.open[1]]);
        }
    }

    return result.sort((a, b) => {
        return inward ? a[0] - b[0] : b[0] - a[0];
    });
}

/**
 * Returns inward balanced ranges from current view's selection
 */
function balanceActionInward(editor: CodeMirror.Editor, syntax: string): TextRange[] {
    const result: TextRange[] = [];

    for (const sel of editor.listSelections()) {
        const selRange = textRange(editor, sel);
        const ranges = getRanges(editor, selRange[0], syntax, true);

        // Try to find range which equals to selection: we should pick leftmost
        let ix = ranges.findIndex(r => rangesEqual(selRange, r));
        let targetRange: TextRange | undefined;

        if (ix < ranges.length - 1) {
            targetRange = ranges[ix + 1];
        } else if (ix !== -1) {
            // No match found, pick closest region
            targetRange = ranges.find(r => rangeContains(r, selRange));
        }

        result.push(targetRange || selRange);
    }

    return result;
}

/**
 * Returns outward balanced ranges from current view's selection
 */
function balanceActionOutward(editor: CodeMirror.Editor, syntax: string): TextRange[] {
    const result: TextRange[] = [];
    for (const sel of editor.listSelections()) {
        const selRange = textRange(editor, sel);
        const ranges = getRanges(editor, selRange[0], syntax);
        const targetRange = ranges.find(r => rangeContains(r, selRange) && r[1] > selRange[1]);
        result.push(targetRange || selRange);
    }

    return result;
}

