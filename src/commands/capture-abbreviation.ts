import { getCaret } from '../lib/utils';
import { extractTracker, stopTracking } from '../abbreviation';

export default function captureAbbreviation(editor: CodeMirror.Editor) {
    stopTracking(editor);
    extractTracker(editor, getCaret(editor));
}
