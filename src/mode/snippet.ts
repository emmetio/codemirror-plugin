/**
 * Emmet snippet name parsing mode
 */
export default function snippetNameMode(): CodeMirror.Mode<{}> {
    return {
        token(stream) {
            if (stream.eatWhile(ident)) {
                return 'tag';
            }

            if (stream.eat(separator)) {
                return 'operator';
            }

            stream.skipToEnd();
            return 'invalidchar';
        }
    };
}

function ident(ch: string): boolean {
    return /[a-zA-Z0-9-_$@!:]/.test(ch);
}

function separator(ch: string): boolean {
    return ch === '|';
}
