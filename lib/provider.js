'use babel'
import {Range, Point} from 'atom';
import uniq from 'lodash.uniq';
const IMPORT_REGEX = /^import (?:\{\w+\}|\w+) from ["'](.+?)/;

export default {
    selector: '.source.js',
    disableForSelector: '.source.js .comment',

    // Include as higher priority than default auto complete suggestions
    inclusionPriority: 1,

    getSuggestions({editor, bufferPosition}) {
        // TODO: this strategy won't work when the cursor is in the middle
        const prefix = this.getPrefix(editor, bufferPosition);
        const matchResults = IMPORT_REGEX.exec(prefix);

        if (!matchResults) {
            return [];
        }

        const packageName = matchResults[1];

        // TODO: these don't work for more than one level
        if (/^\.\.\//.test(packageName)) {
            return [{text: 'up a directory'}];
        } else if (/^\.\//.test(packageName)) {
            return [{text: 'file from cur dir'}]
        }

        return this.searchDeps(packageName);
    },

    searchDeps(keyword) {
        const keywordRegex = new RegExp(`^${this._escapeRegExp(keyword)}`, 'i');

        return this._deps.filter(d => keywordRegex.test(d)).map(d => {
            return {text: d};
        });
    },

    _escapeRegExp(string){
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
    },
    getPrefix(editor, {row, column}) {
        const prefixRange = new Range(new Point(row, 0), new Point(row, column));

        return editor.getTextInBufferRange(prefixRange);
    },

    setPackageDeps(deps) {
        // TODO: this won't work after first open or will be slow because of reload, depending on event
        this._deps = uniq(deps);
    }
};
