import { getTracker, stopTracking } from '../abbreviation';
import { pass } from '../lib/utils';

export default function resetAbbreviation(editor: CodeMirror.Editor) {
    const tracker = getTracker(editor);
    if (tracker) {
        stopTracking(editor, { force: true });
    } else {
        return pass(editor);
    }
}
