# postcss-icss-composes [![Build Status][travis-img]][travis]

[PostCSS]: https://github.com/postcss/postcss
[travis-img]: https://travis-ci.org/css-modules/postcss-icss-composes.svg
[travis]: https://travis-ci.org/css-modules/postcss-icss-composes

PostCSS plugin for css modules to compose local-scope classes

## Usage

```js
postcss([require('postcss-icss-composes')])
```

See [PostCSS] docs for examples for your environment.

### Local class composition

`composes` and `compose-with` combines specified class name with rule class name.

```css
.buttonStyle {
  background: #fff;
}
.buttonStyle:hover {
  box-shadow: 0 0 4px -2px;
}
.cellStyle {
  margin: 10px;
}
.addButton {
  composes: buttonStyle cellStyle;
  color: green;
}

/* becomes */

:export {
  buttonStyle: buttonStyle;
  cellStyle: cellStyle;
  addButton: addButton buttonStyle cellStyle
}
.buttonStyle {
  background: #fff;
}
.buttonStyle:hover {
  box-shadow: 0 0 4px -2px;
}
.cellStyle {
  margin: 10px;
}
.addButton {
  color: green;
}
```

### Global class composition

You may use any identifier for composition

```css
.addButton {
  composes: globalButtonStyle;
  background: #000;
}

/* becomes */
:export {
  addButton: addButton globalButtonStyle
}
.addButton {
  background: #000;
}
```

### Scoping class names

[postcss-icss-selectors](https://github.com/css-modules/postcss-icss-selectors) plugin allows to local-scope classes.

```css
.buttonStyle {
  background: #fff;
}
.addButton {
  composes: buttonStyle;
  border: 1px solid #000;
}

/* becomes */

:export {
  buttonStyle: __scope__buttonStyle;
  addButton: __scope__addButton __scope__buttonStyle
}
.__scope__buttonStyle {
  background: #fff;
}
.__scope__addButton {
  border: 1px solid #000;
}
```

### External composition

```css
/* compositions.css */
.button {
  background: #fff;
  border: 1px solid #000;
}
.cell {
  margin: 10px;
}

/* main.css */
.addButton {
  composes: button cell from './composition.css';
  font-size: 20px;
}
```

### Messages

postcss-icss-composes passes result.messages for each composed class name

```js
{
  plugin: 'postcss-icss-composes',
  type: 'icss-composed',
  name: string, // rule class name
  value: string // composed class name
}
```

## License

MIT © Glen Maddern and Bogdan Chadkin, 2015
