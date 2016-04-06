'use babel'
import provider, {setProjectDeps} from './provider';
import {stat, readFile} from 'fs';

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
        hide_hidden_files: {
            type: 'boolean',
            default: true
        }
    },

    activate() {
        const settings = atom.config.get('autocomplete-js-import');

        if (!settings.projectDependencies.suggestDev && !settings.projectDependencies.suggestProd) {
            return;
        }

        const paths = atom.project.getPaths();
        const packageExtraction = paths.map(p => {
            const packageConfPath = p + '/package.json';

            return new Promise(resolve => {
                stat(packageConfPath, (err, stats) => resolve({stats, path: packageConfPath}));
            });
        });

        // TODO: this doesn't update upon opening new directories
        // TODO: also doesn't autocomplete node builtins
        Promise.all(packageExtraction)
            .then(resolved => {
                // Only get the files that exist
                const packageConfs = resolved.filter(r => r.stats && r.stats.isFile());

                return Promise.all(packageConfs.map(conf => {
                    return new Promise(resolve => {
                        readFile(conf.path, (err, data) => resolve({
                            data,
                            dir: conf.path.substring(0, conf.path.length - '/package.json'.length)
                        }));
                    })
                }));
            })
            .then(files => {
                files.forEach(f => {
                    try {
                        const conf = JSON.parse(f.data);
                        const deps = [];

                        if (conf.dependencies && settings.projectDependencies.suggestProd) {
                            deps.push(...Object.keys(conf.dependencies));
                        }

                        if (conf.devDependencies && settings.projectDependencies.suggestDev) {
                            deps.push(...Object.keys(conf.devDependencies));
                        }

                        setProjectDeps(f.dir, deps);
                    } catch (e) {
                        // pass
                    }
                });
            });
    },

    provide: () => provider
};
