import { UserConfig } from 'emmet';
import { parse as parseMarkup, tokenize as tokenizeMarkup, MarkupAbbreviation } from '@emmetio/abbreviation';
import { parser as parseStylesheet, tokenize as tokenizeStylesheet, CSSAbbreviation } from '@emmetio/css-abbreviation';
import CodeMirror from 'codemirror';
import getEmmetConfig, { defaultConfig, EmmetConfig, EmmetEditorOptions } from './lib/config';

import abbreviationTracker, { extractTracker, allowTracking, getCompletion, restoreOnUndo } from './abbreviation';

// import { extractTracker, allowTracking } from './abbreviation';
// import { startTracking } from './abbreviation/AbbreviationTracker';

import matchTags from './lib/match-tags';
import markupMode from './mode/markup';
import stylesheetMode from './mode/stylesheet';
import snippetMode from './mode/snippet';

import expandAbbreviation from './commands/expand-abbreviation';
import emmetResetAbbreviation from './commands/reset-abbreviation'
import emmetCaptureAbbreviation from './commands/capture-abbreviation'
import emmetEnterAbbreviationMode from './commands/enter-abbreviation';
import emmetInsertLineBreak from './commands/insert-line-break';
import emmetWrapWithAbbreviation from './commands/wrap-with-abbreviation';
import emmetBalance from './commands/balance';
import emmetToggleComment from './commands/comment';
import emmetEvaluateMath from './commands/evaluate-math';
import goToEditPoint from './commands/go-to-edit-point';
import emmetGoToTagPair from './commands/go-to-tag-pair';
import incrementNumber from './commands/inc-dec-number';
import emmetRemoveTag from './commands/remove-tag';
import selectItem from './commands/select-item';
import emmetSplitJoinTag from './commands/split-join-tag';
import { expand, getOptions } from './lib/emmet';
import { getInternalState, hasInternalState } from './lib/utils';

export interface EmmetEditor extends CodeMirror.Editor {
    /**
     * Expands given abbreviation with options, defined for current editor
     */
    expandAbbreviation(abbr: string, options?: UserConfig): string;
    /**
     * Returns Emmet config for given location in editor
     */
    emmetOptions(pos?: number, withContext?: boolean): UserConfig;

    /** Parses given abbreviation to AST or throws exception if abbreviation is invalid */
    parseAbbreviation(abbr: string, type: 'markup' | 'jsx'): MarkupAbbreviation;
    parseAbbreviation(abbr: string, type: 'stylesheet'): CSSAbbreviation;
    getEmmetCompletion(pos: number | CodeMirror.Position): CompletionItem;
}

interface CompletionItem {
    text: string;
    displayText: string;
    hint(): void;
    from: CodeMirror.Position;
    to: CodeMirror.Position;
}

/**
 * Registers Emmet extension on given CodeMirror constructor.
 * This file is designed to be imported somehow into the app (CommonJS, ES6,
 * Rollup/Webpack/whatever). If you simply want to add a <script> into your page
 * that registers Emmet extension on global CodeMirror constructor, use
 * `browser.js` instead
 */
export default function registerEmmetExtension(CM: typeof CodeMirror) {
    // Register Emmet commands
    Object.assign(CM.commands, {
        emmetExpandAbbreviation: (editor: CodeMirror.Editor) => expandAbbreviation(editor, true),
        emmetExpandAbbreviationAll: (editor: CodeMirror.Editor) => expandAbbreviation(editor, false),
        emmetCaptureAbbreviation,
        emmetResetAbbreviation,
        emmetEnterAbbreviationMode,
        emmetInsertLineBreak,
        emmetWrapWithAbbreviation,
        emmetBalance,
        emmetBalanceInward: (editor: CodeMirror.Editor) => emmetBalance(editor, true),
        emmetToggleComment,
        emmetEvaluateMath,
        emmetGoToNextEditPoint: (editor: CodeMirror.Editor) => goToEditPoint(editor, 1),
        emmetGoToPreviousEditPoint: (editor: CodeMirror.Editor) => goToEditPoint(editor, -1),
        emmetGoToTagPair,
        emmetIncrementNumber1: (editor: CodeMirror.Editor) => incrementNumber(editor, 1),
        emmetIncrementNumber01: (editor: CodeMirror.Editor) => incrementNumber(editor, .1),
        emmetIncrementNumber10: (editor: CodeMirror.Editor) => incrementNumber(editor, 10),
        emmetDecrementNumber1: (editor: CodeMirror.Editor) => incrementNumber(editor, -1),
        emmetDecrementNumber01: (editor: CodeMirror.Editor) => incrementNumber(editor, -.1),
        emmetDecrementNumber10: (editor: CodeMirror.Editor) => incrementNumber(editor, -10),
        emmetRemoveTag,
        emmetSelectNextItem: (editor: CodeMirror.Editor) => selectItem(editor),
        emmetSelectPreviousItem: (editor: CodeMirror.Editor) => selectItem(editor, true),
        emmetSplitJoinTag,
    });

    // Track options change
    CM.defineOption('emmet', defaultConfig, (editor: CodeMirror.Editor, value: EmmetConfig) => {
        if (!hasInternalState(editor)) {
            editor.on('change', undoTracker);
            editor.on('change', pasteTracker);
        }

        const state = getInternalState(editor);
        value = getEmmetConfig(editor, value);

        if (value.mark && !state.tracker) {
            state.tracker = abbreviationTracker(editor);
        } else if (!value.mark && state.tracker) {
            state.tracker();
            state.tracker = null;
        }

        if (value.markTagPairs && !state.tagMatch) {
            state.tagMatch = matchTags(editor);
        } else if (!value.markTagPairs && state.tagMatch) {
            state.tagMatch();
            state.tagMatch = null;
        }
    });

    CM.defineMode('emmet-abbreviation', markupMode);
    CM.defineMode('emmet-css-abbreviation', stylesheetMode);
    CM.defineMode('emmet-snippet', snippetMode);

    // Expose `expandAbbreviation` method to all instances to allow
    // programmatic usage based on current Emmet options
    CM.defineExtension('expandAbbreviation', function (this: CodeMirror.Editor, abbr: string, options = getOptions(this, 0)) {
        return expand(this, abbr, options);
    });

    CM.defineExtension('emmetOptions', function (this: CodeMirror.Editor, pos = 0) {
        return getOptions(this, pos);
    });

    CM.defineExtension('parseAbbreviation', function (this: CodeMirror.Editor, abbr: string, type: 'markup' | 'stylesheet' | 'jsx') {
        if (type === 'stylesheet') {
            return parseStylesheet(tokenizeStylesheet(abbr));
        } else {
            return parseMarkup(tokenizeMarkup(abbr), { jsx: type === 'jsx' });
        }
    });

    CM.defineExtension('getEmmetCompletion', function (this: CodeMirror.Editor, pos: number | CodeMirror.Position) {
        if (typeof pos !== 'number') {
            pos = this.indexFromPos(pos);
        }

        return getCompletion(this, pos);
    });
}

/**
 * Undo tracker, if possible
 */
function undoTracker(editor: CodeMirror.Editor, change: CodeMirror.EditorChangeLinkedList) {
    if (change.origin === 'undo' && change.text.length === 1) {
        const pos = editor.indexFromPos(change.from);
        const abbr = change.text[0];
        restoreOnUndo(editor, pos, abbr);
    }
}

/**
 * Capture abbreviation on paste, if possible
 */
function pasteTracker(editor: CodeMirror.Editor, change: CodeMirror.EditorChangeLinkedList) {
    if (change.origin === 'paste' && change.text.length === 1 && allowTracking(editor, editor.indexFromPos(change.from))) {
        // Try to capture abbreviation on paste
        const pos = editor.indexFromPos(change.from) + change.text[0].length;
        extractTracker(editor, pos, true);
    }
}

export { EmmetConfig, EmmetEditorOptions };
