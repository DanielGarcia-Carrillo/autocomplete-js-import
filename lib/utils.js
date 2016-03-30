'use babel';

// This only matches prefixes TODO: multi statement imports inline
export const IMPORT_REGEX = /(?:^import (?:\{\w+\}|\w+)|^}) from ["']([^"';]+)/;

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
