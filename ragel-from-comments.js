/*
extract ragel code from C comments

install dependencies:
npm install tree-sitter tree-sitter-c magic-string

usage:
node ragel-from-comments.js path/to/inputfile.ragel.c

this will produce path/to/inputfile.c.ragel

license: CC0-1.0
*/

// input: /* %ragel { ... } */
// output: %%{ ... }%%

const is_debug = false;
//const is_debug = true;

//const is_force = false; // overwrite output file
const is_force = true; // overwrite output file

const textStartLength = 50; // debug: print first n chars of nodeText

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
const inputPathRegex = /\.(ragel|rl)\.(c|cpp|c\+\+)$/;
const inputPathMatch = inputPath.match(inputPathRegex);
if (inputPathMatch == null) {
  console.log(`wrong file extension: ${inputPath}`)
  console.log(`expected pattern: ${inputPathRegex.source}`)
  process.exit(1);
}
const basePath = inputPath.split('.').slice(0, -2).join('.');
const outputPath = basePath + `.${inputPathMatch[2]}.${inputPathMatch[1]}`
if (is_force == false && fs.existsSync(outputPath)) {
  console.log(`output exists: ${outputPath}`)
  process.exit(1);
}

const sourceCode = fs.readFileSync(inputPath, 'utf8');

var resultCode = new MagicString(sourceCode);

const parser = new TreeSitter();
parser.setLanguage(TreeSitterC);
const tree = parser.parse(sourceCode);

function remove_comments(sourceCode) {

  const tree = parser.parse(sourceCode);
  var resultCode = new MagicString(sourceCode);

  remove_comments_walker(tree.walk(), resultCode);

  return resultCode.toString();
}

function remove_comments_walker(cursor, resultCode, level = 0) {
  while (true) {

    if (is_debug) {
      // print this node
      const textEscaped = cursor.nodeText.replace(/\n/g, '\\n');
      const typeEscaped = cursor.nodeType.replace('\n', '\\n');
      const textStart = (textEscaped.length < textStartLength)
        ? textEscaped : (textEscaped.slice(0, textStartLength) + ' ...');
      const textLocation = `${cursor.startIndex} ${cursor.endIndex}`; // offset in utf8 chars (or offset in bytes? which is it?)
      //const textLocation = `${cursor.startPosition.row}:${cursor.startPosition.column} ${cursor.endPosition.row}:${cursor.endPosition.column}`;
      const levelString = Array.from({ length: (level + 1) }).map(_ => '+').join('');
      console.log(`${levelString} ${textLocation} ${typeEscaped}: ${textStart}`);
    }

    // handle this node
    if (cursor.nodeType == 'comment') {
      if (is_debug) {
        console.log(`remove comment: ` + cursor.nodeText.replace(/\n/g, '\\n'));
        console.log(`remove comment from ${cursor.startIndex} to ${cursor.endIndex}`);
      }
      resultCode.overwrite(cursor.startIndex, cursor.endIndex, '');
    }

    // go to next node
    if (cursor.gotoFirstChild()) {
      remove_comments_walker(cursor, resultCode, level + 1);
      cursor.gotoParent();
    }
    if (!cursor.gotoNextSibling()) break;
  }
}

const walk_cursor = (cursor, level = 0) => {
  while (true) {

    if (is_debug) {
      // print this node
      const textEscaped = cursor.nodeText.replace(/\n/g, '\\n');
      const typeEscaped = cursor.nodeType.replace('\n', '\\n');
      const textStart = (textEscaped.length < textStartLength)
        ? textEscaped : (textEscaped.slice(0, textStartLength) + ' ...');
      const textLocation = `${cursor.startIndex} ${cursor.endIndex}`; // offset in utf8 chars (or offset in bytes? which is it?)
      //const textLocation = `${cursor.startPosition.row}:${cursor.startPosition.column} ${cursor.endPosition.row}:${cursor.endPosition.column}`;
      const levelString = Array.from({ length: (level + 1) }).map(_ => '+').join('');
      console.log(`${levelString} ${textLocation} ${typeEscaped}: ${textStart}`);
    }

    // handle this node
    let ragelMatch = null;
    let doneReplace = false;
    if (
      cursor.nodeType == 'comment'
      && (ragelMatch = cursor.nodeText.match(/^(\/\*\s*%ragel\s*{)(.*)(}\s*\*\/)/s)) != null
    ) {
      resultCode.overwrite(cursor.startIndex, cursor.endIndex, `%%{${ragelMatch[2]}}%%`);
      doneReplace = true;
    }
    else if (
      // #ifdef RAGEL
      //   machine some_machine;
      //   access some_state->;
      //   // comment line
      //   action some_action {
      //     ...
      //   }
      //   /* comment block */
      //   write data;
      // #endif
      cursor.nodeType == 'preproc_ifdef'
      && cursor.currentNode.child(1).type == 'identifier'
      && cursor.currentNode.child(1).text == 'RAGEL'
    ) {
      const ifdefNode = cursor.currentNode;
      let endifNode = ifdefNode.child(2).nextSibling;
      while (endifNode != null && endifNode.type != '#endif') endifNode = endifNode.nextSibling;
      if (endifNode == null) {
        console.log('error: not found endifNode in ifdef block:')
        console.log(cursor.nodeText);
        process.exit(1);
      }

      const ragelBlock = remove_comments(sourceCode.slice(ifdefNode.child(1).endIndex, endifNode.startIndex));

      if (is_debug) {
        console.log(`found ifdef node @ ${ifdefNode.startIndex}`);
        console.log(`found endif node @ ${endifNode.startIndex}`);
        console.log(`replace ${ifdefNode.startIndex} to ${endifNode.endIndex}`);
        console.log(`ragelBlock ${ifdefNode.child(1).endIndex} to ${endifNode.startIndex}`);
        console.dir({ ragelBlock });
      }

      resultCode.overwrite(ifdefNode.startIndex, endifNode.endIndex, `%%{${ragelBlock}}%%`);

      doneReplace = true;
    }

    // go to next node
    // if node was replaced, ignore child nodes
    if (doneReplace == false && cursor.gotoFirstChild()) {
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
