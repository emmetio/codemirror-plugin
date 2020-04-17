import CodeMirror from 'codemirror';
import getEmmetConfig, { defaultConfig, EmmetConfig } from './lib/config';
import abbreviationTracker from './abbreviation';
import matchTags from './lib/match-tags';
import markupMode from './mode/markup';
import stylesheetMode from './mode/stylesheet';
import snippetMode from './mode/snippet';

import expandAbbreviation from './commands/expand-abbreviation';
import emmetResetAbbreviation from './commands/reset-abbreviation'
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

type DisposeFn = () => void;

interface EmmetState {
    tracker?: DisposeFn | null;
    tagMatch?: DisposeFn | null;
}

const stateKey = '$$emmet';

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
        if (!editor[stateKey]) {
            editor[stateKey] = {};
        }

        const state = editor[stateKey] as EmmetState;
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
}

export { EmmetConfig };
