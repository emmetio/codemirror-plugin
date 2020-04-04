import { Options } from 'emmet';
import getEmmetConfig from './config';
import { tabStopStart, tabStopEnd } from './utils';
import { isHTML } from './syntax';

export default function getOutputOptions(editor: CodeMirror.Editor, pos?: number, inline?: boolean): Partial<Options> {
    const posObj: CodeMirror.Position = pos != null ? editor.posFromIndex(pos) : editor.getCursor();
    const mode = editor.getMode();
    const syntax = mode && mode.name || 'html';
    const line = editor.getLine(posObj.line);
    const indent = line.match(/^\s+/);
    const config = getEmmetConfig(editor);

    const opt: Partial<Options> = {
        'output.baseIndent': indent ? indent[0] : '',
        'output.indent': getIndentation(editor),
        'output.field': field(),
        'output.format': !inline,
        'output.attributeQuotes': config.attributeQuotes
    };

    if (syntax === 'html') {
        opt['output.selfClosingStyle'] = config.markupStyle;
        if (config.markupStyle !== 'html') {
            opt['output.compactBoolean'] = false;
        }
    }

    if (isHTML(syntax)) {
        if (config.comments) {
            opt['comment.enabled'] = true;
            if (config.commentsTemplate) {
                opt['comment.after'] = config.commentsTemplate;
            }
        }

        opt['bem.enabled'] = config.bem;
    }

    return opt;
}

/**
 * Produces tabstop for CodeMirror editor
 */
export function field() {
    let handled = false;
    return (index: number, placeholder: string) => {
        if (!handled) {
            handled = true;
            return placeholder
                ? tabStopStart + placeholder + tabStopEnd
                : tabStopStart;
        }

        return '';
    }
}

/**
 * Returns token used for single indentation in given editor
 */
function getIndentation(editor: CodeMirror.Editor): string {
    if (!editor.getOption('indentWithTabs')) {
        return ' '.repeat(editor.getOption('indentUnit') || 0);
    }

    return '\t';
}
