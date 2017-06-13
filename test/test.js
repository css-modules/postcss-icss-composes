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

test("warn on composes in @media", () => {
  return run({
    fixture: `
      @media print {
        .className {
          composes: otherClassName;
        }
        .empty {}
      }
    `,
    expected: `
      :export {
        className: className otherClassName
      }
      @media print {
        .className {
        }
        .empty {}
      }
    `,
    outputMessages: [
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "className",
        value: "otherClassName"
      }
    ],
    warnings: [
      "composition cannot be conditional and is not allowed in media queries"
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

test("compose from file", () => {
  return run({
    fixture: `
      .a {
        composes: b from 'path';
        composes: c from "path";
      }
    `,
    expected: `
      :import('path') {
        __composed__b__0: b;
        __composed__c__1: c
      }
      :export {
        a: a __composed__b__0 __composed__c__1
      }
      .a {
      }
    `,
    outputMessages: [
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "a",
        value: "__composed__b__0"
      },
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "a",
        value: "__composed__c__1"
      }
    ]
  });
});

test("compose multiple from file", () => {
  return run({
    fixture: `
      .a {
        composes: b c from 'path';
      }
    `,
    expected: `
      :import('path') {
        __composed__b__0: b;
        __composed__c__1: c
      }
      :export {
        a: a __composed__b__0 __composed__c__1
      }
      .a {
      }
    `,
    outputMessages: [
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "a",
        value: "__composed__b__0"
      },
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "a",
        value: "__composed__c__1"
      }
    ]
  });
});

test("save existing :import and :export", () => {
  return run({
    fixture: `
      :import('path') {
        __a: b
      }
      :export {
        a: __a
      }
      .c {
        composes: d from 'path';
      }
    `,
    expected: `
      :import('path') {
        __a: b;
        __composed__d__0: d
      }
      :export {
        a: __a;
        c: c __composed__d__0
      }
      .c {
      }
    `,
    outputMessages: [
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "c",
        value: "__composed__d__0"
      }
    ]
  });
});

test("resolve external composes order", () => {
  return run({
    fixture: `
      .a {
        composes: c from './c.css';
      }
      .b {
        /* 'b' should be after 'c' */
        composes: d from './d.css';
        composes: c from './c.css';
      }
    `,
    expected: `
      :import('./c.css') {
        __composed__c__0: c
      }
      :import('./d.css') {
        __composed__d__1: d
      }
      :export {
        a: a __composed__c__0;
        b: b __composed__d__1 __composed__c__0
      }
      .a {
      }
      .b {
        /* 'b' should be after 'c' */
      }
    `,
    outputMessages: [
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "a",
        value: "__composed__c__0"
      },
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "b",
        value: "__composed__d__1"
      },
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "b",
        value: "__composed__c__0"
      }
    ]
  });
});

test("resolve composes with the same name from different files", () => {
  return run({
    fixture: `
      .a {
        composes: b from './b1.css';
        composes: b from './b2.css';
      }
    `,
    expected: `
      :import('./b1.css') {
        __composed__b__0: b
      }
      :import('./b2.css') {
        __composed__b__1: b
      }
      :export {
        a: a __composed__b__0 __composed__b__1
      }
      .a {
      }
    `,
    outputMessages: [
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "a",
        value: "__composed__b__0"
      },
      {
        plugin: "postcss-icss-composes",
        type: "icss-composed",
        name: "a",
        value: "__composed__b__1"
      }
    ]
  });
});
