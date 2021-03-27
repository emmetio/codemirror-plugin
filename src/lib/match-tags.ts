import { attributes } from '@emmetio/html-matcher';
import { TagMatch, findTagMatch, getTagMatches } from '@emmetio/action-utils';
import { getCaret, rangesEqual, substr, isQuotedString } from './utils';
import getEmmetConfig from './config';

const openTagMark = 'emmet-open-tag';
const closeTagMark = 'emmet-close-tag';

interface CMTagMatch extends TagMatch {
    /** Open tag name preview */
    preview?: string;
}

interface CMMarkRange {
    from: CodeMirror.Position;
    to: CodeMirror.Position;
}

/**
 * Setup editor for tag matching
 */
export default function markTagMatches(editor: CodeMirror.Editor) {
    let tags: TagMatch[] | null = null;
    let lastMatch: TagMatch | null | undefined;
    let tagPreview: HTMLElement | null = null;

    /**
     * Displays tag preview as given location, if possible
     */
    function showTagPreview(ed: CodeMirror.Editor, pos: number, preview: string) {
        // Check if we already have preview at given location
        if (!tagPreview || tagPreview.dataset.pos !== String(pos)) {
            hidePreview();
            tagPreview = createPreviewWidget(ed, pos, preview);
        }
    }

    function hidePreview() {
        if (tagPreview) {
            tagPreview.remove();
            tagPreview = null;
        }
    }

    const onCursorActivity = (ed: CodeMirror.Editor) => {
        if (!tags) {
            tags = getTagMatches(ed.getValue());
        }

        const caret = getCaret(ed);
        let match = findTagMatch(tags!, caret) as CMTagMatch | undefined;
        if (match) {
            if (!match.preview) {
                match.preview = generatePreview(ed, match);
            }

            if (shouldDisplayTagPreview(ed, match, caret)) {
                showTagPreview(ed, match.close![1], match.preview);
            } else {
                hidePreview();
            }

            // Replace full tag match with name-only match
            const nLen = match.name.length;
            match = {
                ...match,
                open: [match.open[0] + 1, match.open[0] + 1 + nLen],
            };
            if (match.close) {
                match.close = [match.close[0] + 2, match.close[0] + 2 + nLen]
            }
        }

        if (match && (!lastMatch || !rangesEqual(lastMatch.open, match.open))) {
            clearTagMarks(ed);
            markTagMatch(ed, match);
        } else if (!match && lastMatch) {
            clearTagMarks(ed);
        }
        lastMatch = match;
    };

    const onChange = (editor: CodeMirror.Editor) => {
        tags = null;
        if (getEmmetConfig(editor).autoRenameTags) {
            const { open, close } = getTagMarks(editor);
            if (open && close) {
                const cursor = editor.getCursor();
                const openRange = open.find();
                const closeRange = close.find();

                let shouldReset = false;
                // Handle edge case when user deletes text fragment which invalidates
                // matched tags, e.g. in `<div>1</div>` remove `>1</div`.
                // In this case, a closing range becomes empty
                if (isEmptyRange(editor, openRange) || isEmptyRange(editor, closeRange)) {
                    shouldReset = true;
                } else if (isValidAutoRenameRanges(editor, openRange, closeRange)) {
                    if (containsPos(openRange, cursor)) {
                        // Update happened inside open tag, update close tag as well
                        shouldReset = updateTag(editor, openRange, closeRange);
                    } else if (containsPos(closeRange, cursor)) {
                        // Update happened inside close tag, update open tag as well
                        shouldReset = updateTag(editor, closeRange, openRange);
                    }
                }

                if (shouldReset) {
                    // Reset last match & marker to find and re-mark new location
                    clearTagMarks(editor);
                    lastMatch = null;
                }
            }
        }
    }

    editor.on('cursorActivity', onCursorActivity);
    editor.on('change', onChange);

    return () => {
        clearTagMarks(editor);
        hidePreview();
        editor.off('cursorActivity', onCursorActivity);
        editor.off('cursorActivity', onChange);
        tags = lastMatch = null;
    };
}

function shouldDisplayTagPreview(editor: CodeMirror.Editor, match: CMTagMatch, caret: number) {
    return match.close && match.preview && getEmmetConfig(editor).previewOpenTag
        && caret > match.close[0] && caret < match.close[1];
}

/**
 * Marks given tag match in editor
 */
function markTagMatch(editor: CodeMirror.Editor, { open, close, preview }: CMTagMatch) {
    createTagMark(editor, editor.posFromIndex(open[0]), editor.posFromIndex(open[1]), openTagMark);
    if (close) {
        createTagMark(editor, editor.posFromIndex(close[0]), editor.posFromIndex(close[1]), closeTagMark);
    }
}

/**
 * Removes any existing tag marks in editor
 */
function clearTagMarks(editor: CodeMirror.Editor) {
    const { open, close } = getTagMarks(editor);
    open && open.clear();
    close && close.clear();
}

/**
 * Returns open and close tag marks in editor, if available
 */
function getTagMarks(editor: CodeMirror.Editor) {
    let open: CodeMirror.TextMarker | undefined;
    let close: CodeMirror.TextMarker | undefined;
    editor.getAllMarks().forEach(mark => {
        if (mark['className'] === openTagMark) {
            open = mark;
        } else if (mark['className'] === closeTagMark) {
            close = mark;
        }
    });

    return { open, close };
}

function createTagMark(editor: CodeMirror.Editor, from: CodeMirror.Position, to: CodeMirror.Position, className: string, attributes?: {}) {
    return editor.markText(from, to, {
        className,
        inclusiveLeft: true,
        inclusiveRight: true,
        clearWhenEmpty: false,
        // @ts-ignore `attributes` key is supported
        attributes
    });
}

/**
 * Updates content of `dest` range with valid tag name from `source` range.
 * @returns `true` if tag markers must be updated
 */
function updateTag(editor: CodeMirror.Editor, source: CMMarkRange, dest: CMMarkRange): boolean {
    const name = editor.getRange(source.from, source.to);
    const m = name.match(/[\w:.-]+/);
    const newName = m ? m[0] : '';

    if (editor.getRange(dest.from, dest.to) !== newName) {
        editor.replaceRange(newName, dest.from, dest.to);
    }

    return name !== newName;
}

function createPreviewWidget(editor: CodeMirror.Editor, pos: number, preview: string): HTMLElement {
    const elem = document.createElement('div');
    elem.className = 'emmet-tag-preview';
    elem.innerText = preview;
    elem.dataset.pos = String(pos);

    editor.addWidget(editor.posFromIndex(pos), elem, false);
    return elem;
}

/**
 * Generates open tag preview for given tag match
 */
function generatePreview(editor: CodeMirror.Editor, match: TagMatch): string {
    let className = '';
    let id = '';
    const attrs: string[] = [];

    attributes(substr(editor, match.open), match.name).forEach(attr => {
        if (attr.name === 'class' && attr.value) {
            className = '.' + unquoted(attr.value).replace(/\s+/g, '.');
        } else if (attr.name === 'id' && attr.value) {
            id = '#' + unquoted(attr.value);
        } else {
            attrs.push(attr.value ? `${attr.name}=${attr.value}` : attr.name);
        }
    });

    const attrString = attrs.length ? `[${attrs.join(' ')}]` : '';
    const suffix = id + className + attrString;
    return suffix ? match.name + suffix : '';
}

function unquoted(str: string) {
    return isQuotedString(str) ? str.slice(1, -1) : str;
}

/**
 * Check if given range contains point
 * @param exclude Exclude range end and start
 */
function containsPos(range: CMMarkRange, pos: CodeMirror.Position, exclude?: boolean): boolean {
    return exclude
        ? comparePos(pos, range.from) > 0 && comparePos(pos, range.to) < 0
        : comparePos(pos, range.from) >= 0 && comparePos(pos, range.to) <= 0;
}

function comparePos(a: CodeMirror.Position, b: CodeMirror.Position) {
    return a.line - b.line || a.ch - b.ch;
}

function isValidAutoRenameRanges(editor: CodeMirror.Editor, open: CMMarkRange, close: CMMarkRange) {
    const openName = editor.getRange(open.from, open.to);
    const closeName = editor.getRange(close.from, close.to);
    return openName !== closeName;
}

function isEmptyRange(editor: CodeMirror.Editor, range: CMMarkRange): boolean {
    return editor.getRange(range.from, range.to) === '';
}
