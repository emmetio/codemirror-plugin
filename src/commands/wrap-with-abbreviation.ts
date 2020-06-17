import { TextRange } from '@emmetio/action-utils';
import { getOptions, getTagContext, ContextTag, expand } from '../lib/emmet';
import { getCaret, narrowToNonSpace, replaceWithSnippet, substr, errorSnippet, textRange } from '../lib/utils';
import { docSyntax, isXML } from '../lib/syntax';
import { lineIndent } from '../lib/output';

const baseClass = 'emmet-panel';
const errClass = 'emmet-error';

export default function wrapWithAbbreviation(editor: CodeMirror.Editor) {
    const syntax = docSyntax(editor);
    const caret = getCaret(editor);
    const context = getTagContext(editor, caret, isXML(syntax));
    const wrapRange = getWrapRange(editor, getSelection(editor), context);
    const options = getOptions(editor, wrapRange[0]);
    options.text = getContent(editor, wrapRange, true);

    let panel = createInputPanel();
    let input = panel.querySelector('input')!;
    let errContainer = panel.querySelector(`.${baseClass}-error`)!;
    let updated = false;

    function onInput(evt: InputEvent) {
        evt && evt.stopPropagation();
        undo();
        const abbr = input.value.trim();
        if (!abbr) {
            return;
        }

        try {
            const snippet = expand(editor, abbr, options);
            replaceWithSnippet(editor, wrapRange, snippet);
            updated = true;
            if (panel.classList.contains(errClass)) {
                errContainer.innerHTML = '';
                panel.classList.remove(errClass);
            }
        } catch (err) {
            updated = false;
            panel.classList.add(errClass);
            errContainer.innerHTML = errorSnippet(err);
            console.error(err);
        }
    };

    function onKeyDown(evt: KeyboardEvent) {
        if (evt.keyCode === 27 /* ESC */) {
            evt.stopPropagation();
            evt.preventDefault();
            cancel();
        } else if (evt.keyCode === 13 /* Enter */) {
            evt.stopPropagation();
            evt.preventDefault();
            submit();
        }
    };

    function undo() {
        if (updated) {
            editor.undo();
        }
    }

    function cancel() {
        undo();
        dispose();
        editor.focus();
    }

    function submit() {
        // Changes should already be applied to editor
        dispose();
        editor.focus();
    }

    function dispose() {
        input.removeEventListener('input', onInput);
        input.removeEventListener('change', onInput);
        input.removeEventListener('paste', onInput);
        input.removeEventListener('keydown', onKeyDown);
        input.removeEventListener('blur', cancel);
        panel.remove();
        // @ts-ignore Dispose element references
        panel = input = errContainer = null;
    }

    // Expose internals to programmatically submit or cancel command
    panel['emmet'] = { submit, cancel, update: onInput };

    input.addEventListener('input', onInput);
    input.addEventListener('change', onInput);
    input.addEventListener('paste', onInput);
    input.addEventListener('keydown', onKeyDown);
    editor.getWrapperElement().appendChild(panel);
    input.focus();
}

function createInputPanel(): HTMLElement {
    const elem = document.createElement('div');
    elem.className = baseClass;
    elem.innerHTML = `<div class="${baseClass}-wrapper">
        <input type="text" placeholder="Enter abbreviation" autofocus />
        <div class="${baseClass}-error"></div>
    </div>`;
    return elem;
}

function getWrapRange(editor: CodeMirror.Editor, range: TextRange, context?: ContextTag): TextRange {
    if (range[0] === range[1] && context) {
        // No selection means user wants to wrap current tag container
        const { open, close } = context;
        const pos = range[0];

        // Check how given point relates to matched tag:
        // if it's in either open or close tag, we should wrap tag itself,
        // otherwise we should wrap its contents

        if (inRange(open, pos) || (close && inRange(close, pos))) {
            return [open[0], close ? close[1] : open[1]];
        }

        if (close) {
            return narrowToNonSpace(editor, [open[1], close[0]]);
        }
    }

    return range;
}

/**
 * Returns contents of given region, properly de-indented
 */
function getContent(editor: CodeMirror.Editor, range: TextRange, lines = false): string | string[] {
    const pos = editor.posFromIndex(range[0]);
    const baseIndent = lineIndent(editor, pos.line);
    const srcLines = substr(editor, range).split('\n');
    const destLines = srcLines.map(line => {
        return line.startsWith(baseIndent)
            ? line.slice(baseIndent.length)
            : line;
    });

    return lines ? destLines : destLines.join('\n');
}

function inRange(range: TextRange, pt: number): boolean {
    return range[0] < pt && pt < range[1];
}

function getSelection(editor: CodeMirror.Editor): TextRange {
    return textRange(editor, editor.listSelections()[0]);
}
