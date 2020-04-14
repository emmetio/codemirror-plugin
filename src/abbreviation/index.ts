import { UserConfig } from 'emmet';
import getEmmetConfig from '../lib/config';
import { isSupported, isJSX, syntaxFromPos, isCSS, isHTML, docSyntax } from '../lib/syntax';
import { getCaret, substr } from '../lib/utils';
import { JSX_PREFIX } from '../lib/emmet';
import getAbbreviationContext from '../lib/context';
import AbbreviationTracker, { handleChange, handleSelectionChange, stopTracking, startTracking } from './AbbreviationTracker';

const reJSXAbbrStart = /^[a-zA-Z.#\[\(]$/;
const reWordBound = /^[\s>;"\']?[a-zA-Z.#!@\[\(]$/;
const pairs = {
    '{': '}',
    '[': ']',
    '(': ')'
};

export default function initAbbreviationTracker(editor: CodeMirror.Editor) {
    let lastPos: number | null = null;

    const onChange = (ed: CodeMirror.Editor) => {
        const pos = getCaret(ed);
        let tracker = handleChange(ed);

        if (!tracker && lastPos !== null && lastPos === pos - 1 && allowTracking(ed, pos)) {
            tracker = startAbbreviationTracking(ed, pos);
        }

        if (tracker && shouldStopTracking(tracker, pos)) {
            stopTracking(ed);
        }

        lastPos = pos;
    };
    const onSelectionChange = (ed: CodeMirror.Editor) => {
        if (!isEnabled(ed)) {
            return;
        }

        const caret = getCaret(ed);
        const tracker = handleSelectionChange(ed, caret);
        if (tracker) {
            if (tracker.abbreviation && tracker.contains(caret)) {
                tracker.showPreview(ed);
            } else {
                tracker.hidePreview();
            }
        }

        lastPos = caret;
    };

    editor.on('change', onChange);
    editor.on('focus', onSelectionChange);
    editor.on('cursorActivity', onSelectionChange);

    return () => {
        editor.off('change', onChange);
        editor.off('focus', onSelectionChange);
        editor.off('cursorActivity', onSelectionChange);
    };
}

/**
 * Check if abbreviation tracking is allowed in editor at given location
 */
function allowTracking(editor: CodeMirror.Editor, pos: number): boolean {
    if (isEnabled(editor)) {
        const syntax = syntaxFromPos(editor, pos);
        return syntax ? isSupported(syntax) || isJSX(syntax) : false;
    }

    return false;
}

/**
 * Check if Emmet auto-complete is enabled
 */
function isEnabled(editor: CodeMirror.Editor): boolean {
    return getEmmetConfig(editor).mark;
}

/**
 * Check if we can start abbreviation tracking at given location in editor
 */
function startAbbreviationTracking(editor: CodeMirror.Editor, pos: number): AbbreviationTracker | undefined {
    // Start tracking only if user starts abbreviation typing: entered first
    // character at the word bound
    // NB: get last 2 characters: first should be a word bound(or empty),
    // second must be abbreviation start
    const prefix = substr(editor, [Math.max(0, pos - 2), pos]);
    const syntax = docSyntax(editor);
    let start = -1
    let end = pos;
    let offset = 0;

    if (isJSX(syntax)) {
        // In JSX, abbreviations should be prefixed
        if (prefix.length === 2 && prefix[0] === JSX_PREFIX && reJSXAbbrStart.test(prefix[1])) {
            start = pos - 2;
            offset = JSX_PREFIX.length;
        }
    } else if (reWordBound.test(prefix)) {
        start = pos - 1;
    }

    if (start >= 0) {
        // Check if there’s paired character
        const lastCh = prefix[prefix.length - 1];
        if (lastCh in pairs && substr(editor, [pos, pos + 1]) === pairs[lastCh]) {
            end++;
        }

        let options: UserConfig | undefined;
        if (isCSS(syntax) || isHTML(syntax)) {
            options = getAbbreviationContext(editor, pos);

            if (!options) {
                // No valid context for known syntaxes
                return;
            }

            options.type = isCSS(options.syntax) ? 'stylesheet' : 'markup';
        }

        return startTracking(editor, start, end, { offset, options });
    }
}

/**
 * Check if we should stop tracking abbreviation in given editor
 */
function shouldStopTracking(tracker: AbbreviationTracker, pos: number): boolean {
    if (tracker.forced) {
        // Never reset forced abbreviation: it’s up to user how to handle it
        return false;
    }

    if (!tracker.abbreviation || /[\r\n]/.test(tracker.abbreviation.abbr)) {
        // — Stop tracking if abbreviation is empty
        // — Never allow new lines in auto - tracked abbreviation
        return true;
    }

    // Reset if user entered invalid character at the end of abbreviation
    // or at the edge of auto - inserted paried character like`)` or`]`
    if (tracker.abbreviation.type === 'error') {
        if (tracker.range[1] === pos) {
            // Last entered character is invalid
            return true;
        }

        const pairsEnd = Object.values(pairs);
        const { abbr } = tracker.abbreviation;
        const start = tracker.range[0];
        let targetPos = tracker.range[1];
        while (targetPos > start) {
            if (pairsEnd.includes(abbr[targetPos - start - 1])) {
                targetPos--;
            } else {
                break;
            }
        }

        return targetPos === pos;
    }

    return false;
}
