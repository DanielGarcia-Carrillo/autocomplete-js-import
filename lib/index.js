'use babel'
import provider from './provider';
import {stat, readFile} from 'fs';
import {CompositeDisposable} from 'atom';

export default {
    activate() {
        this._subs = new CompositeDisposable();
        const paths = atom.project.getPaths();
        const packageExtraction = paths.map(p => {
            const packageConfPath = p + '/package.json';

            return new Promise(resolve => {
                stat(packageConfPath, (err, stats) => resolve({stats, path: packageConfPath}));
            });
        });

        const deps = [];

        // TODO: this doesn't update upon opening new directories
        Promise.all(packageExtraction)
            .then(resolved => {
                const packageConfs = resolved.filter(r => r.stats && r.stats.isFile());

                return Promise.all(packageConfs.map(conf => {
                    return new Promise(resolve => {
                        readFile(conf.path, (err, data) => resolve(data));
                    })
                }));
            })
            .then(files => {
                files.forEach(f => {
                    try {
                        const conf = JSON.parse(f);

                        if (conf.dependencies) {
                            deps.push(Object.keys(conf.dependencies));
                        }

                        // TODO: put this behind a setting
                        if (conf.devDependencies) {
                            deps.push(Object.keys(conf.devDependencies));
                        }
                    } catch (e) {
                        // pass
                    }
                });
            })
            .then(() => {
                if (deps.length) {
                    provider.setPackageDeps(deps);
                }
            });
    },

    deactivate() {
        this._subs.dispose();
    },

    provide: () => provider
};
