import { ParseModeError } from './types';

interface EmmetSnippetModeState {
    parseError?: ParseModeError;
}

/**
 * Emmet snippet name parsing mode
 */
export default function snippetNameMode(): CodeMirror.Mode<EmmetSnippetModeState> {
    return {
        startState() {
            return {};
        },

        token(stream, state) {
            if (!state.parseError) {
                if (stream.eatWhile(ident)) {
                    return 'tag';
                }

                if (stream.eat(separator)) {
                    return 'operator';
                }
            }

            state.parseError = new Error('Unexpected character');
            state.parseError.ch = stream.pos;
            stream.pos = stream.string.length;
            return 'invalidchar';
        }
    };
}

function ident(ch: string): boolean {
    return /[a-zA-Z0-9-_$@!%:]/.test(ch);
}

function separator(ch: string): boolean {
    return ch === '|';
}
