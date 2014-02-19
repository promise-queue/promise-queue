/*global describe, it, beforeEach, afterEach*/
/* jshint expr:true */
var vm = require('vm'),
    fs = require('fs'),
    vow = require('vow'),
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
    Queue.configure(function () {
        return vow.promise();
    });
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
    beforeEach(function () {
        clean();
        reset();
    });

    it('queue.add().then() should throw an exception if queue is not configured', function () {
        expect(function () {
            var queue = new Queue();
            queue.add(function () {
                return vow.fulfill(true);
            }).then(function () {});
        }).to.throw(Error);
    });
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
                    return vow.promise(true);
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

        it('passes fulfills', function (done) {
            var queue = new Queue();

            queue
                .add(function () {
                    return vow.promise(true).then(function () {
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
                    return vow.reject(false);
                })
                .then(function () {
                    throw new Error('It should be rejected');
                }, function (error) {
                    expect(error).to.be.false;
                })
                .then(done, done);
        });

        it('passes notifications', function (done) {
            var queue = new Queue();
            var listener = sinon.spy();

            queue
                .add(function () {
                    var promise = vow.promise();

                    setTimeout(function () {
                        promise.notify(0);
                        promise.notify(1);
                        promise.notify(2);
                        promise.fulfill();
                    }, 0);

                    return promise;
                })
                .then(function () {}, function () {}, listener)
                .then(function () {
                    [0, 1, 2].forEach(function (n) {
                        expect(listener.getCall(n).args[0]).to.be.eql(n);
                    });
                })
                .then(done, done);
        });
    });
});
