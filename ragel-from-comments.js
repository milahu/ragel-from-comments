/*
extract ragel code from C comments

install dependencies:
npm install tree-sitter tree-sitter-c magic-string

usage:
node ragel-from-comments.js path/to/inputfile.ragel.c

license: CC0-1.0
*/

// input: /* %ragel { ... } */
// output: %%{ ... }

// https://github.com/tree-sitter/node-tree-sitter/blob/master/tree-sitter.d.ts
const TreeSitter = require('tree-sitter');
const TreeSitterC = require('tree-sitter-c');
var MagicString = require('magic-string');
const fs = require('fs');

process.argv.shift(); // argv[0] is node interpreter ...
const inputPath = process.argv[1];
const basename = path => path.split("/").pop();
if (inputPath == undefined) {
  console.log(`usage: node ${basename(process.argv[0])} path/to/inputfile.rl.c`)
  process.exit(1);
}
if (!fs.existsSync(inputPath)) {
  console.log(`no such file: ${inputPath}`)
  process.exit(1);
}
if (!(inputPath.endsWith('.ragel.c') || inputPath.endsWith('.rl.c'))) {
  console.log(`wrong file extension: ${inputPath}`)
  console.log(`expected .ragel.c or .rl.c`)
  process.exit(1);
}
const basePath = inputPath.split('.').slice(0, -2).join('.');
const outputPath = basePath + '.c.ragel';
if (fs.existsSync(outputPath)) {
  console.log(`output exists: ${outputPath}`)
  process.exit(1);
}

const sourceCode = fs.readFileSync(inputPath, 'utf8');

var resultCode = new MagicString(sourceCode);

const parser = new TreeSitter();
parser.setLanguage(TreeSitterC);
const tree = parser.parse(sourceCode);

const walk_cursor = (cursor, level = 0) => {
  while (true) {

    // handle this node
    var ragelMatch = null;
    if (
      cursor.nodeType == 'comment'
      && (ragelMatch = cursor.nodeText.match(/^(\/\*\s*%ragel\s*)({.*})(\s*\*\/)/s)) != null
    ) {
      resultCode.overwrite(
        cursor.startIndex,
        cursor.endIndex,
        `%%${ragelMatch[2]}`
      )
    }

    // go to next node
    if (cursor.gotoFirstChild()) {
      walk_cursor(cursor, level + 1);
      cursor.gotoParent();
    }
    if (!cursor.gotoNextSibling()) break;
  }
}

const cursor = tree.walk();
walk_cursor(cursor);

resultCode = resultCode.toString();

fs.writeFileSync(outputPath, resultCode, 'utf8');
console.log(`done: ${inputPath} -> ${outputPath}`)
