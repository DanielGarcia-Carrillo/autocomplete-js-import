'use babel'
import provider, {setProjectDeps, hasProjectDeps} from './provider';
import {getParentDir, not} from './utils';
import {stat, readFile} from 'fs';

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

export default {
    config: {
        projectDependencies: {
            type: 'object',
            description: 'Load project dependencies from package.json. Note: This will adversely affect load performance',
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
        es6Import: {
            type: 'boolean',
            default: true,
            title: 'Enable completion for ES6 style import statements'
        },
        requireImport: {
            type: 'boolean',
            default: true,
            title: 'Enable completion for commonjs require statements'
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

        const paths = atom.project.getPaths();

        searchForProjectDeps(paths, settings.projectDependencies);

        this._pathsListener = atom.project.onDidChangePaths(function(paths) {
            const newProjectPaths = paths.filter(not(hasProjectDeps));

            searchForProjectDeps(newProjectPaths, settings.projectDependencies);
        });
    },

    deactivate() {
        this._pathsListener.dispose();
    },

    provide: () => provider
};
