'use babel'
import provider, {setProjectDeps, hasProjectDeps, getFilesMap} from './provider';
import {getParentDir, not} from './utils';
import settings from './settings';
import {stat, readFile} from 'fs';
import path from 'path';
import glob from 'glob';

function searchForProjectDeps(paths, packageSettings) {
    if (!paths.length) {
        return;
    }

    const packageExtraction = paths.map(p => {
        const packageConfPath = p + '/package.json';

        return new Promise(resolve => {
            stat(packageConfPath, (err, stats) => resolve({stats, path: packageConfPath}));
        });
    });

    Promise.all(packageExtraction)
        .then(resolved => {
            // Only get the files that exist
            const packageConfs = resolved.filter(r => r.stats && r.stats.isFile());

            return Promise.all(packageConfs.map(conf => {
                return new Promise(resolve => {
                    readFile(conf.path, (err, data) => resolve({
                        data,
                        dir: getParentDir(conf.path)
                    }));
                })
            }));
        })
        .then(files => {
            files.forEach(f => {
                try {
                    const conf = JSON.parse(f.data);
                    const deps = [];

                    if (conf.dependencies && packageSettings.suggestProd) {
                        deps.push(...Object.keys(conf.dependencies));
                    }

                    if (conf.devDependencies && packageSettings.suggestDev) {
                        deps.push(...Object.keys(conf.devDependencies));
                    }

                    setProjectDeps(f.dir, deps);
                } catch (e) {
                    // pass
                }
            });
        })
        .catch(() => {});
}

function buildProjectFilesList(projectPaths, files, {excludedDirs, fileTypes, showHidden}) {
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

        glob(globPattern, {dot: showHidden, nodir: true}, function(err, childPaths) {
            files[p] = childPaths.map(child => path.relative(p, child));
        });
    });
}

export default {
    config: settings,

    _pathListeners: [],

    activate() {
        const settings = atom.config.get('autocomplete-js-import');
        const projectPaths = atom.project.getPaths();

        if (settings.fuzzy.enabled) {
            const filesMap = getFilesMap();
            const options = {
                excludedDirs: settings.fuzzy.excludedDirs,
                showHidden: settings.hiddenFiles,
                fileTypes: settings.fuzzy.fileTypes
            };

            // TODO: listen for file additions
            buildProjectFilesList(projectPaths, filesMap, options);

            this._pathListeners.push(atom.project.onDidChangePaths(function(paths) {
                const newPaths = paths.filter(p => !filesMap[p]);

                buildProjectFilesList(newPaths, filesMap, options);
            }));
        }

        if (settings.projectDependencies.suggestDev || settings.projectDependencies.suggestProd) {
            searchForProjectDeps(projectPaths, settings.projectDependencies);

            this._pathListeners.push(atom.project.onDidChangePaths(function(paths) {
                const newProjectPaths = paths.filter(not(hasProjectDeps));

                searchForProjectDeps(newProjectPaths, settings.projectDependencies);
            }));
        }
    },

    deactivate() {
        this._pathListeners.forEach(listener => listener.dispose());
    },

    provide: () => provider
}
