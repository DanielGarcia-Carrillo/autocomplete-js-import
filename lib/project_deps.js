'use babel';
import {startsWith} from './utils';

export default class ProjectDeps {
    constructor() {
        this._deps = Object.create(null);
    }

    add(rootPath, deps) {
        this._deps[rootPath] = deps;
    }

    search(currPath, keyword) {
        const rootPaths = Object.keys(this._deps);
        let pathDeps;

        for (let i = 0; i < rootPaths.length; i++) {
            // for the current path to be a child of root, it must start with rootpath
            if (startsWith(currPath, rootPaths[i])) {
                pathDeps = this._deps[rootPaths[i]];
                break;
            }
        }

        if (!pathDeps.length) {
            return [];
        }

        return pathDeps.filter(d => startsWith(d, keyword));
    }
}
