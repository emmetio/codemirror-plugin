import { UserConfig } from 'emmet';
import { TextRange } from '@emmetio/action-utils';
import { pass, getCaret, replaceWithSnippet } from '../lib/utils';
import getEmmetConfig from '../lib/config';
import { getTracker, stopTracking } from '../abbreviation/AbbreviationTracker';
import { expand, extract, getOptions } from '../lib/emmet';
import { syntaxFromPos, isCSS, isHTML } from '../lib/syntax';
import getAbbreviationContext from '../lib/context';

export default function expandAbbreviation(editor: CodeMirror.Editor, tabKey?: boolean) {
    if (editor.somethingSelected()) {
        return pass(editor);
    }

    const caret = getCaret(editor);

    // With Tab key, we should either expand tracked abbreviation
    // or extract abbreviation from current location if abbreviation marking
    // is not available
    if (tabKey && getEmmetConfig(editor).mark) {
        const tracker = getTracker(editor);

        if (tracker && tracker.contains(caret) && tracker.abbreviation?.type === 'abbreviation') {
            runExpand(editor, tracker.abbreviation.abbr, tracker.range, tracker.options);
            stopTracking(editor, true);
            return;
        }
        return pass(editor);
    }

    const pos = editor.posFromIndex(caret);
    const line = editor.getLine(pos.line);
    const syntax = syntaxFromPos(editor, caret);
    const abbr = extract(line, pos.ch, syntax);

    if (abbr) {
        const offset = caret - pos.ch;
        let options: UserConfig | undefined;
        if (isCSS(syntax) || isHTML(syntax)) {
            options = getAbbreviationContext(editor, caret);
            if (!options) {
                return tabKey ? pass(editor) : null;
            }
        } else {
            options = getOptions(editor, offset + abbr.start);
        }

        runExpand(editor, abbr.abbreviation, [abbr.start + offset, abbr.end + offset], options);
    }
}

function runExpand(editor: CodeMirror.Editor, abbr: string, range: TextRange, options?: UserConfig) {
    const snippet = expand(editor, abbr, options);
    replaceWithSnippet(editor, range, snippet);
}
