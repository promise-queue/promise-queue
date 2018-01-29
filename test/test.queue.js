/*global describe, it, beforeEach, afterEach*/
/* jshint expr:true */
var vm = require('vm'),
    fs = require('fs'),
    // vow = require('vow'),
    sinon = require('sinon'),
    chai = require('chai').use(require('sinon-chai')),
    expect = chai.expect;

var queueSrc = require.resolve(process.env.PROMISE_QUEUE_COVERAGE ? '../lib-cov' : '../lib'),
    queueCode = fs.readFileSync(queueSrc, 'utf8');

var Queue;

function clean() {
    try {
        delete require.cache[require.resolve('..')];
        delete require.cache[queueSrc];
    } catch (e) {}
}

function reset() {
    Queue = require('..');
}

function configure() {
    Queue.configure(global.Promise);
}

describe('queue export', function () {
    beforeEach(function () {
        clean();
    });

    it('queue should be exported in commonjs environment', function () {
        expect(require('..')).to.be.a('function');
    });

    it('queue should be exported in AMD environment', function () {
        var define = sinon.spy();
        define.amd = {};

        var newGlobal = {
            global: {
                __coverage__: global.__coverage__
            },
            define: define
        };

        vm.runInNewContext(queueCode, newGlobal);

        expect(define).to.have.been.calledOnce;
        expect(define).to.have.been.calledWithMatch(sinon.match.func);
    });

    it('queue should be exported in browser or worker environment', function () {
        var newGlobal = {
            global: {
                __coverage__: global.__coverage__
            }
        };

        vm.runInNewContext(queueCode, newGlobal);

        expect(newGlobal.Queue).to.be.a('function');
    });
});

describe('queue.configure()', function () {
    var stashedPromise =  Promise;

    beforeEach(function () {
        // In case Promise exists natively (nodejs > 0.11.11)
        delete global.Promise;
        clean();
        reset();
    });

    afterEach(function () {
      global.Promise = stashedPromise;
    });

    it('queue.add().then() should throw an exception if queue is not configured', function () {
        expect(function () {
            var queue = new Queue();
            queue.add(function () {
                return Promise.resolve(true);
            }).then(function () {});
        }).to.throw(Error);
    });

    it('queue.add().then() should not throw an exception if global Promise exists', function () {
        global.Promise = stashedPromise;
        clean();
        reset();

        expect(function () {
            var queue = new Queue();
            queue.add(function () {
                return Promise.resolve(true);
            }).then(function () {});
        }).to.not.throw(Error);
    });

    // it('ignores missing `progress` callback', function (done) {
    //     Queue.configure(function (handler) {
    //         return new Promise(function (resolve, reject) {
    //             handler(resolve, reject);
    //         });
    //     });
    //
    //     var queue = new Queue();
    //     queue.add(function () {
    //         return new Promise(function (resolve, reject, notify) {
    //             setTimeout(function () {
    //                 if (notify) {
    //                     notify(0);
    //                 }
    //                 resolve();
    //             }, 0);
    //         });
    //     }).then(function () {
    //             done();
    //         }, function () {
    //             done(new Error('onRejected should not be called'));
    //         }, function () {
    //             done(new Error('onProgressed should not be called'));
    //         });
    // });
});

describe('queue', function () {
    beforeEach(function () {
        clean();
        reset();
        configure();
    });

    it('does not limit promises be default', function () {
        var queue = new Queue();
        expect(queue.maxPendingPromises).to.eql(Infinity);
        expect(queue.maxQueuedPromises).to.eql(Infinity);
    });

    describe('add', function () {
        it('promise generator can return non-promise', function (done) {
            var queue = new Queue();
            queue
                .add(function () {
                    return true;
                })
                .then(function (result) {
                    expect(result).to.be.true;
                })
                .then(done, done);
        });

        it('promise generator can return promise', function (done) {
            var queue = new Queue();
            queue
                .add(function () {
                    return new Promise(function (resolve) {
                        resolve(true);
                    });
                })
                .then(function (result) {
                    expect(result).to.be.true;
                })
                .then(done, done);
        });

        it('rejects with Error if limit of max queued promises reached', function (done) {
            var queue = new Queue(0, 0);
            queue
                .add(function () {
                    return true;
                })
                .then(function () {
                    throw new Error('It should be rejected');
                }, function (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect(error.message).to.eql('Queue limit reached');
                })
                .then(done, done);
        });

        it('uses queue(fifo) to order promises', function (done) {
            var queue = new Queue(1);

            var gen1 = sinon.spy();
            var gen2 = sinon.spy();

            queue.add(function () {});
            queue.add(gen1);
            queue.add(gen2)
                .then(function () {
                    expect(gen1).to.have.been.calledBefore(gen2);
                })
                .then(done, done);
        });

        it('uses queue(fifo) to order promises [extra]', function (done) {
           var queue = new Queue(1);
           const wait = function(time, resolve) {
               setTimeout(function() {
                   resolve();
               }, time);
           };

           var counter = 0;

           queue.add(function() {
               return new Promise(function(resolve) {
                   expect(counter).to.equal(0);

                   counter = counter + 1;

                   wait(50, resolve);
               });
           });

           queue.add(function() {
               return new Promise(function(resolve) {
                   expect(counter).to.equal(1);

                   counter = counter + 1;

                   wait(30, resolve);
               });
           });

           queue.add(function() {
               return new Promise(function(resolve) {
                   expect(counter).to.equal(2);

                   counter = counter + 1;

                   wait(10, resolve);
               });
           });

           setTimeout(function () {
               expect(counter).to.equal(3);

               done();
           }, 90);
        });

        it('passes fulfills', function (done) {
            var queue = new Queue();

            queue
                .add(function () {
                    return new Promise(function (resolve) {
                        resolve(true);
                    }).then(function () {
                        return true;
                    });
                })
                .then(function (result) {
                    expect(result).to.be.true;
                })
                .then(done, done);
        });

        it('passes rejects', function (done) {
            var queue = new Queue();

            queue
                .add(function () {
                    return new Promise(function (resolve, reject) {
                        reject(false);
                    });
                })
                .then(function () {
                    throw new Error('It should be rejected');
                }, function (error) {
                    expect(error).to.be.false;
                })
                .then(done, done);
        });

        // it('passes notifications', function (done) {
        //     var queue = new Queue();
        //     var listener = sinon.spy();
        //
        //     queue
        //         .add(function () {
        //             return new Promise(function (resolve, reject, notify) {
        //                 setTimeout(function () {
        //                     if (notify) {
        //                       notify(0);
        //                       notify(1);
        //                       notify(2);
        //                     }
        //                     resolve();
        //                 }, 0);
        //             });
        //         })
        //         .then(function () {}, function () {}, listener)
        //         .then(function () {
        //             [0, 1, 2].forEach(function (n) {
        //                 expect(listener.getCall(n).args[0]).to.be.eql(n);
        //             });
        //         })
        //         .then(done, done);
        // });

        it('passes exceptions', function (done) {
            var queue = new Queue();

            queue
                .add(function () {
                    throw new Error('Caught Exception');
                })
                .then(function () {
                    throw new Error('It should be rejected');
                }, function (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect(error.message).to.eql('Caught Exception');
                })
                .then(done, done);
        });

        it('passes exceptions when second item in queue', function (done) {
            var queue = new Queue();

            queue
                .add(function () {
                    return new Promise(function (resolve, reject, notify) {
                        setTimeout(function () {
                            resolve();
                        }, 0);
                    });
                });

            queue
                .add(function () {
                    throw new Error('Caught Exception');
                })
                .then(function () {
                    throw new Error('It should be rejected');
                }, function (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect(error.message).to.eql('Caught Exception');
                })
                .then(done, done);
        });

        it('maintains proper order with exception', function (done) {
            var queue = new Queue();
            var listener = sinon.spy();
            var listener2 = sinon.spy();

            queue
                .add(function () {
                    throw new Error('Caught Exception');
                })
                .then(null, listener);

            queue
                .add(function () {
                    return new Promise(function (resolve, reject, notify) {
                        setTimeout(function () {
                            resolve();
                        }, 0);
                    });
                })
                .then(listener)
                .then(function() {
                    expect(listener).to.have.been.calledBefore(listener2);
                }).then(done, done);
        });
    });

    describe('getPendingLength', function () {

        it('returns number of pending promises', function (done) {
            var expectedPendingLength = 9;
            var pendingNumber = 10;
            var queue = new Queue(expectedPendingLength);

            function generator() {
                return function () {
                    new Promise(function (resolve) {
                        setTimeout(function () {
                            resolve();
                        }, 100);
                    });
                };
            }

            function check() {
                pendingNumber--;
                if (pendingNumber < 0) {
                    return;
                }
                expect(queue.getPendingLength()).to.be.eql(pendingNumber);

                if (pendingNumber === 0) {
                    done();
                }
            }

            // Note: extra promises will be moved to a queue
            for (var i = 0; i < expectedPendingLength * 2; i++) {
                // Check is after the first item is complete, so it should always be one less.
                queue.add(generator()).then(check);
            }

            // Should synchronously increase pending counter
            expect(queue.getPendingLength()).to.be.eql(expectedPendingLength);
        });

    });

    describe('getQueueLength', function () {

        it('returns number of queued promises', function (done) {
            var maxPending = 1;
            var expectedQueueLength = 9;
            var queue = new Queue(maxPending);

            function generator() {
                return function () {
                    new Promise(function (resolve) {
                        setTimeout(function () {
                            resolve();
                        }, 100);
                    });
                };
            }

            function check() {
                expectedQueueLength--;

                if (expectedQueueLength < 0) {
                    return;
                }
                expect(queue.getQueueLength()).to.be.eql(expectedQueueLength);
                if (expectedQueueLength === 0) {
                    return done();
                }
            }

            // Note: extra promises will be moved to a queue
            for (var i = 0; i <= expectedQueueLength; i++) {
                queue.add(generator()).then(check);
            }

            // Should synchronously increase queue counter
            expect(queue.getQueueLength()).to.be.eql(expectedQueueLength);
        });

    });
});
