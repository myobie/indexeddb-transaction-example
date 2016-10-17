const { Request } = require('./request')

class TransactingTable {
  constructor (name, tx, objectStore) {
    this.name = name
    this.tx = tx
    this.objectStore = objectStore
  }

  get (id) {
    return new Request(() => this.objectStore.get(id))
  }

  count () {
    return new Request(() => this.objectStore.count())
  }

  add (id) {
    return new Request(() => this.objectStore.add(id))
  }

  put (data) {
    return new Request(() => this.objectStore.put(data))
  }

  delete (id) {
    return new Request(() => this.objectStore.delete(id))
  }

  clear () {
    return new Request(() => this.objectStore.clear())
  }
}

exports.TransactingTable = TransactingTable
