import { UserConfig } from 'emmet';
import { TextRange } from '@emmetio/action-utils';
import { pass, getCaret, replaceWithSnippet, getInternalState } from '../lib/utils';
import getEmmetConfig from '../lib/config';
import AbbreviationTracker, { getTracker, stopTracking } from '../abbreviation/AbbreviationTracker';
import { expand, extract, getOptions } from '../lib/emmet';
import { getSyntaxType } from '../lib/syntax';
import { getActivationContext } from '../abbreviation';

export default function expandAbbreviation(editor: CodeMirror.Editor, tabKey?: boolean) {
    if (editor.somethingSelected()) {
        return pass(editor);
    }

    if (tabKey) {
        return expandAbbreviationWithTab(editor);
    }

    const caret = getCaret(editor);
    const pos = editor.posFromIndex(caret);
    const line = editor.getLine(pos.line);
    const options = getOptions(editor, caret);
    const abbr = extract(line, pos.ch, getSyntaxType(options.syntax));

    if (abbr) {
        const offset = caret - pos.ch;
        runExpand(editor, abbr.abbreviation, [abbr.start + offset, abbr.end + offset], options);
    }
}

function expandAbbreviationWithTab(editor: CodeMirror.Editor) {
    // With Tab key, we should either expand tracked abbreviation
    // or extract abbreviation from current location if abbreviation marking
    // is not available
    const caret = getCaret(editor);
    if (getEmmetConfig(editor).mark) {
        const tracker = getTracker(editor);

        if (tracker && tracker.contains(caret) && tracker.abbreviation?.type === 'abbreviation') {
            storeTracker(editor, tracker);
            runExpand(editor, tracker.abbreviation.abbr, tracker.range, tracker.options);
            stopTracking(editor, true);
            return;
        }
        return pass(editor);
    }

    const options = getActivationContext(editor, caret);
    if (options) {
        const pos = editor.posFromIndex(caret);
        const line = editor.getLine(pos.line);
        const abbr = extract(line, pos.ch, getSyntaxType(options.syntax));
        if (abbr) {
            const offset = caret - pos.ch;
            runExpand(editor, abbr.abbreviation, [abbr.start + offset, abbr.end + offset], options);
            return;
        }
    }

    return pass(editor);
}

function runExpand(editor: CodeMirror.Editor, abbr: string, range: TextRange, options?: UserConfig) {
    const snippet = expand(editor, abbr, options);
    replaceWithSnippet(editor, range, snippet);
}

/**
 * Stores tracker for further undo
 */
function storeTracker(editor: CodeMirror.Editor, tracker: AbbreviationTracker) {
    getInternalState(editor).lastTracker = tracker.serialize();
}
