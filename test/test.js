const fs = require('fs')
const path = require('path')
const postcss = require('postcss')
const processor = require('../src')
const { generateScopedName } = processor

function generateInvalidCSS(css) {
  css.walkDecls(function(decl) {
    decl.value = decl.value.replace(/_colon_/g, ':') // because using a : in the tests would make it invalid CSS.
  })
}

function normalize(str) {
  return str.replace(/\r\n?/g, '\n').replace(/\n$/, '')
}

var testDir = path.join(__dirname, 'test-cases')
fs.readdirSync(testDir).forEach(function(testCase) {
  if (fs.existsSync(path.join(testDir, testCase, 'source.css'))) {
    it('should ' + testCase.replace(/-/g, ' '), function() {
      var input = normalize(
        fs.readFileSync(path.join(testDir, testCase, 'source.css'), 'utf-8')
      )
      var expected, expectedError
      if (fs.existsSync(path.join(testDir, testCase, 'expected.error.txt'))) {
        expectedError = normalize(
          fs.readFileSync(
            path.join(testDir, testCase, 'expected.error.txt'),
            'utf-8'
          )
        ).split('\n')[0]
      } else {
        expected = normalize(
          fs.readFileSync(path.join(testDir, testCase, 'expected.css'), 'utf-8')
        )
      }
      var config = { from: '/input' }
      var options = {
        generateScopedName: function(exportedName, inputPath) {
          var normalizedPath = inputPath.replace(/^[A-Z]:/, '')
          return generateScopedName(exportedName, normalizedPath)
        }
      }
      if (fs.existsSync(path.join(testDir, testCase, 'config.json'))) {
        config = JSON.parse(
          fs.readFileSync(path.join(testDir, testCase, 'config.json'), 'utf-8')
        )
      }
      if (fs.existsSync(path.join(testDir, testCase, 'options.js'))) {
        options = require(path.join(testDir, testCase, 'options.js'))
      }
      var pipeline = postcss([generateInvalidCSS, processor(options)])
      if (expectedError) {
        expect(() => {
          var result = pipeline.process(input, config).css
        }).toThrowError(RegExp(expectedError))
      } else {
        expect(pipeline.process(input, config).css).toEqual(expected)
      }
    })
  }
})
