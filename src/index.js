import postcss from 'postcss'
import Tokenizer from 'css-selector-tokenizer'
import { extractICSS, createICSSRules } from 'icss-utils'

let hasOwnProperty = Object.prototype.hasOwnProperty

function getSingleLocalNamesForComposes(selectors) {
  return selectors.nodes.map(node => {
    if (node.type !== 'selector' || node.nodes.length !== 1) {
      throw new Error(
        'composition is only allowed when selector is single :local class name not in "' +
          Tokenizer.stringify(selectors) +
          '"'
      )
    }
    node = node.nodes[0]
    if (
      node.type !== 'nested-pseudo-class' ||
      node.name !== 'local' ||
      node.nodes.length !== 1
    ) {
      throw new Error(
        'composition is only allowed when selector is single :local class name not in "' +
          Tokenizer.stringify(selectors) +
          '", "' +
          Tokenizer.stringify(node) +
          '" is weird'
      )
    }
    node = node.nodes[0]
    if (node.type !== 'selector' || node.nodes.length !== 1) {
      throw new Error(
        'composition is only allowed when selector is single :local class name not in "' +
          Tokenizer.stringify(selectors) +
          '", "' +
          Tokenizer.stringify(node) +
          '" is weird'
      )
    }
    node = node.nodes[0]
    if (node.type !== 'class') {
      // 'id' is not possible, because you can't compose ids
      throw new Error(
        'composition is only allowed when selector is single :local class name not in "' +
          Tokenizer.stringify(selectors) +
          '", "' +
          Tokenizer.stringify(node) +
          '" is weird'
      )
    }
    return node.name
  })
}

const defaultGenerateScopedName = function(exportedName, path) {
  let sanitisedPath = path
    .replace(/\.[^\.\/\\]+$/, '')
    .replace(/[\W_]+/g, '_')
    .replace(/^_|_$/g, '')
  return `_${sanitisedPath}__${exportedName}`
}

module.exports = postcss.plugin(
  'postcss-modules-scope',
  (options = {}) => css => {
    let generateScopedName =
      options.generateScopedName || defaultGenerateScopedName

    let exports = {}

    function exportScopedName(name) {
      let scopedName = generateScopedName(
        name,
        css.source.input.from,
        css.source.input.css
      )
      exports[name] = exports[name] || []
      if (exports[name].indexOf(scopedName) === -1) {
        exports[name].push(scopedName)
      }
      return scopedName
    }

    function localizeNode(node) {
      let newNode = Object.create(node)
      switch (node.type) {
        case 'selector':
          newNode.nodes = node.nodes.map(localizeNode)
          return newNode
        case 'class':
        case 'id':
          let scopedName = exportScopedName(node.name)
          newNode.name = scopedName
          return newNode
      }
      throw new Error(
        `${node.type} ("${Tokenizer.stringify(node)}") is not allowed in a :local block`
      )
    }

    function traverseNode(node) {
      switch (node.type) {
        case 'nested-pseudo-class':
          if (node.name === 'local') {
            if (node.nodes.length !== 1) {
              throw new Error('Unexpected comma (",") in :local block')
            }
            return localizeNode(node.nodes[0])
          }
        /* falls through */
        case 'selectors':
        case 'selector':
          let newNode = Object.create(node)
          newNode.nodes = node.nodes.map(traverseNode)
          return newNode
      }
      return node
    }

    // Find any :import and remember imported names
    const { icssImports } = extractICSS(css, false)
    const importedNames = Object.keys(icssImports).reduce((acc, key) => {
      Object.keys(icssImports[key]).forEach(local => {
        acc[local] = true
      })
      return acc
    }, {})

    // Find any :local classes
    css.walkRules(rule => {
      let selector = Tokenizer.parse(rule.selector)
      let newSelector = traverseNode(selector)
      rule.selector = Tokenizer.stringify(newSelector)
      rule.walkDecls(/composes|compose-with/, decl => {
        let localNames = getSingleLocalNamesForComposes(selector)
        let classes = decl.value.split(/\s+/)
        classes.forEach(className => {
          let global = /^global\(([^\)]+)\)$/.exec(className)
          if (global) {
            localNames.forEach(exportedName => {
              exports[exportedName].push(global[1])
            })
          } else if (hasOwnProperty.call(importedNames, className)) {
            localNames.forEach(exportedName => {
              exports[exportedName].push(className)
            })
          } else if (hasOwnProperty.call(exports, className)) {
            localNames.forEach(exportedName => {
              exports[className].forEach(item => {
                exports[exportedName].push(item)
              })
            })
          } else {
            throw decl.error(
              `referenced class name "${className}" in ${decl.prop} not found`
            )
          }
        })
        decl.remove()
      })
    })

    // If we found any :locals, insert an :export rule
    const normalizedExports = Object.keys(exports).reduce((acc, key) => {
      acc[key] = exports[key].join(' ')
      return acc
    }, {})
    css.append(createICSSRules({}, normalizedExports))
  }
)

module.exports.generateScopedName = defaultGenerateScopedName
