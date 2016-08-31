'use babel'
import ImportCompletionProvider from './provider';
import ProjectDeps from './project-deps';
import {getParentDir} from './utils';
import settings from './settings';
import fs from 'fs';
import path from 'path';
import glob from 'glob';
import uniq from 'lodash.uniq';

function readFilePromise(path) {
    return new Promise(resolve => {
        fs.readFile(path, (err, data) => resolve({
            data,
            dir: getParentDir(path)
        }));
    });
}

function parsePackageJSON(file, projectDeps, {suggestDev, suggestProd}) {
    try {
        const conf = JSON.parse(file.data);
        const deps = [];

        if (conf.dependencies && suggestProd) {
            deps.push(...Object.keys(conf.dependencies));
        }

        if (conf.devDependencies && suggestDev) {
            deps.push(...Object.keys(conf.devDependencies));
        }

        projectDeps.set(file.dir, uniq(deps));
    } catch (e) {
        // this file was probably saved before it was a valid JSON
    }
}

export default {
    config: settings,

    filesMap: Object.create(null),
    projectDeps: new ProjectDeps(),

    _fileWatchers: [],
    _pathListeners: [],

    activate() {
        const settings = atom.config.get('autocomplete-js-import');
        const projectPaths = atom.project.getPaths();

        if (settings.fuzzy.enabled) {
            const options = {
                excludedDirs: settings.fuzzy.excludedDirs,
                showHidden: settings.hiddenFiles,
                fileTypes: settings.fuzzy.fileTypes
            };

            // TODO: listen for file additions
            this._buildProjectFilesList(projectPaths, options);

            this._pathListeners.push(atom.project.onDidChangePaths(paths => {
                const newPaths = paths.filter(p => !this.filesMap[p]);

                this._buildProjectFilesList(newPaths, options);
            }));
        }

        if (settings.projectDependencies.suggestDev || settings.projectDependencies.suggestProd) {
            this._searchForProjectDeps(projectPaths, settings.projectDependencies);

            this._pathListeners.push(atom.project.onDidChangePaths(paths => {
                const newProjectPaths = paths.filter(p => !this.projectDeps.hasDeps(p));

                this._searchForProjectDeps(newProjectPaths, settings.projectDependencies);
            }));
        }
    },

    deactivate() {
        this._pathListeners.forEach(listener => listener.dispose());
        this._fileWatchers.forEach(watcher => watcher.close());
        this.filesMap = null;
        this.projectDeps = null;
    },

    provide() {
        return new ImportCompletionProvider(this.projectDeps, this.filesMap);
    },

    _buildProjectFilesList(projectPaths, {excludedDirs, fileTypes, showHidden}) {
        projectPaths.forEach(p => {
            let fileTypeMatcher = '/*';

            // TODO: put this filematching logic into a utility
            if (fileTypes.length && fileTypes[0] !== '*') {
                fileTypeMatcher += `.{${fileTypes.join(',')}}`
            }

            // the double matching is done to check the top level dir :-/
            let globPattern = '{' + p + fileTypeMatcher + ',' + p;

            // TODO: make this work with non top level dirs
            if (excludedDirs.length) {
                globPattern += `/!(${excludedDirs.join('|')})`;
            }

            globPattern += '/**' + fileTypeMatcher + '}';

            glob(globPattern, {dot: showHidden, nodir: true}, (err, childPaths) => {
                this.filesMap[p] = childPaths.map(child => path.relative(p, child));
            });
        });
    },

    _searchForProjectDeps(projectPaths, packageSettings) {
        if (!projectPaths.length) {
            return;
        }

        const packageExtraction = projectPaths.map(p => {
            const packageConfPath = p + '/package.json';

            return new Promise(resolve => {
                fs.stat(packageConfPath, (err, stats) => resolve({stats, path: packageConfPath}));
            });
        });

        Promise.all(packageExtraction)
            .then(resolved => {
                // Only get the files that exist
                const packageConfs = resolved.filter(r => r.stats && r.stats.isFile());

                return Promise.all(packageConfs.map(conf => {
                    this._fileWatchers.push(fs.watch(conf.path, eventType => {
                        if (eventType === 'change') {
                            return readFilePromise(conf.path)
                                .then(file => parsePackageJSON(file, this.projectDeps, packageSettings));
                        }
                    }));

                    return readFilePromise(conf.path);
                }));
            })
            .then(files => {
                files.forEach(f => parsePackageJSON(f, this.projectDeps, packageSettings));
            })
            .catch(() => {});
    }
}
