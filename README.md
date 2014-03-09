# promise-queue [![NPM Version](https://badge.fury.io/js/promise-queue.png)](https://npmjs.org/package/promise-queue) [![Build Status](https://travis-ci.org/azproduction/promise-queue.png?branch=master)](https://travis-ci.org/azproduction/promise-queue) [![Coverage Status](https://coveralls.io/repos/azproduction/promise-queue/badge.png?branch=master)](https://coveralls.io/r/azproduction/promise-queue) [![Dependency Status](https://gemnasium.com/azproduction/promise-queue.png)](https://gemnasium.com/azproduction/promise-queue)

Promise-based queue

## Installation

`promise-queue` can be installed using `npm`:

```
npm install promise-queue
```

## Example

### Configure attempt

By default `Queue` tries to use global Promises, but you can specify your own promises.

```js
Queue.configure(require('vow').Promise);
```

Or use old-style promises approach:

```js
Queue.configure(function (handler) {
    var dfd = $.Deferred();
    try {
        handler(dfd.resolve, dfd.reject, dfd.progress);
    } catch (e) {
        dfd.reject(e);
    }
    return dfd.promise();
});
```

### Queue example

```js
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

[Live example](http://jsfiddle.net/RVuEU/1/)
