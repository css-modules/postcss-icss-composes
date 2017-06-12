/* eslint-env node */
import postcss from "postcss";
import Tokenizer from "css-selector-tokenizer";
import { extractICSS, createICSSRules } from "icss-utils";

const plugin = "postcss-icss-composes";

const isSingular = node => node.nodes.length === 1;

const isLocal = node =>
  node.type === "nested-pseudo-class" && node.name === "local";

const isClass = node => node.type === "class";

const getSelectorIdentifier = selector => {
  if (!isSingular(selector)) {
    return null;
  }
  const [node] = selector.nodes;
  if (isLocal(node)) {
    const local = node.nodes[0];
    if (isSingular(local) && isClass(local.nodes[0])) {
      return local.nodes[0].name;
    }
    return null;
  }
  if (isClass(node)) {
    return node.name;
  }
  return null;
};

const getIdentifiers = (rule, result) => {
  const selectors = Tokenizer.parse(rule.selector).nodes;
  return selectors
    .map(selector => {
      const identifier = getSelectorIdentifier(selector);
      if (identifier === null) {
        result.warn(
          `composition is only allowed in single class selector, not in '${Tokenizer.stringify(selector)}'`,
          { node: rule }
        );
      }
      return identifier;
    })
    .filter(identifier => identifier !== null);
};

const walkComposes = (css, callback) =>
  css.walkRules(rule => {
    rule.each(node => {
      if (node.type === "decl" && /^(composes|compose-with)$/.test(node.prop)) {
        callback(rule, node);
      }
    });
  });

const flatten = outer => outer.reduce((acc, inner) => [...acc, ...inner], []);

const combineIntoMessages = (classes, composed) =>
  flatten(
    classes.map(name =>
      composed.map(value => ({
        plugin,
        type: "icss-composed",
        name,
        value
      }))
    )
  );

const convertMessagesToExports = (messages, aliases) =>
  messages
    .map(msg => msg.name)
    .reduce(
      (acc, name) => (acc.indexOf(name) === -1 ? [...acc, name] : acc),
      []
    )
    .reduce(
      (acc, name) =>
        Object.assign({}, acc, {
          [name]: [
            aliases[name] || name,
            ...messages
              .filter(msg => msg.name === name)
              .map(msg => aliases[msg.value] || msg.value)
          ].join(" ")
        }),
      {}
    );

const getScopedClasses = messages =>
  messages
    .filter(msg => msg.type === "icss-scoped")
    .reduce(
      (acc, msg) => Object.assign({}, acc, { [msg.name]: msg.value }),
      {}
    );

module.exports = postcss.plugin(plugin, () => (css, result) => {
  const scopedClasses = getScopedClasses(result.messages);
  const composedMessages = [];

  const { icssImports, icssExports } = extractICSS(css);

  walkComposes(css, (rule, decl) => {
    const classes = getIdentifiers(rule, result);
    const composed = decl.value.split(/\s+/);
    composedMessages.push(...combineIntoMessages(classes, composed));
    decl.remove();
  });

  const compositionExports = convertMessagesToExports(
    composedMessages,
    scopedClasses
  );
  const exports = Object.assign({}, icssExports, compositionExports);
  css.prepend(createICSSRules(icssImports, exports));
  result.messages.push(...composedMessages);
});
