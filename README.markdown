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
  .then(data => console.log(data)
  .catch(e => console.error(e))
```

The basic idea is to provide a generator function that yields requests
which are always handled in the `onsuccess` on the previous request.
Since `yield` allows for precise control flow, it's possible to do all
this without ever letting the javascript vm go to the "next tick."


