import Scanner from '@emmetio/scanner';
import { BracketType, getToken, Bracket, AllTokens } from '@emmetio/abbreviation';
import { ParseModeError } from './types';

type Context = { [ctx in BracketType]: number } & { quote: number };

interface EmmetMarkupModeState extends Context {
    parseError?: ParseModeError;
    braces: Bracket[];
    scanner: Scanner;
    prev?: AllTokens;
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

            stream.pos = scanner.pos;
            stream.start = scanner.start;

            if (!token) {
                return unexpectedCharacter(scanner, state);
            }

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
                state.parseError = error(`No closing brace at ${pos}`, scanner);
                state.parseError.ch = pos;
                return 'error';
            }

            const name = getTokenName(token, state);
            state.prev = token;
            return name;
        }
    }
}

/**
 * Returns scope name for given token
 */
function getTokenName(token: AllTokens, state: EmmetMarkupModeState): string {
    switch(token.type) {
        case 'Bracket':
            return `bracket`;
        case 'Field':
            return 'variable-2';
        case 'Literal':
            if (state.attribute) {
                if (state.prev && state.prev.type === 'Operator' && state.prev.operator === 'equal') {
                    return 'string-2';
                }
                return state.quote ? 'string' : 'attribute';
            }

            if (state.quote) {
                return 'string';
            }

            if (state.prev && state.prev.type === 'Operator') {
                if (state.prev.operator === 'class') {
                    return 'variable-2';
                }

                if (state.prev.operator === 'id') {
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

function unexpectedCharacter(scanner: Scanner, state: EmmetMarkupModeState): string {
    state.parseError = error('Unexpected character at ' + scanner.pos, scanner);
    scanner.pos = scanner.end;
    return 'invalidchar';
}

function error(message: string, scanner: Scanner): ParseModeError {
    const err = new Error(message) as ParseModeError;
    err.ch = scanner.pos;
    return err;
}

function last<T>(arr: T[]): T {
    return arr[arr.length - 1];
}
