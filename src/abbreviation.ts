import { UserConfig } from 'emmet';
import { AbbreviationTrackingController, EditorProxy, AbbreviationTracker, AbbreviationTrackerType, JSX_PREFIX, StopTrackingParams, StartTrackingParams } from '@emmetio/action-utils';
import { getInternalState, getCaret, toRange, errorSnippet, replaceWithSnippet } from './lib/utils';
import {
    isSupported, isJSX, isCSS, isHTML, isXML, syntaxFromPos, docSyntax,
    syntaxInfo, enabledForSyntax, getSyntaxType
} from './lib/syntax';
import { getOptions, extract, expand } from './lib/emmet';
import getOutputOptions from './lib/output';
import getEmmetConfig from './lib/config';

export interface CompletionItem {
    text: string;
    displayText: string;
    hint(): void;
    from: CodeMirror.Position;
    to: CodeMirror.Position;
}

/** Class name for Emmet abbreviation marker in editor */
const markClass = 'emmet-abbreviation';

/** Class name for Emmet abbreviation preview in editor */
const previewClass = 'emmet-abbreviation-preview';

class CMEditorProxy implements EditorProxy {
    public cm: CodeMirror.Editor;
    public marker: CodeMirror.TextMarker | null = null;
    public preview: CodeMirror.Editor | null = null;
    public forcedMarker: HTMLElement | null = null;

    get id() {
        return getInternalState(this.cm).id;
    }

    substr(from?: number, to?: number) {
        const value = this.cm.getValue();
        if (from === undefined && to === undefined) {
            return value;
        }

        return value.slice(from || 0, to);
    }

    replace(value: string, from: number, to: number) {
        this.cm.replaceRange(value,
            this.cm.posFromIndex(from),
            this.cm.posFromIndex(to));
    }

    syntax() {
        return docSyntax(this.cm);
    }

    size() {
        return this.cm.getValue().length;
    }

    config(pos: number): UserConfig {
        return getOptions(this.cm, pos);
    }

    outputOptions(pos: number, inline?: boolean) {
        return getOutputOptions(this.cm, pos, inline);
    }

    previewConfig(config: UserConfig) {
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

    allowTracking(pos: number) {
        return allowTracking(this.cm, pos);
    }

    mark(tracker: AbbreviationTracker): void {
        const { cm } = this;
        this.disposeMarker();
        const [from, to] = toRange(cm, tracker.range);
        this.marker = cm.markText(from, to, {
            inclusiveLeft: true,
            inclusiveRight: true,
            clearWhenEmpty: false,
            className: markClass
        });

        if (tracker.forced && !this.forcedMarker) {
            this.forcedMarker = document.createElement('div');
            this.forcedMarker.className = `${markClass}-marker`;
            cm.addWidget(from, this.forcedMarker, false);
        }
    }

    unmark(): void {
        this.disposeMarker();
        this.hidePreview();
    }

    showPreview(tracker: AbbreviationTracker) {
        const { cm } = this;
        const config = getEmmetConfig(cm);

        // Check if we should display preview
        if (!enabledForSyntax(config.preview, syntaxInfo(cm, tracker.range[0]))) {
            return;
        }

        let content: string | undefined;
        let isError = false;

        if (tracker.type === AbbreviationTrackerType.Error) {
            content = errorSnippet(tracker.error);
            isError = true;
        } else if (tracker.forced || !tracker.simple) {
            content = tracker.preview;
        }

        if (content) {
            if (!this.preview) {
                const previewElem = document.createElement('div');
                previewElem.className = previewClass;

                const pos = cm.posFromIndex(tracker.range[0]);
                if (config.attachPreview) {
                    config.attachPreview(cm, previewElem, pos);
                } else {
                    cm.addWidget(pos, previewElem, false);
                }

                // @ts-ignore
                this.preview = new this.cm.constructor(previewElem, {
                    mode: cm.getOption('mode'),
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

    hidePreview() {
        if (this.preview) {
            this.preview.getWrapperElement().parentElement!.remove();
            this.preview = null;
        }
    }

    /**
     * Check if given syntax is a CSS dialect (including SCSS, LESS etc)
     */
    isCSS(syntax: string): boolean {
        return isCSS(syntax);
    }

    syntaxType(syntax: string) {
        return getSyntaxType(syntax);
    }

    /**
     * Check if given syntax is a HTML dialect. HTML dialects also support embedded
     * stylesheets in `<style>` tga or `style=""` attribute
     */
    isHTML(syntax: string): boolean {
        return isHTML(syntax);
    }

    /**
     * Check if given syntax is a XML dialect. Unlike HTML, XML dialects doesn’t
     * support embedded stylesheets
     */
    isXML(syntax: string): boolean {
        return isXML(syntax);
    }

    /**
     * Check if given syntax is a JSX dialect
     */
    isJSX(syntax: string) {
        return isJSX(syntax);
    }

    /**
     * Runs given callback in context of given editor
     */
    run<R>(editor: CodeMirror.Editor, callback: () => R): R {
        const { cm } = this;
        this.cm = editor;
        const result = callback();
        this.cm = cm;
        return result;
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

function previewField(index: number, placeholder: string) {
    return placeholder;
}

const proxy = new CMEditorProxy();
const controller = new AbbreviationTrackingController<CMEditorProxy>();

export default function initAbbreviationTracker(editor: CodeMirror.Editor) {
    const onChange = (ed: CodeMirror.Editor) => {
        proxy.run(ed, () => {
            controller.handleChange(proxy, getCaret(ed));
        });
    };
    const onSelectionChange = (ed: CodeMirror.Editor) => {
        proxy.run(ed, () => {
            const caret = getCaret(ed);
            if (!isEnabled(ed, caret)) {
                return;
            }

            const tracker = controller.handleSelectionChange(proxy, caret);
            if (tracker) {
                if (contains(tracker, caret)) {
                    proxy.showPreview(tracker);
                } else {
                    proxy.hidePreview();
                }
            }
        });
    };

    editor.on('change', onChange);
    editor.on('focus', onSelectionChange);
    editor.on('cursorActivity', onSelectionChange);

    return () => {
        proxy.run(editor, () => controller.disposeEditor(proxy));
        editor.off('change', onChange);
        editor.off('focus', onSelectionChange);
        editor.off('cursorActivity', onSelectionChange);
    };
}

/**
 * Runs given function in context of abbreviation tracker
 */
export function runInTrackerContext<R>(editor: CodeMirror.Editor, callback: (controller: AbbreviationTrackingController<CMEditorProxy>, proxy: CMEditorProxy) => R): R {
    return proxy.run(editor, () => callback(controller, proxy));
}

/**
 * Check if abbreviation tracking is allowed in editor at given location
 */
export function allowTracking(editor: CodeMirror.Editor, pos: number): boolean {
    if (isEnabled(editor, pos)) {
        const syntax = syntaxFromPos(editor, pos);
        return syntax ? isSupported(syntax) || isJSX(syntax) : false;
    }

    return false;
}

/**
 * Check if Emmet auto-complete is enabled
 */
export function isEnabled(editor: CodeMirror.Editor, pos: number): boolean {
    const config = getEmmetConfig(editor);
    return enabledForSyntax(config.mark, syntaxInfo(editor, pos));
}

/**
 * If allowed, tries to extract abbreviation from given completion context
 * @param forceValid Enforces tracker to be valid, e.g. do not track abbreviation
 * if it’s not valid
 */
export function extractTracker(editor: CodeMirror.Editor, pos: number, forceValid?: boolean): AbbreviationTracker | undefined {
    return proxy.run(editor, () => {
        const syntax = proxy.syntax();
        const prefix = proxy.isJSX(syntax) ? JSX_PREFIX : '';
        const config = controller.getActivationContext(proxy, pos);
        const abbr = extract(proxy.substr(), pos, getSyntaxType(config?.syntax), { prefix });
        if (abbr) {
            const tracker = controller.startTracking(proxy, abbr.start, abbr.end, {
                offset: prefix.length,
                config
            });

            if (tracker) {
                if (tracker.type === AbbreviationTrackerType.Error && forceValid) {
                    controller.stopTracking(proxy, { force: true });
                    return;
                }
                proxy.showPreview(tracker);
            }
            return tracker;
        }
    });
}

/**
 * Returns abbreviation tracker for given editor, if any
 */
export function getTracker(editor: CodeMirror.Editor): AbbreviationTracker | undefined {
    return proxy.run(editor, () => controller.getTracker(proxy));
}

/**
 * Start abbreviation tracking in given editor for given range
 */
export function startTracking(editor: CodeMirror.Editor, start: number, pos: number, params?: Partial<StartTrackingParams>) {
    return proxy.run(editor, () => {
        const tracker = controller.startTracking(proxy, start, pos, params);
        if (tracker) {
            proxy.showPreview(tracker);
        }

        return tracker;
    });
}

/**
 * Stops abbreviation tracking in given editor
 */
export function stopTracking(editor: CodeMirror.Editor, params?: Partial<StopTrackingParams>) {
    return proxy.run(editor, () => controller.stopTracking(proxy, params));
}

/**
 * Returns completion item, suitable for auto-hint CodeMirror module,
 * with tracked abbreviation for it
 */
export function getCompletion(editor: CodeMirror.Editor, pos: number): CompletionItem | undefined {
    const tracker = getTracker(editor) || extractTracker(editor, pos);
    if (tracker && contains(tracker, pos) && tracker.type === AbbreviationTrackerType.Abbreviation) {
        const { abbreviation, preview } = tracker;
        return {
            text: abbreviation,
            displayText: preview,
            hint: () => {
                stopTracking(editor);
                const snippet = expand(editor, abbreviation, tracker.config);
                replaceWithSnippet(editor, tracker.range, snippet);
            },
            from: editor.posFromIndex(tracker.range[0]),
            to: editor.posFromIndex(tracker.range[1]),
        } as CompletionItem;
    }
}

/**
 * Restore tracker on undo, if possible
 */
export function restoreOnUndo(editor: CodeMirror.Editor, pos: number, abbr: string) {
    proxy.run(editor, () => {
        const lastTracker = controller.getStoredTracker(proxy);

        if (lastTracker) {
            const shouldRestore = lastTracker.type === AbbreviationTrackerType.Abbreviation
                && abbr === lastTracker.abbreviation
                && lastTracker.range[0] === pos;

            if (shouldRestore) {
                controller.restoreTracker(proxy, pos);
            }
        }
    })
}

/**
 * Check if tracker range contains given position
 */
export function contains(tracker: AbbreviationTracker, pos: number): boolean {
    return pos >= tracker.range[0] && pos <= tracker.range[1];
}
