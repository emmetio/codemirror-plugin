import { getTracker, stopTracking } from '../abbreviation/AbbreviationTracker';
import { pass } from '../lib/utils';

export default function resetAbbreviation(editor: CodeMirror.Editor) {
    const tracker = getTracker(editor);
    if (tracker) {
        stopTracking(editor);
    } else {
        return pass(editor);
    }
}
