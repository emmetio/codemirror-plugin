import { stopTracking } from '../abbreviation/AbbreviationTracker';
import { getCaret } from '../lib/utils';
import { extractTracker } from '../abbreviation';

export default function captureAbbreviation(editor: CodeMirror.Editor) {
    stopTracking(editor);
    const tracker = extractTracker(editor, getCaret(editor));
    if (tracker && tracker.abbreviation) {
        tracker.showPreview(editor);
    }
}
