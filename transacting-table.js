const { Request } = require('./request')

class TransactingTable {
  constructor (name, tx, objectStore) {
    this.name = name
    this.tx = tx
    this.objectStore = objectStore
  }

  getRequest (id) {
    return new Request(() => this.objectStore.get(id))
  }

  countRequest () {
    return new Request(() => this.objectStore.count())
  }

  addRequest (id) {
    return new Request(() => this.objectStore.add(id))
  }

  putRequest (data) {
    return new Request(() => this.objectStore.put(data))
  }

  deleteRequest (id) {
    return new Request(() => this.objectStore.delete(id))
  }

  clearRequest () {
    return new Request(() => this.objectStore.clear())
  }
}

exports.TransactingTable = TransactingTable
