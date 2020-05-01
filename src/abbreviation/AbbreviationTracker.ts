import { UserConfig, markupAbbreviation, MarkupAbbreviation, stylesheetAbbreviation, StylesheetAbbreviation } from 'emmet';
import { TextRange } from '@emmetio/action-utils';
import { substr, toRange, getCaret, AbbrError, errorSnippet } from '../lib/utils';
import { getOptions, expand } from '../lib/emmet';
import getEmmetConfig from '../lib/config';

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
    options?: UserConfig;
    offset?: number;
    forced?: boolean;
}

/** Class name for Emmet abbreviation marker in editor */
const markClass = 'emmet-abbreviation';

/** Class name for Emmet abbreviation preview in editor */
const previewClass = 'emmet-abbreviation-preview';

/** Key for storing Emmet tracker in editor instance */
const trackerKey = '$$emmetTracker';

export default class AbbreviationTracker {
    /** Last caret location in document */
    public lastPos: number;
    /** Last document length */
    public lastLength: number;
    /** Current abbreviation range */
    public range: TextRange;
    /** Offset in range where abbreviation actually starts */
    public offset = 0;
    /** Parsed abbreviation for current range. May contain error */
    public abbreviation: ParsedAbbreviation | ParsedAbbreviationError | null = null;
    public options: UserConfig | undefined;

    private marker: CodeMirror.TextMarker | null = null;
    private preview: CodeMirror.Editor | null = null;
    private forcedMarker: HTMLElement | null = null;

    constructor(start: number, pos: number, length: number, public forced = false) {
        this.lastPos = pos;
        this.lastLength = length;
        this.range = [start, pos];
    }

    /**
     * Shifts tracker location by given offset
     */
    shift(offset: number) {
        this.range[0] += offset;
        this.range[1] += offset;
    }

    /**
     * Extends or shrinks range by given size
     */
    extend(size: number) {
        this.range[1] += size;
    }

    /**
     * Check if current region is in valid state
     */
    isValidRange(): boolean {
        return this.range[0] < this.range[1] || (this.range[0] === this.range[1] && this.forced);
    }

    /**
     * Updates abbreviation data from current tracker
     */
    updateAbbreviation(editor: CodeMirror.Editor) {
        let abbr = substr(editor, this.range);
        if (this.offset) {
            abbr = abbr.slice(this.offset);
        }

        if (!this.options) {
            this.options = getOptions(editor, this.range[0], true);
        }

        this.abbreviation = null;

        if (!abbr) {
            return;
        }

        try {
            let parsedAbbr: MarkupAbbreviation | StylesheetAbbreviation | undefined;
            let simple = false;

            if (this.options.type === 'stylesheet') {
                parsedAbbr = stylesheetAbbreviation(abbr);
            } else {
                parsedAbbr = markupAbbreviation(abbr, {
                    jsx: this.options.syntax === 'jsx'
                });
                simple = isSimpleMarkupAbbreviation(parsedAbbr);
            }

            const previewConfig = getPreviewConfig(this.options);
            this.abbreviation = {
                type: 'abbreviation',
                abbr,
                simple,
                preview: expand(editor, parsedAbbr, previewConfig)
            };
        } catch (error) {
            this.abbreviation = { type: 'error', abbr, error };
        }
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
        if (!config.preview) {
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
export function startTracking(editor: CodeMirror.Editor, start: number, pos: number, params?: StartTrackingParams): AbbreviationTracker {
    const tracker = new AbbreviationTracker(start, pos, editor.getValue().length, params?.forced);
    if (params) {
        tracker.options = params.options;
        tracker.offset = params.offset || 0;
    }

    tracker.updateAbbreviation(editor);
    tracker.mark(editor);
    return editor[trackerKey] = tracker;
}

/**
 * Stops abbreviation tracking in given editor instance
 */
export function stopTracking(editor: CodeMirror.Editor, skipRemove?: boolean) {
    const tracker = getTracker(editor);
    if (tracker) {
        tracker.unmark();
        if (tracker.forced && !skipRemove) {
            // Contents of forced abbreviation must be removed
            const [from, to] = toRange(editor, tracker.range);
            editor.replaceRange('', from, to);
        }
        editor[trackerKey] = null;
    }
}

/**
 * Handle content change in given editor instance
 */
export function handleChange(editor: CodeMirror.Editor): AbbreviationTracker | undefined {
    const tracker = getTracker(editor);
    if (!tracker) {
        return;
    }

    const { lastPos, range } = tracker;

    if (lastPos < range[0] || lastPos > range[1]) {
        // Updated content outside abbreviation: reset tracker
        stopTracking(editor);
        return
    }

    const length = editor.getValue().length;
    const pos = getCaret(editor);
    const delta = length - tracker.lastLength;

    tracker.lastLength = length;
    tracker.lastPos = pos;

    if (delta < 0) {
        // Removed some content
        if (lastPos === range[0]) {
            // Updated content at the abbreviation edge
            tracker.shift(delta);
        } else if (range[0] < lastPos && lastPos <= range[1]) {
            tracker.extend(delta);
        }
    } else if (delta > 0 && range[0] <= lastPos && lastPos <= range[1]) {
        // Inserted content
        tracker.extend(delta);
    }

    // Ensure range is in valid state
    if (!tracker.isValidRange()) {
        stopTracking(editor);
    } else {
        tracker.updateAbbreviation(editor);
        tracker.mark(editor);
        return tracker;
    }
}

export function handleSelectionChange(editor: CodeMirror.Editor, caret = getCaret(editor)): AbbreviationTracker | undefined {
    const tracker = getTracker(editor);
    if (tracker) {
        tracker.lastPos = caret;
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
        return !first.name || /^[a-z]/.test(first.name);
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
