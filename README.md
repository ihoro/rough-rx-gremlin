# The simplest RxJS wrapper around gremlin lib

[![Build Status](https://travis-ci.com/ihoro/rough-rx-gremlin.svg?branch=master)](https://travis-ci.com/ihoro/rough-rx-gremlin)
[![npm version](https://badge.fury.io/js/%40rough%2Frx-gremlin.svg)](https://badge.fury.io/js/%40rough%2Frx-gremlin)

Rough implementation of [rxified](https://npmjs.com/rxjs) wrapper of [gremlin](https://npmjs.com/gremlin) lib.

## Usage examples

```js
const { tap } = require('rxjs/operators');
const RxGremlin = require('@rough/rx-gremlin');

const gremlin = new RxGremlin('ws://gremlin-server:8182/gremlin');

gremlin.traverse(g => g.V().hasLabel('Person').valueMap(true).next())
  .pipe(
    tap(({ value }) => console.log(value))
  )
  // .subscribe ...
```

Also, each `g` instance has handy shortcuts as follows:

```js
g.T = gremlin.process.t;
g.G = gremlin.process.statics;
g.P = gremlin.process.P;
g.TextP = gremlin.process.TextP;
g.C = gremlin.process.cardinality;
g.O = gremlin.process.order;
```

What can be used right away without additional imports:

```js
// ...
g => g.V()
  .has(g.T.label, g.P.within('Entity', 'Person'))
  .has('description', g.P.not(g.TextP.containing(['word1', 'word2'])))
  .where(g.G.not(g.G.outE('parent')))
  .order().by('updated_at', g.O.desc)
  .valueMap(true)
  .toList()
// ...
```
