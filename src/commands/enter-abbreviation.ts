import { getTracker, stopTracking, startTracking } from '../abbreviation/AbbreviationTracker';

export default function enterAbbreviationMode(editor: CodeMirror.Editor) {
    let tracker = getTracker(editor);
    stopTracking(editor);
    if (tracker && tracker.forced) {
        // Already have forced abbreviation: act as toggler
        return;
    }

    const sel = editor.listSelections()[0];
    let from = editor.indexFromPos(sel.head);
    let to = editor.indexFromPos(sel.anchor);

    if (from > to) {
        const _from = from;
        from = to;
        to = _from;
    }

    tracker = startTracking(editor, from, to, { forced: true });
    if (from !== to) {
        tracker.showPreview(editor);
        editor.setSelection(editor.posFromIndex(to));
    }
}
