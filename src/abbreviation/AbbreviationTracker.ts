import { UserConfig, markupAbbreviation, MarkupAbbreviation, stylesheetAbbreviation, StylesheetAbbreviation } from 'emmet';
import { TextRange } from '@emmetio/action-utils';
import { substr, toRange, AbbrError, errorSnippet, getInternalState, pairsEnd } from '../lib/utils';
import { getOptions, expand } from '../lib/emmet';
import getEmmetConfig from '../lib/config';
import { syntaxInfo, enabledForSyntax } from '../lib/syntax';

interface AbbrBase {
    abbr: string;
    type: string;
}

interface ParsedAbbreviation extends AbbrBase {
    type: 'abbreviation';
    simple: boolean;
    preview: string;
}

interface ParsedAbbreviationError extends AbbrBase {
    type: 'error';
    error: AbbrError;
}

export interface StartTrackingParams {
    options: UserConfig;
    offset?: number;
    forced?: boolean;
}

interface StopTrackingOptions {
    /** Do not remove contents of force-tracked abbreviation */
    skipRemove?: boolean;

    /** Forced tracker remove, do not add it to history */
    force?: boolean;
}

/** Class name for Emmet abbreviation marker in editor */
const markClass = 'emmet-abbreviation';

/** Class name for Emmet abbreviation preview in editor */
const previewClass = 'emmet-abbreviation-preview';

/** Key for storing Emmet tracker in editor instance */
const trackerKey = '$$emmetTracker';

export interface SerializedTracker {
    range: TextRange;
    abbr?: string;
    valid: boolean;
    forced: boolean;
    offset: number;
}

export default class AbbreviationTracker {
    /** Last caret location in document */
    public lastPos: number;
    /** Last document length */
    public lastLength: number;
    /** Current abbreviation range */
    public range: TextRange;
    /** Offset in range where abbreviation actually starts */
    public offset = 0;
    /** Abbreviation is forced, e.g. must be kept in editor as long as possible */
    public forced = false;

    /** Parsed abbreviation for current range. May contain error */
    public abbreviation: ParsedAbbreviation | ParsedAbbreviationError | null = null;
    public options: UserConfig;

    private marker: CodeMirror.TextMarker | null = null;
    private preview: CodeMirror.Editor | null = null;
    private forcedMarker: HTMLElement | null = null;

    constructor(start: number, pos: number, length: number, params: StartTrackingParams) {
        this.lastPos = pos;
        this.lastLength = length;
        this.range = [start, pos];
        this.options = params.options;
        this.forced = !!params.forced;
        this.offset = params.offset || 0;
    }

    /**
     * Marks tracker in given editor
     */
    mark(editor: CodeMirror.Editor) {
        this.disposeMarker();
        const [from, to] = toRange(editor, this.range);
        this.marker = editor.markText(from, to, {
            inclusiveLeft: true,
            inclusiveRight: true,
            clearWhenEmpty: false,
            className: markClass
        });

        if (this.forced && !this.forcedMarker) {
            this.forcedMarker = document.createElement('div');
            this.forcedMarker.className = `${markClass}-marker`;
            editor.addWidget(from, this.forcedMarker, false);
        }
    }

    /**
     * Remove current tracker marker
     */
    unmark() {
        this.disposeMarker();
        this.hidePreview();
    }

    showPreview(editor: CodeMirror.Editor) {
        const config = getEmmetConfig(editor);

        // Check if we should display preview
        if (!enabledForSyntax(config.preview, syntaxInfo(editor, this.range[0]))) {
            return;
        }

        let content: string | undefined;
        let isError = false;

        if (this.abbreviation) {
            if (this.abbreviation.type === 'error') {
                content = errorSnippet(this.abbreviation.error);
                isError = true;
            } else if (this.forced || !this.abbreviation.simple) {
                content = this.abbreviation.preview;
            }
        }

        if (content) {
            if (!this.preview) {
                const previewElem = document.createElement('div');
                previewElem.className = previewClass;

                const pos = editor.posFromIndex(this.range[0]);
                if (config.attachPreview) {
                    config.attachPreview(editor, previewElem, pos);
                } else {
                    editor.addWidget(pos, previewElem, false);
                }

                // @ts-ignore
                this.preview = new editor.constructor(previewElem, {
                    mode: editor.getOption('mode'),
                    readOnly: 'nocursor',
                    lineNumbers: false
                }) as CodeMirror.Editor;

                const errElement = document.createElement('div');
                errElement.className = `${previewClass}-error`;
                previewElem.appendChild(errElement);
            }

            const wrapper = this.preview.getWrapperElement().parentElement!;
            wrapper.classList.toggle('has-error', isError);
            if (isError) {
                wrapper.querySelector(`.${previewClass}-error`)!.innerHTML = content;
            } else {
                this.preview.setValue(content);
            }
        } else {
            this.hidePreview();
        }
    }

    /**
     * Removes preview of current abbreviation
     */
    hidePreview() {
        if (this.preview) {
            this.preview.getWrapperElement().parentElement!.remove();
            this.preview = null;
        }
    }

    /**
     * Check if current range contains given position
     */
    contains(pos: number): boolean {
        return pos >= this.range[0] && pos <= this.range[1];
    }

    /**
     * Returns serialized copy of current tracked
     */
    serialize(): SerializedTracker {
        return {
            range: this.range,
            abbr: this.abbreviation?.abbr,
            valid: this.abbreviation?.type === 'abbreviation',
            forced: this.forced,
            offset: this.offset
        };
    }

    /**
     * Stores contents of current tracker in internal state of given editor.
     * Stored tracker can be restored later
     */
    save(editor: CodeMirror.Editor) {
        const state = getInternalState(editor);
        state.lastTracker = this.serialize();
    }

    private disposeMarker() {
        if (this.marker) {
            this.marker.clear();
            this.marker = null;
        }

        if (this.forcedMarker) {
            this.forcedMarker.remove();
            this.forcedMarker = null;
        }
    }
}

/**
 * Returns abbreviation tracker for given editor
 */
export function getTracker(editor: CodeMirror.Editor): AbbreviationTracker | undefined {
    return editor[trackerKey];
}

/**
 * Starts abbreviation tracking for given editor
 * @param start Location of abbreviation start
 * @param pos Current caret position, must be greater that `start`
 */
export function startTracking(editor: CodeMirror.Editor, start: number, pos: number, params?: Partial<StartTrackingParams>): AbbreviationTracker {
    const options = params?.options || getOptions(editor, start);
    const tracker = new AbbreviationTracker(start, pos, editor.getValue().length, {
        ...params,
        options
    });
    tracker.abbreviation = getParsedAbbreviation(editor, [start, pos], options, params?.offset);
    tracker.mark(editor);
    return editor[trackerKey] = tracker;
}

/**
 * Stops abbreviation tracking in given editor instance
 */
export function stopTracking(editor: CodeMirror.Editor, options?: StopTrackingOptions) {
    const tracker = getTracker(editor);
    if (tracker) {
        tracker.unmark();
        if (tracker.forced && !options?.skipRemove) {
            // Contents of forced abbreviation must be removed
            const [from, to] = toRange(editor, tracker.range);
            editor.replaceRange('', from, to);
        }

        if (options?.force) {
            getInternalState(editor).lastTracker = null;
        } else {
            // Store tracker in history to restore it if user continues editing
            tracker.save(editor);
        }

        editor[trackerKey] = null;
    }
}

/**
 * Handle content change in given editor instance
 */
export function handleChange(editor: CodeMirror.Editor, pos: number): AbbreviationTracker | undefined {
    const tracker = getTracker(editor);

    if (!tracker) {
        return;
    }

    const { lastPos } = tracker;
    let range = tracker.range;

    if (lastPos < range[0] || lastPos > range[1]) {
        // Updated content outside abbreviation: reset tracker
        stopTracking(editor);
        return;
    }

    const length = editor.getValue().length;
    const delta = length - tracker.lastLength;
    range = range.slice() as TextRange;

    // Modify range and validate it: if it leads to invalid abbreviation, reset it
    updateRange(range, delta, lastPos);

    // Handle edge case: empty forced abbreviation are allowed
    if (range[0] === range[1] && tracker.forced) {
        tracker.abbreviation = null;
        return tracker;
    }

    const abbreviation = getParsedAbbreviation(editor, range, tracker.options, tracker.offset);

    if (!abbreviation || (!tracker.forced && !isValidAbbreviation(abbreviation, range, pos))) {
        stopTracking(editor);
        return;
    }

    tracker.range = range;
    tracker.abbreviation = abbreviation;
    tracker.lastLength = length;
    tracker.lastPos = pos;
    tracker.mark(editor);
    return tracker;
}

export function handleSelectionChange(editor: CodeMirror.Editor, pos: number): AbbreviationTracker | undefined {
    const tracker = getTracker(editor) || restoreTracker(editor, pos);
    if (tracker) {
        tracker.lastPos = pos;
    }
    return tracker;
}

/**
 * Check if given parsed markup abbreviation is simple.A simple abbreviation
 * may not be displayed to user as preview to reduce distraction
 */
function isSimpleMarkupAbbreviation(abbr: MarkupAbbreviation): boolean {
    if (abbr.children.length === 1 && !abbr.children[0].children.length) {
        // Single element: might be a HTML element or text snippet
        const first = abbr.children[0];
        // XXX silly check for common snippets like `!`. Should read contents
        // of expanded abbreviation instead
        return !first.name || /^[a-z]/i.test(first.name);
    }
    return !abbr.children.length;
}

function getPreviewConfig(config: UserConfig): UserConfig {
    return {
        ...config,
        options: {
            ...config.options,
            'output.field': previewField,
            'output.indent': '  ',
            'output.baseIndent': ''
        }
    };
}

function previewField(index: number, placeholder: string) {
    return placeholder;
}

function updateRange(range: TextRange, delta: number, lastPos: number): TextRange {
    if (delta < 0) {
        // Content removed
        if (lastPos === range[0]) {
            // Updated content at the abbreviation edge
            range[0] += delta;
            range[1] += delta;
        } else if (range[0] < lastPos && lastPos <= range[1]) {
            range[1] += delta;
        }
    } else if (delta > 0 && range[0] <= lastPos && lastPos <= range[1]) {
        // Content inserted
        range[1] += delta;
    }

    return range;
}

/**
 * Returns parsed abbreviation for given range
 */
function getParsedAbbreviation(editor: CodeMirror.Editor, range: TextRange, options: UserConfig, offset?: number): ParsedAbbreviation | ParsedAbbreviationError | null {
    if (range[0] >= range[1]) {
        // Invalid range
        return null;
    }

    let abbr = substr(editor, range);
    if (offset) {
        abbr = abbr.slice(offset);
    }

    // Basic validation: do not allow empty abbreviations
    // or newlines in abbreviations
    if (!abbr || /[\r\n]/.test(abbr)) {
        return null;
    }

    try {
        let parsedAbbr: MarkupAbbreviation | StylesheetAbbreviation | undefined;
        let simple = false;

        if (options.type === 'stylesheet') {
            parsedAbbr = stylesheetAbbreviation(abbr);
        } else {
            parsedAbbr = markupAbbreviation(abbr, {
                jsx: options.syntax === 'jsx'
            });
            simple = isSimpleMarkupAbbreviation(parsedAbbr);
        }

        const previewConfig = getPreviewConfig(options);
        return {
            type: 'abbreviation',
            abbr,
            simple,
            preview: expand(editor, parsedAbbr, previewConfig)
        };
    } catch (error) {
        return { type: 'error', abbr, error };
    }
}

/**
 * Check if given parsed abbreviation is in valid state for keeping it marked
 */
function isValidAbbreviation(abbreviation: ParsedAbbreviation | ParsedAbbreviationError, range: TextRange, pos: number): boolean {
    if (abbreviation.type === 'error') {
        if (range[1] === pos) {
            // Last entered character is invalid
            return false;
        }

        const { abbr } = abbreviation;
        const start = range[0];
        let targetPos = range[1];
        while (targetPos > start) {
            if (pairsEnd.includes(abbr[targetPos - start - 1])) {
                targetPos--;
            } else {
                break;
            }
        }

        return targetPos !== pos;
    }

    return true;
}

/**
 * Tries to restore abbreviation tracker for given editor at specified position
 */
export function restoreTracker(editor: CodeMirror.Editor, pos: number): AbbreviationTracker | undefined {
    const state = getInternalState(editor);
    const { lastTracker } = state;

    if (lastTracker && lastTracker.range[0] <= pos && lastTracker.range[1] >= pos) {
        // Tracker can be restored at given location. Make sure it’s contents matches
        // contents of editor at the same location. If it doesn’t, reset stored tracker
        // since it’s not valid anymore
        state.lastTracker = null;

        if (substr(editor, lastTracker.range) === lastTracker.abbr) {
            return startTracking(editor, lastTracker.range[0], lastTracker.range[1], {
                offset: lastTracker.offset,
                forced: lastTracker.forced
            });
        }
    }
}
