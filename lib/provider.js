'use babel'
import {Range, Point} from 'atom';
import {
    startsWith,
    capturedDependency,
    not,
    isHiddenFile,
    matchesNPMNaming,
    dropExtensions,
    getParentDir,
    getDirAndFilePrefix
 } from './utils';
import ProjectDeps from './project_deps';
import path from 'path';
import fs from 'fs';
import uniq from 'lodash.uniq';

// Singleton map of project roots => package.json deps
const projectDeps = new ProjectDeps();

export function setProjectDeps(path, deps) {
    projectDeps.add(path, uniq(deps));
}

export function hasProjectDeps(path) {
    return projectDeps.hasDeps(path);
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
                const settings = atom.config.get('autocomplete-js-import');
                const packageName = capturedDependency(prefix, settings.importTypes);

                if (!packageName) {
                    return [];
                }

                // checks for packages starting with name ../ or ./
                if (/^\.{1,2}\//.test(packageName)) {
                    const [inputtedRelativePath, toComplete] = getDirAndFilePrefix(packageName);
                    const currentDirPath = getParentDir(editor.getPath());
                    const absolutePath = path.resolve(currentDirPath, inputtedRelativePath);

                    return new Promise(resolve => {
                        fs.readdir(absolutePath, (err, files) => {
                            if (!files) {
                                return resolve([]);
                            }

                            let matchingFiles = files.filter(f => startsWith(f, toComplete));

                            if (!settings.hiddenFiles) {
                                matchingFiles = matchingFiles.filter(not(isHiddenFile));
                            }

                            resolve(matchingFiles.map(d => dropExtensions(d, settings.removeExtensions)))
                        });
                    }).catch(() => {/* shit happens */});
                } else if (matchesNPMNaming(packageName)) {
                    const deps = projectDeps.search(editor.getPath(), packageName);

                    if (deps.length) {
                        return deps;
                    }
                }
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
