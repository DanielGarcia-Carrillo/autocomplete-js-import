'use babel';

// These only match prefixes
const REQUIRE_REGEX = /require\(["']([^"']+)/;
const ES6_REGEX = /(?:^import .*?|^}) from ["']([^"';]+)/;

export function capturedDependency(prefix, config) {
    let results = null;

    if (config.es6Import) {
        results = ES6_REGEX.exec(prefix);
    }

    if (!results && config.requireImport) {
        results = REQUIRE_REGEX.exec(prefix);
    }

    if (results && results.length) {
        return results[1];
    }

    return null;
}

// Taken from MDN
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

export function startsWith(base, keyword) {
    const keywordRegex = new RegExp(`^${escapeRegex(keyword)}`);

    return keywordRegex.test(base);
}

export function endsWith(base, keyword) {
    const keywordRegex = new RegExp(`${escapeRegex(keyword)}$`);

    return keywordRegex.test(base);
}
