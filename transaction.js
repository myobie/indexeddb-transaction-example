const { TransactingTable } = require('./transacting-table')

class Transaction {
  constructor (tableNames, tx) {
    this.tx = tx
    this.tables = {}

    for (let name of tableNames) {
      const objectStore = tx.objectStore(name)
      this.tables[name] = new TransactingTable(name, this, objectStore)
    }

    this.promise = new Promise((resolve, reject) => {
      tx.oncomplete = e => resolve(e)
      tx.onerror = e => reject(e)
      tx.onabort = e => reject(new Error(e))
    })
  }

  table (name) {
    return this.tables[name]
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

  run (genFn) {
    const gen = genFn(this)
    const self = this

    return new Promise((resolve, reject) => {
      function next (lastResult) {
        let request

        try {
          request = gen.next(lastResult)
        } catch (e) {
          self.abort()
          reject(e)
          return
        }

        if (request.done) {
          const value = request.value
          self.then(() => resolve(value))
        } else {
          request.value.run((err, result) => {
            if (err) {
              self.abort()
              reject(err)
            } else {
              next(result)
            }
          })
        }
      }

      next()
    })
  }
}

exports.Transaction = Transaction
