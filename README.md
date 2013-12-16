# promise-queue
[![NPM Version](https://badge.fury.io/js/promise-queue.png)]
(https://npmjs.org/package/promise-queue)
[![Build Status](https://travis-ci.org/azproduction/promise-queue.png?branch=master)]
(https://travis-ci.org/azproduction/promise-queue)
[![Coverage Status](https://coveralls.io/repos/azproduction/promise-queue/badge.png?branch=master)]
(https://coveralls.io/r/azproduction/promise-queue)
[![Dependency Status](https://gemnasium.com/azproduction/promise-queue.png)]
(https://gemnasium.com/azproduction/promise-queue)

Promise-based queue

## Installation

`promise-queue` can be installed using `npm`:

```
npm install promise-queue
```

## Example

```
Queue.configure(function () {
    return $.Deferred() || require('vow').promise();
});

// max concurrent - 1
// max queue - Infinity
var queue = new Queue(1, Infinity);

queue.add(function () {
    // resolve of this promise will resume next request
    return downloadTarballFromGithub(url, file);
})
.then(function (file) {
    doStuffWith(file);
});

queue.add(function () {
    return downloadTarballFromGithub(url, file);
})
// This request will be paused
.then(function (file) {
    doStuffWith(file);
});
```
