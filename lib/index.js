'use babel'
import ImportCompletionProvider from './provider';
import ProjectDeps from './project-deps';
import {getParentDir} from './utils';
import settings from './settings';
import fs from 'fs';
import path from 'path';
import glob from 'glob';
import uniq from 'lodash.uniq';

// TODO: check windows compatibility
const PATH_DELIMITER = '/';

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

const PACKAGE_NAME = 'autocomplete-js-import';

export default {
    config: settings,

    filesMap: new Map(),
    projectDeps: new ProjectDeps(),

    _fileWatchers: [],
    _pathListeners: [],
    _settingsObservers: [],

    activate() {
        const settings = atom.config.get(PACKAGE_NAME);
        const projectPaths = atom.project.getPaths();

        this._settingsObservers.push(...['hiddenFiles', 'fuzzy', 'fileRelativePaths', 'projectDependencies'].map(setting =>
            atom.config.onDidChange(`${PACKAGE_NAME}.${setting}`, () => {
                // Just wipe everything and start fresh, relatively expensive but effective
                this.deactivate();
                this.activate();
            })
        ));

        if (settings.fuzzy.enabled) {
            const options = {
                excludedDirs: settings.fuzzy.excludedDirs,
                showHidden: settings.hiddenFiles,
                fileTypes: settings.fuzzy.fileTypes
            };

            // TODO: listen for file additions
            this._buildProjectFilesList(projectPaths, options);

            this._pathListeners.push(atom.project.onDidChangePaths(paths => {
                const newPaths = paths.filter(p => !this.filesMap.has(p));

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
        this._pathListeners.length = 0;

        this._fileWatchers.forEach(watcher => watcher.close());
        this._fileWatchers.length = 0;

        this._settingsObservers.forEach(observer => observer.dispose());
        this._settingsObservers.length = 0;

        // In case of settings change, these references must stay intact for the provide method below to work
        this.filesMap.clear();
        this.projectDeps.clear();
    },

    provide() {
        return new ImportCompletionProvider(this.projectDeps, this.filesMap);
    },

    _buildProjectFilesList(projectPaths, {excludedDirs, fileTypes, showHidden}) {
        projectPaths.forEach(p => {

            // Join together our desired file extensions, like "ts,js,jsx,json"
            // if necessary. Glob will fail if you give it just one extension
            // like "js" so handle that case separately.
            const fileTypeSet = fileTypes.length === 1 ? fileTypes[0] : `{${fileTypes.join(',')}}`;

            // Create our base glob like "/path/to/project/**/*.{ts,js,jsx,json}"
            const globPattern = `${p}/**/*.${fileTypeSet}`;

            // Use the ignore option to exclude the given directories anywhere
            // including a subpath.
            const ignore = excludedDirs.map(dir => `${p}/**/${dir}/**`); // like ["/path/to/project/**/node_modules/**", etc.]

            glob(globPattern, {dot: showHidden, nodir: true, ignore}, (err, childPaths) => {
                this.filesMap.set(
                    p,
                    childPaths
                        // Ensure no empty paths
                        .filter(Boolean)
                        // We want shortest paths to appear first when searching so sort based on total path parts
                        // then alphabetically
                        // E.G Searching for index.js should appear as so:
                        // 1. index.js
                        // 2. some/path/index.js
                        // 3. some/long/path/index.js
                        // 4. some/longer/path/index.js
                        // If we used Glob's output directly, the shortest paths appear last,
                        // which can cause non unique filenames with short paths to be unsearchable
                        .sort((a, b) => {
                            const pathDifference = a.split(PATH_DELIMITER).length - b.split(PATH_DELIMITER).length;

                            if (pathDifference !== 0) {
                                return pathDifference;
                            }

                            return a.localeCompare(b);
                        })
                        .map(child => path.relative(p, child)
                    )
                );
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
