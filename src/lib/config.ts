import { GlobalConfig } from 'emmet';

export interface EmmetConfig {
    /** Enables abbreviation marking in editor. Works in known syntaxes only */
    mark: boolean;

    /** Enables preview of marked abbreviation */
    preview: boolean;

    /** Mark HTML tag pairs in editor */
    markTagPairs: boolean;

    /**
     * Displays open tag preview when caret is inside its matching closing tag.
     * Preview is displayed only if open tag has attributes.
     * Works only if `markTagPairs` is enabled
     */
    previewOpenTag: boolean;

    /** Allow automatic tag pair rename, works only if `markTagPairs` is enabled */
    autoRenameTags: boolean;

    /** Quotes to use in generated HTML attribute values */
    attributeQuotes: 'single' | 'double';

    /** Style for self-closing elements (like `<br>`) and boolean attributes */
    markupStyle: 'html' | 'xhtml' | 'xml',

    /**
     * Enable automatic tag commenting. When enabled, elements generated from Emmet
     * abbreviation with `id` and/or `class` attributes will receive a comment
     * with these attribute values
     */
    comments: boolean;

    /**
     * Commenting template. Default value is `\n<!-- /[#ID][.CLASS] -->`
     * Outputs everything between `[` and `]` only if specified attribute name
     * (written in UPPERCASE) exists in element. Attribute name is replaced with
     * actual value. Use `\n` to add a newline.
     */
    commentsTemplate?: string;

    /**
     * Enable BEM support. When enabled, Emmet will treat class names starting
     * with `-` as _element_ and with `_` as _modifier_ in BEM notation.
     * These class names will inherit `block` name from current or ancestor element.
     * For example, the abbreviation `ul.nav.nav_secondary>li.nav__item` can be
     * shortened to `ul.nav._secondary>li.-item` with this option enabled.
     */
    bem: boolean;

    /** Advanced Emmet config */
    config?: GlobalConfig;
}

export const defaultConfig: EmmetConfig = {
    mark: true,
    preview: true,
    autoRenameTags: true,
    markTagPairs: true,
    previewOpenTag: false,
    attributeQuotes: 'double',
    markupStyle: 'html',
    comments: false,
    commentsTemplate: '<!-- /[#ID][.CLASS] -->',
    bem: false
};

export default function getEmmetConfig(editor: CodeMirror.Editor, opt?: Partial<EmmetConfig>): EmmetConfig {
    if (!opt) {
        // @ts-ignore Bypass limited options, defined in typings
        opt = editor.getOption('emmet');
    }
    return { ...defaultConfig, ...opt };
}
