'use babel'
import provider, {setProjectDeps, hasProjectDeps, getFilesMap} from './provider';
import {getParentDir, not} from './utils';
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
    config: {
        projectDependencies: {
            type: 'object',
            title: 'Load project dependencies from package.json. Note: This will adversely affect load performance',
            properties: {
                suggestDev: {
                    title: 'Suggest dev dependencies',
                    type: 'boolean',
                    default: false
                },
                suggestProd: {
                    title: 'Suggest regular dependencies',
                    type: 'boolean',
                    default: false
                }
            }
        },
        fuzzy: {
            type: 'object',
            title: '(Experimental, buggy) Preprocess entire project directory structure to perform fuzzy searching',
            properties: {
                enabled: {
                    title: 'Enabled',
                    type: 'boolean',
                    default: false
                },
                excludedDirs: {
                    title: 'Directories to omit from matching',
                    type: 'array',
                    default: ['node_modules', '.git']
                },
                fileTypes: {
                    title: 'Allowable file types (* for anything)',
                    type: 'array',
                    default: ['ts', 'js', 'jsx', 'json']
                }
            }
        },
        importTypes: {
            type: 'object',
            title: 'Import types for autocompletion',
            properties: {
                es6: {
                    type: 'boolean',
                    default: true,
                    title: 'ES6 style "Import"'
                },
                require: {
                    type: 'boolean',
                    default: true,
                    title: 'Commonjs "require"'
                }
            }
        },
        hiddenFiles: {
            type: 'boolean',
            default: false,
            title: 'Show hidden files (files starting with ".") in suggestions'
        },
        removeExtensions: {
            type: 'array',
            default: ['.js'],
            title: 'Removes extension from suggestion',
            description: 'Import statements can usually autoresolve certain filetypes without providing an extension; '
                + 'this provides the option to drop the extension'
        }
    },

    activate() {
        const settings = atom.config.get('autocomplete-js-import');

        if (!settings.projectDependencies.suggestDev && !settings.projectDependencies.suggestProd) {
            return;
        }

        // TODO: don't make these two mutually exclusive
        if (settings.fuzzy.enabled) {
            const projectPaths = atom.project.getPaths();
            const filesMap = getFilesMap();
            const options = {
                excludedDirs: settings.fuzzy.excludedDirs,
                showHidden: settings.hiddenFiles,
                fileTypes: settings.fuzzy.fileTypes
            };

            // TODO: listen for file additions
            buildProjectFilesList(projectPaths, filesMap, options);

            this._pathsListener = atom.project.onDidChangePaths(function(paths) {
                const newPaths = paths.filter(p => !filesMap[p]);

                buildProjectFilesList(newPaths, filesMap, options);
            });
        } else {
            const paths = atom.project.getPaths();

            searchForProjectDeps(paths, settings.projectDependencies);

            this._pathsListener = atom.project.onDidChangePaths(function(paths) {
                const newProjectPaths = paths.filter(not(hasProjectDeps));

                searchForProjectDeps(newProjectPaths, settings.projectDependencies);
            });
        }
    },

    deactivate() {
        this._pathsListener.dispose();
    },

    provide: () => provider
};
