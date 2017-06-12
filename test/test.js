/* eslint-env jest */
import postcss from "postcss";
import stripIndent from "strip-indent";
import plugin from "../src";

const messagesPlugin = messages => (css, result) =>
  result.messages.push(...messages);

const compile = (fixture, messages) =>
  postcss([messagesPlugin(messages), plugin]).process(fixture);

const strip = input => stripIndent(input).trim();

const getWarnings = result => result.warnings().map(warning => warning.text);

const getMessages = result =>
  result.messages.filter(msg => msg.type !== "warning");

const run = ({
  fixture,
  messages = [],
  expected,
  outputMessages = [],
  warnings = []
}) =>
  compile(strip(fixture), messages).then(result => {
    expect(getWarnings(result)).toEqual(warnings);
    expect(getMessages(result)).toEqual(outputMessages);
    expect(result.css.trim()).toEqual(strip(expected));
  });

test("skip rules without composes property", () => {
  return run({
    fixture: `
      .className1 .className2 {}
    `,
    expected: `
      .className1 .className2 {}
    `
  });
});

test("warn on composes in local id", () => {
  return run({
    fixture: `
      #idName {
        composes: className;
      }
      :local(#idName) {
        composes: className;
      }
    `,
    expected: `
      #idName {
      }
      :local(#idName) {
      }
    `,
    warnings: [
      "composition is only allowed in single class selector, not in '#idName'",
      "composition is only allowed in single class selector, not in ':local(#idName)'"
    ]
  });
});

test("warn on composes in multiple classes", () => {
  return run({
    fixture: `
      .a .b {
        composes: className;
      }
      .a.b {
        composes: className;
      }
      :local(.a .b) {
        composes: className;
      }
      :local(.a.b) {
        composes: className;
      }
    `,
    expected: `
      .a .b {
      }
      .a.b {
      }
      :local(.a .b) {
      }
      :local(.a.b) {
      }
    `,
    warnings: [
      "composition is only allowed in single class selector, not in '.a .b'",
      "composition is only allowed in single class selector, not in '.a.b'",
      "composition is only allowed in single class selector, not in ':local(.a .b)'",
      "composition is only allowed in single class selector, not in ':local(.a.b)'"
    ]
  });
});

test("warn on composes in tag", () => {
  return run({
    fixture: `
      body {
        composes: className;
      }
      .class body {
        composes: className;
      }
      :local(body) {
        composes: className;
      }
      :local(.class body) {
        composes: className;
      }
    `,
    expected: `
      body {
      }
      .class body {
      }
      :local(body) {
      }
      :local(.class body) {
      }
    `,
    warnings: [
      "composition is only allowed in single class selector, not in 'body'",
      "composition is only allowed in single class selector, not in '.class body'",
      "composition is only allowed in single class selector, not in ':local(body)'",
      "composition is only allowed in single class selector, not in ':local(.class body)'"
    ]
  });
});

test("compose class", () => {
  return run({
    fixture: `
      .className1 {
        composes: otherClassName;
      }
      :local(.className2) {
        composes: otherClassName;
      }
    `,
    expected: `
      :export {
        className1: className1 otherClassName;
        className2: className2 otherClassName
      }
      .className1 {
      }
      :local(.className2) {
      }
    `,
    outputMessages: [
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "className1",
        value: "otherClassName"
      },
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "className2",
        value: "otherClassName"
      }
    ]
  });
});

test("allow compose-with property", () => {
  return run({
    fixture: `
      .className {
        compose-with: otherClassName;
      }
    `,
    expected: `
      :export {
        className: className otherClassName
      }
      .className {
      }
    `,
    outputMessages: [
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "className",
        value: "otherClassName"
      }
    ]
  });
});

test("compose multiple classes", () => {
  return run({
    fixture: `
      .className {
        composes: otherClassName1 otherClassName2
      }
    `,
    expected: `
      :export {
        className: className otherClassName1 otherClassName2
      }
      .className {
      }
    `,
    outputMessages: [
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "className",
        value: "otherClassName1"
      },
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "className",
        value: "otherClassName2"
      }
    ]
  });
});

test("compose multiple properties", () => {
  return run({
    fixture: `
      .className {
        composes: otherClassName1;
        composes: otherClassName2;
      }
    `,
    expected: `
      :export {
        className: className otherClassName1 otherClassName2
      }
      .className {
      }
    `,
    outputMessages: [
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "className",
        value: "otherClassName1"
      },
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "className",
        value: "otherClassName2"
      }
    ]
  });
});

test("icss-scoped contract", () => {
  const messages = [
    {
      plugin: "previous-plugin",
      type: "icss-scoped",
      name: "className",
      value: "__scope__className"
    },
    {
      plugin: "previous-plugin",
      type: "icss-scoped",
      name: "otherClassName",
      value: "__scope__otherClassName"
    }
  ];
  return run({
    fixture: `
      .className {
        composes: otherClassName;
      }
    `,
    messages,
    expected: `
      :export {
        className: __scope__className __scope__otherClassName
      }
      .className {
      }
    `,
    outputMessages: [
      ...messages,
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "className",
        value: "otherClassName"
      }
    ]
  });
});
