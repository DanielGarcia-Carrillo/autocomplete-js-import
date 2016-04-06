'use babel'
/* eslint-env jasmine */

import {IMPORT_REGEX} from '../lib/utils';

function expectCorrectMatches(statement, packageName) {
    const matches = IMPORT_REGEX.exec(statement);

    expect(matches).not.toBe(null);
    // only full line and package name should be captured
    expect(matches.length).toEqual(2);
    expect(matches[1]).toEqual(packageName);
}

describe('Utils', function() {
    describe('IMPORT_REGEX', function() {
        const defaultPackageName = 'package-a_x';

        it('handles default import', function() {
            const statement = `import x_a from "${defaultPackageName}"`;

            expectCorrectMatches(statement, defaultPackageName);
        });

        it('handles many package name types', function() {
            [
                'package-a',
                'package_b',
                'package.util',
                '../../lib/index.js',
                './stuff/blah'
            ].forEach(packageName => {
                [
                    `import x from "${packageName}"`,
                    // no closing quotation mark
                    `import x from "${packageName}`,
                    `import x from '${packageName}'`
                ].forEach(importStatement => {
                    expectCorrectMatches(importStatement, packageName);
                });
            });
        });

        xit(`handles 'as' imports`, function() {
            let statement = `import * as x from '${defaultPackageName}'`;

            expectCorrectMatches(statement, defaultPackageName);

            statement = `import {x_a as someFunc} from '${defaultPackageName}'`;
            expectCorrectMatches(statement, defaultPackageName);
        });

        it('handles destructuring import', function() {
            const statement = `import {x_a} from "${defaultPackageName}"`;

            expectCorrectMatches(statement, defaultPackageName);
        });

        xit('handles inlined multi imports', function() {
            let statement = `import def, {x_a} from "${defaultPackageName}"`;

            expectCorrectMatches(statement, defaultPackageName);

            statement = `import {x_a, x_b} from "${defaultPackageName}"`;
            expectCorrectMatches(statement, defaultPackageName);
        });

        it('handles multiline import statement', function() {
            // Regex is only meant for prefix so this only tests against last line of import statement
            const importStatement = `} from "${defaultPackageName}"`;

            expectCorrectMatches(importStatement, defaultPackageName);
        });
    });
});
