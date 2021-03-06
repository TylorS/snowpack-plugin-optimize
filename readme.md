# snowpack-plugin-optimize

Makes use of [terser](https://github.com/terser/terser), [csso](https://github.com/css/csso), and [html-minifier](https://github.com/kangax/html-minifier) to provide minification of your JS, CSS, and HTML files
respectively.

## Features

- Minify JS, CSS, and HTML assets
- SourceMap generation w/ remapping support
- Append `<link rel="modulepreload" />` tags to `<head>` to speed up download of dependency tree. 
- TypeScript Declaration file output
- TypeScript Transformer Support
- [TTypescript](https://github.com/cevek/ttypescript) Support for custom compiler plugins

> We're open to new kinds of optimizations, open an issue and lets talk!

## Non-Features

- Bundling - If you're looking for that I'd definitely reccomend the official webpack plugin.

## Install

```sh
npm i --save-dev snowpack-plugin-optimize

yarn add -d snowpack-plugin-optimize
```

## Usage

```js
// snowpack.config.js

module.exports = {
  ...config,
  plugins: [
    [
      'snowpack-plugin-optimize',
      // Entirely optional object. Showing default values
      {
        // Turn JS minification with Terser on/off
        minifyJs?: true
        // A deep merge is performed with these defaults.
        // @see Terser configuration https://github.com/terser/terser#minify-options-structure
        jsOptions?: {
          module: true,
          toplevel: true,
          sourceMap: true,
          nameCache,
          compress: {
            ecma: 2019,
          },
          format: {
            ecma: 2019,
          },
        },
        // Adds modulepreload links to potentially improve your module dependency load times
        modulePreload?: true,
        minifyCss?: true,
        // A merge is performed with these default
        // @see CSSO configuration https://github.com/css/csso#minifysource-options
        cssOptions?: {
          sourceMap: true,
          filename: path.basename(file),
        },
        minifyHtml?: true,
        // A merge is performed with these defaults
        // @see html-minifier configuration https://github.com/kangax/html-minifier#options-quick-reference
        htmlOptions?: {
          collapseWhitespace: true,
          keepClosingSlash: true,
          removeComments: true,
        },
      }
    ]
  ]
}
```