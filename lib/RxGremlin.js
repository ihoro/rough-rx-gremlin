'use strict';

const util = require('util');

const gremlin = require('gremlin');
const DriverRemoteConnection = gremlin.driver.DriverRemoteConnection;
const Graph = gremlin.structure.Graph;

const { of, from, merge, EMPTY } = require('rxjs');
const { flatMap, finalize, first } = require('rxjs/operators');

const T = gremlin.process.t;
const G = gremlin.process.statics;
const P = gremlin.process.P;
const TextP = gremlin.process.TextP;
const C = gremlin.process.cardinality;

module.exports = class {
  constructor(url, authenticator) {
    this.url = url;
    this.authenticator = authenticator;
    this.T = T;
    this.G = G;
    this.P = P;
    this.TextP = TextP;
    this.C = C;
  }

  static get process() {
    return gremlin.process;
  }

  static get structure() {
    return gremlin.structure;
  }

  traverse(traversal) {
    const remote = new DriverRemoteConnection(this.url, {
      connectOnStartup: false, // gremlin-node opens connection within the class constructor with returning rejected promise, you have no chance to subscribe to connection error event
      // TODO: tell apache/tinkerpop that it must be set to false by default or even dropped, you cannot subsribe to _client._connection error events in the middle of class instance creation
      authenticator: this.authenticator,
    });
    const connectionEvents = from(
      new Promise((resolve, reject) => {
        remote._client._connection.on('error', err => reject(err));
        remote._client._connection.on('close', _ => resolve());
      })
    ).pipe(
      flatMap(_ => EMPTY),
    );

    let g = new Graph().traversal().withRemote(remote);

    // useful shortcuts:
    g.T = this.T;
    g.G = this.G;
    g.P = this.P;
    g.TextP = this.TextP;
    g.C = this.C;

    const traversalEvents = of(this).pipe(
      flatMap(_ => {
        const t = traversal(g);
        if (util.types.isPromise(t))
          return from(t);
        else
          throw new Error(`It looks you forgot Gremlin termination step in your traversal: ${traversal.toString()}`);
      })
    );

    // TODO: is there another way to handle this madness when you talk through the front door and may get uncaught errors from a back door?
    return merge( connectionEvents, traversalEvents ).pipe(
      first(), // do not wait for connectionEvents
      finalize(_ =>
        remote.close()
          .then(_ => {})
          .catch(err => console.log(`Error upon Gremlin connection clsoure: ${err}.`))
      )
    );
  }
};
