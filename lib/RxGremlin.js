'use strict';

const util = require('util');

const gremlin = require('gremlin');
const DriverRemoteConnection = gremlin.driver.DriverRemoteConnection;
const Graph = gremlin.structure.Graph;

const { of, from, merge, EMPTY } = require('rxjs');
const { mergeMap, finalize, first } = require('rxjs/operators');

module.exports = class {
  constructor(url, options) {
    this.url = url;
    this.options = options || {};
  }

  static get process() {
    return gremlin.process;
  }

  static get structure() {
    return gremlin.structure;
  }

  traverse(traversal) {
    const remote = new DriverRemoteConnection(this.url, {
      // TODO: Should we ask apache/tinkerpop that 'connectOnStartup' must be set to false by default
      // or even dropped, because of you cannot subscribe to _client._connection error events in
      // the middle of class instance creation, what may end up with node process exit.
      connectOnStartup: false,
      ...this.options,
    });
    const connectionEvents = from(
      new Promise((resolve, reject) => {
        remote._client._connection.on('error', err => reject(err));
        remote._client._connection.on('close', _ => resolve());
      })
    ).pipe(
      mergeMap(_ => EMPTY),
    );

    let g = new Graph().traversal().withRemote(remote);

    // attach useful shortcuts
    g.T = gremlin.process.t;
    g.G = gremlin.process.statics;
    g.P = gremlin.process.P;
    g.TextP = gremlin.process.TextP;
    g.C = gremlin.process.cardinality;
    g.O = gremlin.process.order;

    const traversalEvents = of(this).pipe(
      mergeMap(_ => {
        const t = traversal(g);
        if (util.types.isPromise(t))
          return from(t);
        else
          throw new Error(`It looks you forgot Gremlin termination step in your traversal: ${traversal.toString()}`);
      })
    );

    // TODO: How could we simplify RxGremlin.traverse()?
    // This is related to comments of 'connectOnStartup' option.
    // It means that we have to deal with Node stream error handling, otherwise we may end up
    // with node process exit upon ordinary 'connection fail' situation.
    // gremlin lib's Client.open() constructs a promise which is rejected upon WebSocket error,
    // and previously (for older node versions) it was a warning, but today it's an error if
    // a promise's reject is uncaught what leads to process exit.
    // Probably, the best way to answer this question is to contribute some improvement to
    // the official gremlin lib itself.
    return merge(connectionEvents, traversalEvents).pipe(
      first(), // do not wait for connectionEvents
      finalize(_ =>
        remote.close()
          .then(_ => {})
          .catch(err => console.log(`Error upon Gremlin connection closure: ${err}.`))
      )
    );
  }
};
