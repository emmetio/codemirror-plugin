import { UserConfig } from 'emmet';
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
            runExpand(editor, tracker.abbreviation.abbr, tracker.range[0], tracker.options);
            stopTracking(editor, true);
        } else {
            return pass(editor);
        }
    }

    const pos = editor.posFromIndex(caret);
    const line = editor.getLine(pos.line);
    const syntax = syntaxFromPos(editor, caret);
    const abbr = extract(line, pos.ch, syntax);

    if (abbr) {
        const abbrStart = caret - (pos.ch - abbr.start);
        let options: UserConfig | undefined;
        if (isCSS(syntax) || isHTML(syntax)) {
            options = getAbbreviationContext(editor, caret);
            if (!options) {
                return tabKey ? pass(editor) : null;
            }
        } else {
            options = getOptions(editor, abbrStart);
        }

        runExpand(editor, abbr.abbreviation, abbrStart, options);
    }
}

function runExpand(editor: CodeMirror.Editor, abbr: string, pos: number, options?: UserConfig) {
    const snippet = expand(editor, abbr, options);
    replaceWithSnippet(editor, [pos, pos + abbr.length], snippet);
}
