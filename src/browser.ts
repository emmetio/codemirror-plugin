import registerEmmetExtension from './extension';

if (typeof window.CodeMirror !== 'undefined') {
    registerEmmetExtension(window.CodeMirror);
}
