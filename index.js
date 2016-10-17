openDb()
  .then(db => {
    window.db = db
  })
  .catch(e => {
    console.error(e)
    throw e
  })

window.logPromise = promise => {
  promise
    .then(r => console.log(r))
    .catch(e => console.error(e))
}

const { Database } = require('./database')

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
