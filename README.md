# RGL Browser

Web-based tool for browsing the GF's resource grammar library (RGL).

## Live

This tool is hosted live [here](http://www.grammaticalframework.org/~john/rgl-browser/),
where it is kept up to date with the latest RGL.

## Local

The tool can also be run locally on a Linux/macOS.
General steps:

1. Clone this repository somewhere servable by your local webserver (or use a symlink). On macOS:
```
$ clone https://github.com/GrammaticalFramework/rgl-source-browser.git
$ sudo ln -s $(pwd)/rgl-source-browser /Library/WebServer/Documents/
```
2. Build the tags (this should be done whenever your grammars are updated):
```
GF_RGL=/Users/john/repositories/gf-rgl ./build-tags.sh
```
3. Open the app in a browser, e.g.:
```
open http://localhost/rgl-source-browser
```
