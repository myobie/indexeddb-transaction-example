# IndexedDB Transaction Example

I tried for weeks to understand IndexedDB's transactions and this repo
is the result of what I've learned. A basic database-y thing I always
try to do is an atomic increment and I found that incredibly hard to do
just from reading through [MDN docs][] and other example articles
online.

[MDN docs]: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API

## Atomic increment

A basic thing I always try to do is atomically increment an integer, and
that is only possible in a three step process with indexedDB:

1. Read out the current value
2. Increment in memory
3. Update with a new value

My goal would be for something like this to occur:

```ruby
transaction {
  currentValue = db.get('value')
  newValue = currentValue + 1
  db.put('value', newValue)
}
```

However, transactions in indexedDB are not based on closures or anything
like that: you are not in control of when the transaction is closed. A
transaction is closed when the browser moves on to a "next tick."

At first, this made me think that these kind of "holding the transaction
open" operations were impossible. But it turns out one can continue
using the same transaction over and over, but only at one specific time:
`onsuccess`.

Anytime one tries to query the database it's called a "request." If one
were to issue another request of any kind in the `onsuccess` callback of
any existing request, then the original transaction of the original
request will be used. Yeah.

Assuming a `db` variable is an already opened database with an
objectStore `'items'` with the `keyPath` of `name`:

```js
const transaction = db.transaction(['items'], 'readwrite')

transaction.onerror = e => console.error('transaction errored', e)
transaction.onabort = e => console.error('transaction aborted', e)
// a transaction is complete when all requests are finished
// and the OS is told to write to disk
transaction.oncomplete = e => console.log('transaction is finished')

// can only interact with object stores through transactions
const items = transaction.objectStore('items')

// this is the first request we are making after starting the
// transaction
const getRequest = items.get('Milk')
getRequest.onerror = e => console.error(e)
getRequest.onsuccess = e => {
  // items have a name and an amount
  const data = e.target.result
  data.amount += 1
  // start a second request while still inside the onsuccess of the first
  const putRequest = items.put(data)
  putRequest.onerror = e => console.error(e)
  putRequest.onsuccess = e => console.log('successfully incremented the amount of milk to buy')
}
```

Thanks to fat arrows that code isn't as long as it could be. While this
particular example might seem like it could be tolerable things get
super hinky when trying to compare in one objectStore before writing
into another. Also, this code is super hard to wrap into a function or
make generic in any way.

Also, all those different callbacks with different names really bother
me: I prefer to just get back a promise for any async operation so I at
least have a standard interface for how to handle it.

In this repo I was able to implement and test code that works like this:

```js
const promise = db.transaction(['items'], 'rw').run(function* (tx) {
  const items = tx.table('items')
  const data = yield items.get('Milk')
  data.amount += 1
  yield items.put(data)
  return data
})

promise
  .then(data => console.log(data))
  .catch(e => console.error(e))
```

The basic idea is to provide a generator function that yields requests
which are always handled in the `onsuccess` on the previous request.
Since `yield` allows for precise control flow, it's possible to do all
this without ever letting the javascript vm go to the "next tick."

If you want to see this break down you can simply allow a next tick:

```js
const promise = db.transaction(['items'], 'rw').run(function* (tx) {
  const items = tx.table('items')
  const data = yield items.get('Milk')
  setTimeout(() => {
    data.amount += 1
    yield items.put(data)
  }, 10)
})

promise
  .then(data => console.log(data))
  .catch(e => console.error(e))
```

When the second request happens it will error because the transaction is
now closed. (Also, this would change the api where a simple `return` at
the end is all that is needed to return a final value.)

## Code in this repo

`index.js` is the entrypoint. You can startup a server using:

```sh
$ npm start
```

After it opens a browser window then open a console and you can iteract
with the `db` variable that is handily attached to `window`.

Some examples to try:

```js
logPromise(db.tables.items.count())
logPromise(db.tables.items.add({ name: 'Milk' })
logPromise(db.tables.items.add({ name: 'Cheese' })
logPromise(db.tables.items.add({ name: 'Eggs' })
logPromise(db.tables.items.count())
```

In the example code every item is given a `revision` property which is
set to a number. The `update` function on `Table` requires one to
provide the current `revision` value to update any record.

Here is an example:

```js
// assuming the id of an item is 'abc' (look in the storage inspector to
// find an id of an existing item) and the current revision is 1

logPromise(db.tables.items.update('abc', 1, { name: 'Sony Playstation' }))
// will succeed and now the revision on disk will be 2

logPromise(db.tables.items.update('abc', 1, { name: 'XBox' }))
// will fail, because the provided 1 doesn't match the new revision on disk
```

This is an example of "compare and set" and is something I find very
useful for a lot of applications.

## Multiple processes

Many online have proposed never to use the same indexedDB database in
multiple processes (tabs), but I don't see a problem. If one uses the
transactions appropriately then the database will be locked correctly
and everything will work out. This is one of the primary reasons I went
throught his exercise: **I want to know for sure that I can use the same
database in multiple processes.**

This is especially important for applications created using [Electron][]
since each window is it's own process and doing any kind of background
network sync or multi-window application would mean sharing the
database.

[Electron]: http://electron.atom.io

A lot of libraries will abort opening an already opened database and
even recommend the developer to `window.close()` if that happens.
IndexedDB can handle it, IMHO.

Also, while I do prefer promises over the insane amount of callbacks
that indexedDB provides, I do not want to change the basic API of
indexedDB too far from where it is now. My goal is just to make it very
clear for how long a transaction is open and useful.
