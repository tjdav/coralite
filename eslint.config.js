import stylisticJs from '@stylistic/eslint-plugin-js'
import stylisticPlus from '@stylistic/eslint-plugin-plus'

export default [
  {
    plugins: {
      '@stylistic/js': stylisticJs,
      '@stylistic/plus': stylisticPlus
    },
    rules: {
      '@stylistic/plus/curly-newline': ['error', 'always'],
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
          allowTemplateLiterals: true
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
      '**/playwright-report/'
    ]
  }
]
