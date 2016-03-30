'use babel'
import provider, {setProjectDeps} from './provider';
import {stat, readFile} from 'fs';

export default {
    activate() {
        const paths = atom.project.getPaths();
        const packageExtraction = paths.map(p => {
            const packageConfPath = p + '/package.json';

            return new Promise(resolve => {
                stat(packageConfPath, (err, stats) => resolve({stats, path: packageConfPath}));
            });
        });

        // TODO: this doesn't update upon opening new directories
        // TODO: also doesn't autocomplete node builtins
        // TODO: use activation state to avoid this big ass promise (may result in stale data if edited outside of atom or git pull)
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

                        if (conf.dependencies) {
                            deps.push(...Object.keys(conf.dependencies));
                        }

                        // TODO: put this behind a setting
                        if (conf.devDependencies) {
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
