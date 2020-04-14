import { evaluateMath } from '../lib/emmet';

export default function evaluateMathCommand(editor: CodeMirror.Editor) {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const expr = evaluateMath(line, cursor.ch);

    if (expr) {
        const from = { line: cursor.line, ch: expr.start };
        const to = { line: cursor.line, ch: expr.end };
        editor.replaceRange(expr.snippet, from, to);
    }
}
