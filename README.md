# RGL Browser

Web-based tool for browsing the GF's resource grammar library (RGL).

## Live

This tool is hosted live [here](http://www.grammaticalframework.org/~john/rgl-browser/),
where it is kept up to date with the latest RGL.

## Local

### Docker

You can launch a Docker container running the browser with the latest RGL using:
```
$ ./run-docker.sh
```
This will take some time the first time you run it.
Once building is complete you will see:
```
┌────────────────────────────────────────────────┐
│                                                │
│   Serving!                                     │
│                                                │
│   - Local:            http://localhost:5000    │
│   - On Your Network:  http://172.17.0.2:5000   │
│                                                │
└────────────────────────────────────────────────┘
```
You can then browse to `http://localhost:41292` (not `5000`) in your browser to use it.
When done, hit `Ctrl-C` in the terminal window running the container.

### Manual

The tool can also be run locally on a Linux/macOS.
General steps:

1. Clone this repository somewhere servable by your local webserver (or use a symlink). On macOS:
```
$ clone https://github.com/GrammaticalFramework/rgl-source-browser.git
$ sudo ln -s $(pwd)/rgl-source-browser /Library/WebServer/Documents/
```

2. Build the tags (this should be done whenever your grammars are updated).
You need to spefic the `OS` and `GF_RGL` variables, e.g.:
```
OS=mac GF_RGL=/Users/john/repositories/gf-rgl ./build-tags.sh
```
Valid values of `OS` are `bsd`, `mac`, `gnu`, `linux`.

3. Open the app in a browser, e.g.:
```
open http://localhost/rgl-source-browser
```
