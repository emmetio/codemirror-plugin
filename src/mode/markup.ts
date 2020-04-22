import Scanner from '@emmetio/scanner';
import { getToken, BracketType, Bracket, AllTokens } from '@emmetio/abbreviation';
import { last, unexpectedCharacter, error, ParseModeError } from './utils';

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
            return name;
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
            return 'string';
        case 'RepeaterNumber':
            return 'number';
    }

    return '';
}
