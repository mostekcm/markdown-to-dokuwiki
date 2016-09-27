#! /usr/bin/env node

/**
 * Created by mostekcm on 9/7/16.
 */

var program = require('commander');
var MarkdownFile = require('./MarkdownFile');
var MarkdownProcessor = require('./MarkdownProcessor');
var fs = require('fs');
var path = require('path');

program
    .arguments('<input_file>')
    .option('-o, --output_file <output file>', 'The file to output dokuwiki to')
    .action(function (input_file) {
        /* Check whether we are piping to a file or standard out */
        var fileName = program.output_file ? program.output_file : "stdout";
        console.log('output_file: %s input_file: %s', program.output_file, input_file);

        /* open output stream */
        var outputStream = fileName==="stdout" ? process.stdout : fs.createWriteStream(path.normalize(fileName));

        var mf = new MarkdownFile(input_file);
        mf.process(new MarkdownProcessor())
            .then(function (dokuLines) {
                dokuLines.forEach(function (line) {
                    outputStream.write(line + "\n");
                });
            })
            .catch(function (err) {
                console.log(err);
            });
    })
    .parse(process.argv);