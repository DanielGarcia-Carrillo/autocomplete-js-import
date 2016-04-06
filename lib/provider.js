'use babel'
import {Range, Point} from 'atom';
import {endsWith, startsWith, capturedDependency} from './utils';
import ProjectDeps from './project_deps';
import path from 'path';
import fs from 'fs';
import uniq from 'lodash.uniq';

const projectDeps = new ProjectDeps();

export function setProjectDeps(path, deps) {
    projectDeps.add(path, uniq(deps));
}

export default {
    selector: '.source.js',
    disableForSelector: '.source.js .comment',

    // Include as higher priority than default auto complete suggestions
    inclusionPriority: 1,

    getSuggestions({editor, bufferPosition}) {
        return Promise.resolve()
            .then(() => {
                // TODO: this strategy won't work when the cursor is in the middle
                const prefix = this._getPrefix(editor, bufferPosition);
                const packageName = capturedDependency(prefix, atom.config.get('autocomplete-js-import'));

                if (!packageName) {
                    return [];
                }

                // checks for packages starting with name ../ or ./
                if (/^\.{1,2}\//.test(packageName)) {
                    const pathParts = packageName.split('/');
                    const toComplete = pathParts.pop();
                    // TODO: this sucks
                    let fileDirPath = editor.getPath().split('/');
                    fileDirPath.pop();
                    fileDirPath = fileDirPath.join('/');

                    const absolutePath = path.resolve(fileDirPath, pathParts.join('/'));

                    return new Promise(resolve => {
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

                                return d;
                            }))
                        });
                    }).catch(() => {/* shit happens */});
                } else if (/^[^._]/.test(packageName)) {
                    const deps = projectDeps.search(editor.getPath(), packageName);
                    // ^ regex taken from npm naming spec: https://docs.npmjs.com/files/package.json
                    if (deps.length) {
                        return deps;
                    }
                }

                return [];
            })
            .then(completions => {
                if (completions && completions.length) {
                    return completions.map(c => ({text: c}));
                }

                return [];
            })
            .catch(() => {
                // because shit happens and I need to get work done
            });
    },

    _getPrefix(editor, {row, column}) {
        const prefixRange = new Range(new Point(row, 0), new Point(row, column));

        return editor.getTextInBufferRange(prefixRange);
    }
};
