const uuid = require('uuid')

openDb()
  .then(db => {
    window.db = db
  })
  .catch(e => {
    console.error(e)
    throw e
  })

class TransactionQueue {
  constructor (db) {
    this.db = db
    this.items = []
  }

  request (tableName, requestFactory, mode = 'r') {
    const item = new TransactionQueueItem(tableName, requestFactory, mode)
    this.items.push(item)
    return item
  }

  read (tableName, requestFactory) {
    return this.request(tableName, requestFactory, 'r')
  }

  write (tableName, requestFactory) {
    return this.request(tableName, requestFactory, 'rw')
  }

  run () {
    let tableNames
    let mode = 'r'

    try {
      const allTableNames = this.items.map(item => item.tableName)
      const tableNamesSet = new Set(allTableNames)
      tableNames = [...tableNamesSet]

      const modes = this.items.map(item => item.mode)
      if (modes.indexOf('rw') !== -1) { mode = 'rw' }
    } catch (e) {
      return Promise.reject(e)
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(tableNames, mode)
      transaction.onerror = e => reject(e)
      transaction.onabort = e => reject(e)

      function runDown (items, lastResult, cb) {
        let currentItem = items.shift()

        if (currentItem) {
          currentItem._run(transaction, (err, result) => {
            if (err) { return cb(err) }
            return runDown(items, result, cb)
          })
        } else {
          return cb(null, lastResult)
        }
      }

      runDown(this.items.slice(), null, (err, result) => {
        if (err) {
          reject(err)
          transaction.abort()
          return
        }
        transaction.then(() => resolve(result))
      })
    })
  }
}

TransactionQueue.run = (db, array) => {
  const queue = new TransactionQueue(db)
  for (let info of array) {
    const item = queue.request(info.table, info.request, info.mode)
    if (info.success) { item.success(info.success) }
  }
  return queue.run()
}

class TransactionQueueItem {
  constructor (tableName, requestFactory, mode = 'r') {
    this.tableName = tableName
    this.requestFactory = requestFactory
    this.mode = mode
    this.successFns = []
    this.request = null
    this.result = null
  }

  success (cb) {
    this.successFns.push(cb)
    return this
  }

  _run (tx, cb) {
    this.request = this.requestFactory(tx.table(this.tableName))
    this.request.onsuccess = e => {
      const result = e.target.result
      let finalResult
      let lastResult = result
      for (let fn of this.successFns) {
        try {
          let newResult = fn(lastResult)
          lastResult = newResult
        } catch (e) {
          cb(e)
          return
        }
      }

      cb(null, finalResult)
    }
    this.onerror = e => { cb(e) }
  }
}

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

  batch (genFn) {
    let queue = new TransactionQueue(this.db)
    let done = false

    while (!done) {
      queue.
    }
  }

  updateQ (id, currentRevision, attributes) {
    let item

    try {
      item = Object.assign({}, attributes, { revision: currentRevision + 1, updatedAt: (new Date()) })
    } catch (e) {
      return Promise.reject(e)
    }

    let mergedData

    // const queue = new TransactionQueue(this.db)
    // queue.read(this.name, table => table.get(id)).success(compareAndMergeData)
    // queue.write(this.name, table => table.put(mergedData))

    // let queue = this.db.batch(function* (q) {
    //   let mergedData

    //   let data = yield q.table(this.name).get(id)

    //   if (data.revision === currentRevision) {
    //     mergedData = Object.assign({}, data, item)
    //   } else { throw new Error('revision mismatch') }

    //   yield q.table(this.name).put(mergedData)

    //   return mergedData
    // })

    // return queue.run()

    const promise = TransactionQueue.run(this.db, [
      {
        table: this.name,
        request: table => table.get(id),
        mode: 'r',
        success: compareAndMergeData
      },
      {
        table: this.name,
        request: table => table.put(mergedData),
        mode: 'rw'
      }
    ])

    return promise.then(() => mergedData)

    function compareAndMergeData (data) {
      if (data.revision === currentRevision) {
        mergedData = Object.assign({}, data, item)
      } else {
        throw new Error(`revision mismatch: currentRevision is '${currentRevision}' while revision on disk is '${data.revision}'`)
      }
    }
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
      _mode = 'readonly'
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
