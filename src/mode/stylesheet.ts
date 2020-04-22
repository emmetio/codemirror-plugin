import Scanner from '@emmetio/scanner';
import { getToken, AllTokens } from '@emmetio/css-abbreviation';
import { unexpectedCharacter, ParseModeError } from './utils';

interface EmmetStylesheetModeState {
    parseError?: ParseModeError;
    brackets: number;
    scanner: Scanner;
    tokens: AllTokens[];
}

export default function emmetAbbreviationMode(): CodeMirror.Mode<EmmetStylesheetModeState> {
    return {
        startState() {
            return {
                brackets: 0,
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

            const token = getToken(scanner, state.brackets === 0);

            if (!token) {
                return unexpectedCharacter(stream, state);
            }

            if (token.type === 'Bracket') {
                state.brackets += token.open ? 1 : -1;
                if (state.brackets < 0) {
                    return unexpectedCharacter(stream, state, 'Unexpected bracket');
                }
            }

            stream.pos = scanner.pos;

            const name = getTokenName(token, state);
            state.tokens.push(token);
            return name;
        }
    }
}

/**
 * Returns scope name for given token
 */
function getTokenName(token: AllTokens, state: EmmetStylesheetModeState): string | null {
    switch (token.type) {
        case 'Bracket':
            return `bracket`;
        case 'Field':
            return 'variable-2';
        case 'Literal':
            return 'tag';
        case 'Operator':
            return `operator ${token.operator}`;
        case 'ColorValue':
            return 'variable-3';
        case 'NumberValue':
            return 'number';
        case 'StringValue':
            return 'string';
    }

    return null;
}
