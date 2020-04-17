import Scanner from '@emmetio/scanner';
import { getToken, parse, BracketType, Bracket, AllTokens } from '@emmetio/abbreviation';
import { ParseModeError } from './types';

type Context = { [ctx in BracketType]: number } & { quote: number };

interface EmmetMarkupModeState extends Context {
    parseError?: ParseModeError;
    braces: Bracket[];
    scanner: Scanner;
    tokens: AllTokens[];
}

export default function emmetAbbreviationMode(): CodeMirror.Mode<EmmetMarkupModeState> {
    return {
        startState() {
            return {
                attribute: 0,
                expression: 0,
                group: 0,
                quote: 0,
                braces: [],
                tokens: [],
                scanner: new Scanner('')
            };
        },
        token(stream, state) {
            const { scanner } = state;
            scanner.string = stream.string;
            scanner.pos = stream.pos;
            scanner.start = stream.start;
            scanner.end = stream.string.length;

            const ch = scanner.peek();
            const token = getToken(scanner, state);

            if (!token) {
                return unexpectedCharacter(stream, state);
            }

            stream.pos = scanner.pos;

            if (token.type === 'Quote') {
                state.quote = ch === state.quote ? 0 : ch;
            } else if (token.type === 'Bracket') {
                if (token.open) {
                    state[token.context]++;
                    state.braces.push(token);
                } else {
                    state[token.context]--;
                    const lastBrace = last(state.braces);
                    if (lastBrace && lastBrace.context === token.context) {
                        state.braces.pop();
                    }
                }
            }

            // Report if closing braces are missing at the end of abbreviation
            if (stream.eol() && state.braces.length && !state.parseError) {
                const pos = last(state.braces).start;
                state.parseError = error(`No closing brace at ${pos}`, stream);
                return null;
            }

            const name = getTokenName(token, state);
            state.tokens.push(token);

            // Validate current abbreviation
            try {
                parse(state.tokens);
                return name;
            } catch (err) {
                stream.pos = err.pos;
                return unexpectedCharacter(stream, state, err.message);
            }
        }
    }
}

/**
 * Returns scope name for given token
 */
function getTokenName(token: AllTokens, state: EmmetMarkupModeState): string {
    const prev = last(state.tokens)
    switch(token.type) {
        case 'Bracket':
            return `bracket`;
        case 'Field':
            return 'variable-2';
        case 'Literal':
            if (state.attribute) {
                if (prev && prev.type === 'Operator' && prev.operator === 'equal') {
                    return 'string-2';
                }
                return state.quote ? 'string' : 'attribute';
            }

            if (state.quote) {
                return 'string';
            }

            if (prev && prev.type === 'Operator') {
                if (prev.operator === 'class') {
                    return 'variable-2';
                }

                if (prev.operator === 'id') {
                    return 'variable-3';
                }
            }

            return 'tag';
        case 'Operator':
            if (token.operator === 'class') {
                return 'variable-2';
            }

            if (token.operator === 'id') {
                return 'variable-3';
            }

            return `operator ${token.operator}`;
        case 'Repeater':
        case 'RepeaterPlaceholder':
            return 'meta';
        case 'Quote':
            return 'quote';
        case 'RepeaterNumber':
            return 'number';
    }

    return '';
}

export function error(message: string, scanner: Scanner | CodeMirror.StringStream): ParseModeError {
    const err = new Error(message) as ParseModeError;
    err.ch = scanner.pos;
    return err;
}

function unexpectedCharacter(stream: CodeMirror.StringStream, state: EmmetMarkupModeState, message = 'Unexpected character'): string {
    state.parseError = error(message.replace(/\s+at\s+\d+$/, ''), stream);
    stream.skipToEnd();
    return 'invalidchar';
}

function last<T>(arr: T[]): T {
    return arr[arr.length - 1];
}
