import { Options } from 'emmet';
import getEmmetConfig from './config';
import { tabStopStart, tabStopEnd } from './utils';
import { isHTML, docSyntax } from './syntax';

export default function getOutputOptions(editor: CodeMirror.Editor, pos?: number, inline?: boolean): Partial<Options> {
    const posObj: CodeMirror.Position = pos != null ? editor.posFromIndex(pos) : editor.getCursor();
    const syntax = docSyntax(editor) || 'html';
    const config = getEmmetConfig(editor);

    const opt: Partial<Options> = {
        'output.baseIndent': lineIndent(editor, posObj.line),
        'output.indent': getIndentation(editor),
        'output.field': field(),
        'output.format': !inline,
        'output.attributeQuotes': config.attributeQuotes
    };

    if (syntax === 'html') {
        opt['output.selfClosingStyle'] = config.markupStyle;
        opt['output.compactBoolean'] = config.markupStyle === 'html';
    }

    if (isHTML(syntax)) {
        if (config.comments) {
            opt['comment.enabled'] = true;
            if (config.commentsTemplate) {
                opt['comment.after'] = config.commentsTemplate;
            }
        }

        opt['bem.enabled'] = config.bem;
        opt['stylesheet.shortHex'] = config.shortHex;
    }

    return opt;
}

/**
 * Produces tabstop for CodeMirror editor
 */
export function field() {
    let handled = -1;
    return (index: number, placeholder: string) => {
        if (handled === -1 || handled === index) {
            handled = index;
            return placeholder
                ? tabStopStart + placeholder + tabStopEnd
                : tabStopStart;
        }

        return placeholder || '';
    }
}

/**
 * Returns indentation of given line
 */
export function lineIndent(editor: CodeMirror.Editor, line: number): string {
    const lineStr = editor.getLine(line);
    const indent = lineStr.match(/^\s+/);
    return indent ? indent[0] : '';
}

/**
 * Returns token used for single indentation in given editor
 */
export function getIndentation(editor: CodeMirror.Editor): string {
    if (!editor.getOption('indentWithTabs')) {
        return ' '.repeat(editor.getOption('indentUnit') || 0);
    }

    return '\t';
}
