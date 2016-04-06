'use babel'
/* eslint-env jasmine */

import {capturedDependency} from '../lib/utils';

function expectCorrectMatches(statement, packageName, config={es6Import: true, requireImport: true}) {
    expect(capturedDependency(statement, config)).toEqual(packageName);
}

describe('Utils', function() {
    describe('capturedDependency', function() {
        const defaultPackageName = 'package-a_x';

        it('handles default import', function() {
            const statement = `import x_a from "${defaultPackageName}"`;

            expectCorrectMatches(statement, defaultPackageName);
        });

        it('handles require', function() {
            const statement = `require('${defaultPackageName}')`;

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

        it(`handles 'as' imports`, function() {
            let statement = `import * as x from '${defaultPackageName}'`;

            expectCorrectMatches(statement, defaultPackageName);

            statement = `import {x_a as someFunc} from '${defaultPackageName}'`;
            expectCorrectMatches(statement, defaultPackageName);
        });

        it('handles destructuring import', function() {
            const statement = `import {x_a} from "${defaultPackageName}"`;

            expectCorrectMatches(statement, defaultPackageName);
        });

        it('handles inlined multi imports', function() {
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
