/**
 * Created by mostekcm on 9/7/16.
 * The purpose of this module is to process a line of markdown and store state
 */

var Promise = require('bluebird');
var XRegExp = require('xregexp');

var None = 0;

/* States */
var Code = 1;

/* Lists */
var Ordered = 1;
var Unordered = 2;

/**
 * Constructor
 */
function MarkdownProcessor() {
    this.listTypeStack = [];
    this.dokuwikiText = [];
    this.blankLines = 0;
    this.processingCodeLine = false;

    this.headerRe = XRegExp('^\s*(?<hashes>[#]{1,5}) (?<text>.*)$');
    this.orderedListRe = XRegExp('^(?<spaces> *)[0-9]+\. *(?<text>.*)$');
    this.codeBlockStartEndRe = XRegExp('^ *[`]{3} *(?<language>[a-zA-Z]*) *$');
    this.blankRe = XRegExp('^ *$');
}

/**
 * Convert headers
 * @param line the line to parse
 * @returns { 'found': true/false, 'dokuLine': exists if found==true }
 */
MarkdownProcessor.prototype.lookForHeader = function (line) {
    var headerMatch = XRegExp.exec(line, this.headerRe);
    if (headerMatch) {
        /* We have a header line */
        var numEquals = 6 - headerMatch.hashes.length;
        var equals = "=";
        for (var i = 1; i < numEquals; ++i) {
            equals += "=";
        }
        var dokuLine = equals + " " + headerMatch.text.trim() + " " + equals;

        /* Reset list state if we hit a header */
        this.listTypeStack = [];
        this.blankLines = 0;

        return {'found': true, 'dokuLine': dokuLine};
    } else {
        return {'found': false}
    }
}

/**
 * If the current line is part of an ordered list, then parse it.  This stores state!
 * @param line the line to parse
 * @returns the new dokuLine
 */
MarkdownProcessor.prototype.lookForOrderedList = function (line) {
    var dokuLine = line;
    /*
     * Check for ordered list
     */
    var listMatch = XRegExp.exec(dokuLine, this.orderedListRe);
    if (listMatch) {
        /* We have an ordered list line */

        /* First Check for indentation */
        var currentListState = listMatch.spaces.length;
        if (this.listTypeStack.length == 0 ||
            this.listTypeStack[this.listTypeStack.length - 1] < currentListState) {
            /* This is a new amount to indent, either because this is a new list, or because it is indented farther than the previous */
            this.listTypeStack.push(currentListState);
        } else if (this.listTypeStack[this.listTypeStack.length - 1] > currentListState) {
            /* We have now gone back in indentation, pop off the stack until we are equal or smaller to the current stack size */
            this.listTypeStack.pop();
            for (var i=this.listTypeStack.length - 1; i >= 0; --i) {
                if (this.listTypeStack[i] == currentListState) {
                    /* we are happy!  quit here */break;
                } else if (this.listTypeStack[i] > currentListState) {
                    /* still greater, pop again */
                    this.listTypeStack.pop();
                    continue;
                } else {
                    /* Less than now, must be same as last indent, but we'll push and start here again */
                    this.listTypeStack.push(currentListState);
                    break;
                }
            }
            /* If we didn't find anything less than or equal to our current size, start again */
            if (this.listTypeStack.length == 0) {
                this.listTypeStack.push(currentListState);
            }
        }

        /* Now set the indentation */
        var indent = "";
        for (var i=0; i<this.listTypeStack.length; ++i) {
            indent += "  ";
        }

        /* pop off listTypes until we match or are less than previous indentation */
        dokuLine = indent + "- " + listMatch.text;

        // go back and kill blank lines
        for(var i=0; i<this.blankLines; ++i) {
            this.dokuwikiText.pop();
        }
        this.blankLines = 0;
        // TODO: go back and add newlines
    }

    return dokuLine;
}

/**
 * If the current line is part of an ordered list, then parse it.  This stores state!
 * @param line the line to parse
 * @returns { 'found': true/false, 'dokuline': exists if found==true }
 */
MarkdownProcessor.prototype.processCodeBlock = function (line) {
    var dokuLine = line;
    var found = false;
    var codeStartEnd = XRegExp.exec(dokuLine, this.codeBlockStartEndRe);
    if (codeStartEnd) {
        found = true;
        if (this.processingCodeLine) {
            dokuLine = "</code>";
            this.processingCodeLine = false;
        } else {
            this.processingCodeLine = true;
            var codeLine = "<code";
            if (codeStartEnd.language != "") {
                codeLine += " "+codeStartEnd.language;
            }
            codeLine += ">";
            /* Now check if in a list, back up to previous line, otherwise just set it here */
            if (this.listTypeStack.length > 0) {
                for(var i=0; i<this.blankLines; ++i) {
                    this.dokuwikiText.pop();
                }
                dokuLine = this.dokuwikiText.pop();
                dokuLine += codeLine;
            } else {
                dokuLine = codeLine;
            }
        }
    } else if (this.processingCodeLine) {
        /* Make sure we don't process this line! */
        found = true;
    }

    return { "found":found, "dokuLine":dokuLine};
}

/**
 * Process a line of the markdown text
 * @param line The line of text to process
 * @return a promise object
 */
MarkdownProcessor.prototype.processLine = function (line) {

    var dokuLine = line;

    // Before doing anything, if we are in a code block, drop it in!
    var result = this.processCodeBlock(line);

    // always copy line in case it changed
    dokuLine = result.dokuLine;
    if (!result.found) {
        // only look for more if we did not find a code start or end
        // look for header
        result = this.lookForHeader(line);
        if (result.found) {
            // done because we found a header
            dokuLine = result.dokuLine;
        } else {
            // look for list
            dokuLine = this.lookForOrderedList(dokuLine);

            // TODO: look for links

            // look for blank lines
            var blankMatch = XRegExp.exec(dokuLine,this.blankRe);
            if (blankMatch) this.blankLines++;
            else this.blankLines = 0;
        }
    }
    this.dokuwikiText.push(dokuLine);
    return new Promise(function (resolve) {
        resolve();
    });
}

/**
 * Finalize processing
 * @param line The line of text to process
 * @return a promise object
 */
MarkdownProcessor.prototype.finish = function () {
    var mp = this;
    return new Promise(function (resolve, reject) {
        resolve(mp.dokuwikiText);
    });
}

//Export the class
module.exports = MarkdownProcessor;