import { getTracker, stopTracking, startTracking } from '../abbreviation';
import { textRange } from '../lib/utils';

export default function enterAbbreviationMode(editor: CodeMirror.Editor) {
    let tracker = getTracker(editor);
    stopTracking(editor);
    if (tracker && tracker.forced) {
        // Already have forced abbreviation: act as toggler
        return;
    }

    const [from, to] = textRange(editor, editor.listSelections()[0]);

    tracker = startTracking(editor, from, to, { forced: true });
    if (from !== to) {
        editor.setSelection(editor.posFromIndex(to));
    }
}
