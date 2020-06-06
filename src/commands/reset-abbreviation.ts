import { getTracker, stopTracking } from '../abbreviation/AbbreviationTracker';
import { pass, getInternalState } from '../lib/utils';

export default function resetAbbreviation(editor: CodeMirror.Editor) {
    const tracker = getTracker(editor);
    if (tracker) {
        stopTracking(editor);
        getInternalState(editor).lastTracker = null;
    } else {
        return pass(editor);
    }
}
