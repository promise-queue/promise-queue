/* global define: true */
(function (root, factory) {
    'use strict';
    if (typeof exports === 'object') {
        // CommonJS
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(factory);
    } else {
        // Browser globals
        root.queue = factory();
    }
})
(this, function () {
    'use strict';

    /**
     * @return {Object}
     */
    var promiseFactory = function () {
        return {
            then: function () {
                throw new Error('Queue.configure() before use Queue');
            }
        };
    };

    /**
     * @param {*} value
     * @returns {{then: Function}}
     */
    var resolveWith = function (value) {
        if (value && typeof value.then === 'function') {
            return value;
        }
        var promise = promiseFactory();
        (promise.resolve || promise.fulfill).call(promise, value);

        return promise;
    };

    /**
     * It limits concurrently executed promises
     *
     * @param {Number} [maxPendingPromises=Infinity] max number of concurrently executed promises
     * @param {Number} [maxQueuedPromises=Infinity]  max number of queued promises
     * @constructor
     *
     * @example
     *
     * Queue.configure(function () {
     *     return $.Deferred() || require('vow').promise();
     * });
     *
     * var queue = new Queue(1);
     *
     * queue.add(function () {
     *     // resolve of this promise will resume next request
     *     return downloadTarballFromGithub(url, file);
     * })
     * .then(function (file) {
     *     doStuffWith(file);
     * });
     *
     * queue.add(function () {
     *     return downloadTarballFromGithub(url, file);
     * })
     * // This request will be paused
     * .then(function (file) {
     *     doStuffWith(file);
     * });
     */
    function Queue(maxPendingPromises, maxQueuedPromises) {
        this.pendingPromises = 0;
        this.maxPendingPromises = typeof maxPendingPromises !== 'undefined' ? maxPendingPromises : Infinity;
        this.maxQueuedPromises = typeof maxQueuedPromises !== 'undefined' ? maxQueuedPromises : Infinity;
        this.queue = [];
    }

    /**
     * Defines promise promiseFactory
     * @param {Function} promiseGenerator
     */
    Queue.configure = function (promiseGenerator) {
        promiseFactory = promiseGenerator;
    };

    /**
     * @param {Function} promiseGenerator
     * @return {{then: Function}}
     */
    Queue.prototype.add = function (promiseGenerator) {
        var promise = promiseFactory();
        // Do not queue to much promises
        if (this.queue.length >= this.maxQueuedPromises) {
            promise.reject(new Error('Queue limit reached'));
            return promise;
        }

        // Add to queue
        this.queue.push({
            promiseGenerator: promiseGenerator,
            promise: promise
        });

        this._dequeue();

        return promise;
    };

    /**
     * @returns {boolean} true if first item removed from queue
     * @private
     */
    Queue.prototype._dequeue = function () {
        var self = this;

        if (this.pendingPromises >= this.maxPendingPromises) {
            return false;
        }

        // Remove from queue
        var item = this.queue.shift();
        if (!item) {
            return false;
        }
        var promise = item.promise;

        this.pendingPromises++;
        resolveWith(item.promiseGenerator())
            // Forward all stuff
            .then(function (value) {
                // It is not pending now
                self.pendingPromises--;
                self._dequeue();
                // It should pass values
                (promise.resolve || promise.fulfill).call(promise, value);
            }, function (err) {
                // It is not pending now
                self.pendingPromises--;
                self._dequeue();
                // It should not mask errors
                promise.reject(err);
            }, function (message) {
                // It should pass notifications
                promise.notify(message);
            });

        return true;
    };

    return Queue;
});
