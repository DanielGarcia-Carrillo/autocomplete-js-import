'use babel'
import {Range, Point} from 'atom';
import path from 'path';
import fs from 'fs';
import uniq from 'lodash.uniq';
// This only matches prefixes
const IMPORT_REGEX = /^import (?:\{\w+\}|\w+) from ["']([^"';]+)/;

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

function startsWith(base, keyword) {
    const keywordRegex = new RegExp(`^${escapeRegex(keyword)}`);

    return keywordRegex.test(base);
}

function endsWith(base, keyword) {
    const keywordRegex = new RegExp(`${escapeRegex(keyword)}$`);

    return keywordRegex.test(base);
}

export default {
    selector: '.source.js',
    disableForSelector: '.source.js .comment',

    // Include as higher priority than default auto complete suggestions
    inclusionPriority: 1,

    getSuggestions({editor, bufferPosition}) {
        return new Promise(resolve => {
            // TODO: this strategy won't work when the cursor is in the middle
            const prefix = this.getPrefix(editor, bufferPosition);
            const matchResults = IMPORT_REGEX.exec(prefix);

            if (!matchResults) {
                return resolve([]);
            }

            // Get the capture group with package in it
            const packageName = matchResults[1];

            // TODO: these don't work for more than one level
            // checks for packages starting with name ../ or ./
            if (/^\.{1,2}\//.test(packageName)) {
                const pathParts = packageName.split('/');
                const toComplete = pathParts.pop();
                // TODO: this sucks
                let fileDirPath = editor.getPath().split('/');
                fileDirPath.pop();
                fileDirPath = fileDirPath.join('/');

                const absolutePath = path.resolve(fileDirPath, pathParts.join('/'));

                return resolve(new Promise(resolve => {
                    fs.readdir(absolutePath, (err, files) => {
                        if (!files) {
                            return resolve([]);
                        }

                        // Find only files that start with inputted letters and not hidden ones
                        resolve(files.filter(f => startsWith(f, toComplete)).filter(f => !startsWith(f, '.')).map(d => {
                            if (endsWith(d, '.js')) {
                                // cut off three characters at end
                                d = d.substring(0, d.length - 3);
                            }

                            return {text: d};
                        }))
                    });
                }).catch(() => {/* TODO: shit happens */}));
            } else if (/^[^._]/.test(packageName)) {
                // ^ regex taken from npm naming spec: https://docs.npmjs.com/files/package.json
                return resolve(this.searchDeps(packageName));
            }

            resolve([]);
        }).catch(() => {
            // because shit happens and I need to get work done
        });
    },

    searchDeps(keyword) {
        return this._deps.filter(d => startsWith(d, keyword)).map(d => {
            return {text: d};
        });
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
