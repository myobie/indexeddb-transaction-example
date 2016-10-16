const uuid = require('uuid')

openDb()
  .then(db => {
    window.db = db
  })
  .catch(e => {
    console.error(e)
    throw e
  })

class Table {
  constructor (name, db) {
    this.name = name
    this.db = db
  }

  add (attributes) {
    let id
    let item

    try {
      id = uuid()
      item = Object.assign({}, attributes, { id, revision: 1, createdAt: (new Date()) })
    } catch (e) {
      return Promise.reject(e)
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.name], 'rw')
        const request = transaction.table(this.name).add(item)
        request.onsuccess = () => {
          transaction.then(() => resolve(item))
        }
        request.onerror = e => reject(e)
      } catch (e) {
        reject(e)
      }
    })
  }

  update (id, currentRevision, attributes) {
    let item
    try {
      item = Object.assign({}, attributes, { revision: currentRevision + 1, updatedAt: (new Date()) })
    } catch (e) {
      return Promise.reject(e)
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.name], 'rw')
        const _table = transaction.table(this.name)
        const getRequest = _table.get(id)
        getRequest.onsuccess = e => {
          const data = e.target.result
          if (data.revision === currentRevision) {
            const mergedData = Object.assign({}, data, item)
            const putRequest = _table.put(mergedData)
            putRequest.onsuccess = () => {
              transaction.then(() => resolve(mergedData))
            }
            putRequest.onerror = e => {
              reject(e)
              transaction.abort()
            }
          } else {
            reject(new Error(`revision mismatch: currentRevision is '${currentRevision}' while revision on disk is '${data.revision}'`))
          }
        }
        getRequest.onerror = e => reject(e)
      } catch (e) {
        reject(e)
      }
    })
  }

  delete (id) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.name], 'rw')
        const request = transaction.table(this.name).delete(id)
        request.onsuccess = () => {
          transaction.then(() => resolve(true))
        }
        request.onerror = e => reject(e)
      } catch (e) {
        reject(e)
      }
    })
  }
}

class Database {
  constructor (db, tableNames) {
    this.db = db
    this.tables = tableNames.reduce((obj, name) => {
      obj[name] = new Table(name, this)
      return obj
    }, {})
  }

  transaction (tableNames, mode = 'r') {
    let _mode
    if (mode === 'rw') {
      _mode = 'readwrite'
    } else {
      _mode = 'read'
    }

    const _tx = this.db.transaction(tableNames, _mode)
    const tx = new Transaction(_tx)
    return tx
  }
}

class Transaction {
  constructor (tx) {
    this.tx = tx
    this.promise = new Promise((resolve, reject) => {
      this.tx.oncomplete = e => resolve(e)
      this.tx.onerror = e => reject(e)
      this.tx.onabort = e => reject(new Error(e))
    })
  }

  get tables () {
    return this.tx.objectStoreNames
  }

  table (name) {
    return this.tx.objectStore(name)
  }

  abort () {
    this.tx.abort()
  }

  then (cb) {
    return this.promise.then(cb)
  }

  catch (e) {
    return this.promise.catch(e)
  }
}

function openDb () {
  return new Promise((resolve, reject) => {
    let isRejected = false
    let request

    try {
      request = window.indexedDB.open('transaction-test', 1)
    } catch (e) {
      _reject(new Error(e))
      return
    }

    request.onupgradeneeded = onupgradeneeded
    request.onsuccess = onsuccess
    request.onerror = onerror
    request.onblocked = onblocked

    function _reject (what) {
      isRejected = true
      reject(what)
    }

    function onupgradeneeded (e) {
      let _db
      try {
        _db = e.target.result
      } catch (e) {
        _reject(new Error(e))
        return
      }

      try {
        const _items = _db.createObjectStore('items', { keyPath: 'id' })
        _items.createIndex('name', 'name', { unique: false })
      } catch (e) {
        _reject(new Error(e))
      }
    }

    function onsuccess (e) {
      let _db
      if (isRejected) { return }

      try {
        _db = e.target.result
      } catch (e) {
        _reject(new Error(e))
        return
      }

      const db = new Database(_db, ['items'])
      resolve(db)
    }

    function onerror (e) {
      _reject(new Error(e))
    }

    function onblocked (e) {
      _reject(new Error(e))
    }
  })
}
