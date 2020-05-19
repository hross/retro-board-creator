<p align="center">
  <a href="https://github.com/actions/typescript-action/actions"><img alt="retro-board-creator status" src="https://github.com/hross/retro-board-creator/workflows/build-test/badge.svg"></a>
</p>

# Creating Retro Boards

```
name: Create the Retrospective Board

on:
  schedule:
    - cron: '0 14 * * 3'

jobs:
  create-board:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - uses: ./
      with: 
        repo-token: ${{ secrets.GITHUB_TOKEN }}
        handles: hross,alepauly
        only-log: true
```

## How to work with this action

Install the dependencies  
```bash
$ npm install
```

Build the typescript and package it for distribution
```bash
$ npm run build && npm run pack
```

Run the tests :heavy_check_mark:  
```bash
$ npm test

 PASS  ./index.test.js
  ✓ throws invalid number (3ms)
  ✓ wait 500 ms (504ms)
  ✓ test runs (95ms)

...
```
