'use babel';

// This only matches prefixes
export const IMPORT_REGEX = /(?:^import .*?|^}) from ["']([^"';]+)/;

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
