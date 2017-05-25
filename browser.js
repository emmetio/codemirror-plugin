'use strict';

import registerEmmetExtension from './extension.js';

if (typeof CodeMirror !== 'undefined') {
	registerEmmetExtension(CodeMirror);
}
