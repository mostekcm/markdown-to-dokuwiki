/**
 * Created by mostekcm on 9/7/16.
 * The purpose of this module is to provide a promise capability to process the results.
 */

var Promise = require('bluebird');
var fs = require('fs');
var readline = require('readline');

/**
 * Constructor
 * @param fileName The name of the file to process that contains markdown.
 */
function MarkdownFile(fileName) {
    this.fileName = fileName;
    this.lineReader = readline.createInterface({
        input: fs.createReadStream(this.fileName)
    });
}

/**
 * Process the markdown file
 * @param processor The processor that will process the markdown.  Must have a method for processLine(line) and finish(), both should return a promise object.  Finish.then will return an array of lines in dokuwiki format.
 * @return a promise object
 */
MarkdownFile.prototype.process = function (processor) {
    var mf = this;
    return new Promise(function (resolve, reject) {
        mf.lineReader.on('line', function (line) {
            processor.processLine(line)
                .then(function () {
                    // Just pass on through
                })
                .catch(function (err) {
                    reject(err);
                });
        });
        mf.lineReader.on('close', function () {
            processor.finish()
                .then(function (dokuwikiLines) {
                    resolve(dokuwikiLines);
                })
                .catch(function (err) {
                    reject(err);
                });
        });
    });
}

//Export the class
module.exports = MarkdownFile;