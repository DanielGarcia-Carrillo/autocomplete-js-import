'use babel'
import provider, {setProjectDeps, hasProjectDeps, getFilesList} from './provider';
import {escapeRegex, getParentDir, not} from './utils';
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

function buildProjectFilesList(files, excludedDirs) {
    atom.project.getPaths().forEach(p => {
        // TODO: make this be able to be any file
        glob(p + '/**/*.{ts,js,jsx,json}', function(err, childPaths) {
            files[p] = childPaths
                // TODO: move this into the glob pattern for efficiency
                .filter(child => !(new RegExp(excludedDirs.map(escapeRegex).join('|'))).test(child))
                .map(child => path.relative(p, child));
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
                    default: ['node_modules']
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

        if (settings.fuzzy.enabled) {
            // TODO: listen for project changes and file additions
            buildProjectFilesList(getFilesList(), settings.fuzzy.excludedDirs);
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
