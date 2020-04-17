import Scanner from '@emmetio/scanner';

export type ParseModeError = Error & { ch?: number };

interface State {
    parseError?: ParseModeError;
}

export function error(message: string, scanner: Scanner | CodeMirror.StringStream): ParseModeError {
    const err = new Error(message) as ParseModeError;
    err.ch = scanner.pos;
    return err;
}

export function unexpectedCharacter(stream: CodeMirror.StringStream, state: State, message = 'Unexpected character'): string {
    state.parseError = error(message.replace(/\s+at\s+\d+$/, ''), stream);
    stream.skipToEnd();
    return 'invalidchar';
}

export function last<T>(arr: T[]): T {
    return arr[arr.length - 1];
}
