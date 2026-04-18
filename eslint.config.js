import stylisticJs from '@stylistic/eslint-plugin'
import jsdoc from 'eslint-plugin-jsdoc'
import html from 'eslint-plugin-html'

export default [
  {
    files: ['**/*.html', '**/*.js'],
    plugins: {
      '@stylistic/js': stylisticJs,
      jsdoc,
      html
    },
    settings: {
      jsdoc: {
        exemptDestructuredRootsFromChecks: true
      }
    },
    rules: {
      'no-inline-comments': 'error',
      curly: ['error', 'all'],
      'no-nested-ternary': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ChainExpression MemberExpression[optional=true] > MemberExpression[optional=true] > MemberExpression[optional=true]',
          message: 'Avoid deep optional chaining. Validate data existence earlier using standard if statements.'
        }
      ],
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true
          }
        }
      ],
      'jsdoc/check-tag-names': [
        'warn',
        {
          definedTags: [
            'note',
            'overload',
            'query-parameters',
            'returns-error',
            'returns-response',
            'returns-success',
            'supported-operators',
            'supported-values'
          ]
        }
      ],
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-param-type': 'error',
      'jsdoc/check-syntax': 'error',
      'jsdoc/no-undefined-types': [
        'error',
        {
          definedTypes: [
            'Buffer',
            'DOMHighResTimeStamp',
            'Element',
            'File',
            'FormData',
            'HTMLCollection',
            'HTMLElement',
            'HTMLFormControlsCollection',
            'Node',
            'NodeJS',
            'TestContext',
            'validateSchemaArray',
            'validateSchemaArrayOption',
            'validateSchemaObject',
            'validateSchemaObjectOption',
            'validateSchemaObjectProperties',
            'AsyncGenerator',
            'AbortSignal'
          ]
        }
      ],
      '@stylistic/js/curly-newline': ['error', 'always'],
      '@stylistic/js/indent': [
        'error', 2, {
          SwitchCase: 1,
          VariableDeclarator: 1,
          outerIIFEBody: 1,
          MemberExpression: 1,
          FunctionExpression: {
            body: 1,
            parameters: 1
          },
          CallExpression: {
            arguments: 1
          },
          ArrayExpression: 1,
          ObjectExpression: 1,
          ImportDeclaration: 1,
          flatTernaryExpressions: true,
          ignoreComments: false
        }
      ],
      '@stylistic/js/object-curly-spacing': ['error', 'always'],
      '@stylistic/js/object-property-newline': 'error',
      '@stylistic/js/object-curly-newline': ['error', {
        ObjectExpression: {
          multiline: true,
          consistent: true
        },
        ObjectPattern: {
          multiline: true,
          consistent: true
        },
        ImportDeclaration: {
          multiline: true,
          consistent: true
        },
        ExportDeclaration: {
          multiline: true,
          consistent: true
        }
      }],
      '@stylistic/js/quote-props': ['error', 'as-needed'],
      '@stylistic/js/space-before-function-paren': ['error', 'always'],
      '@stylistic/js/function-call-spacing': ['error', 'never'],
      '@stylistic/js/implicit-arrow-linebreak': ['error', 'beside'],
      '@stylistic/js/eol-last': ['error', 'always'],
      '@stylistic/js/brace-style': [
        'error', '1tbs', {
          allowSingleLine: false
        }
      ],
      '@stylistic/js/semi': ['error', 'never'],
      '@stylistic/js/quotes': [
        'error', 'single', {
          avoidEscape: true,
          allowTemplateLiterals: 'always'
        }
      ],
      '@stylistic/js/comma-dangle': ['error', 'never'],
      '@stylistic/js/comma-spacing': [
        'error', {
          before: false,
          after: true
        }
      ],
      '@stylistic/js/comma-style': ['error', 'last'],
      '@stylistic/js/array-bracket-spacing': ['error', 'never'],
      '@stylistic/js/array-bracket-newline': ['error', 'consistent'],
      '@stylistic/js/array-element-newline': ['error', 'consistent'],
      '@stylistic/js/computed-property-spacing': ['error', 'never'],
      '@stylistic/js/no-mixed-operators': [
        'error',
        {
          groups: [
            [
              '+', '-', '*', '/', '%', '**'
            ],
            [
              '&', '|', '^', '~', '<<', '>>', '>>>'
            ],
            [
              '==', '!=', '===', '!==', '>', '>=', '<', '<='
            ],
            ['&&', '||'],
            ['in', 'instanceof']
          ],
          allowSamePrecedence: false
        }
      ],
      '@stylistic/js/key-spacing': [
        'error', {
          mode: 'strict'
        }
      ],
      '@stylistic/js/no-trailing-spaces': 'error',
      '@stylistic/js/no-multi-spaces': 'error',
      '@stylistic/js/no-confusing-arrow': 'error'
    }
  },
  {
    ignores: [
      '**/dist/',
      '**/.history/',
      '**/playwright-report/',
      '**/.coralite/'
    ]
  }
]
