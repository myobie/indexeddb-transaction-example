const uuid = require('uuid')

class Table {
  constructor (name, db) {
    this.name = name
    this.db = db
  }

  get (id) {
    const name = this.name

    return this.db.transaction([name], 'r').run(function* (tx) {
      return yield tx.table(name).get(id)
    })
  }

  count () {
    const name = this.name

    return this.db.transaction([name], 'r').run(function* (tx) {
      return yield tx.table(name).count()
    })
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

    const name = this.name

    return this.db.transaction([name], 'rw').run(function* (tx) {
      yield tx.table(name).add(item)
      return item
    })
  }

  update (id, currentRevision, attributes) {
    let item

    try {
      item = Object.assign({}, attributes, { revision: currentRevision + 1, updatedAt: (new Date()) })
    } catch (e) {
      return Promise.reject(e)
    }

    const name = this.name

    return this.db.transaction([name], 'rw').run(function* (tx) {
      const table = tx.table(name)

      let data = yield table.get(id)

      let mergedData

      if (data.revision === currentRevision) {
        mergedData = Object.assign({}, data, item)
      } else {
        throw new Error(`revision mismatch: currentRevision is '${currentRevision}' while revision on disk is '${data.revision}'`)
      }

      yield table.put(mergedData)

      return mergedData
    })
  }

  put (data) {
    const name = this.name

    return this.db.transaction([name], 'rw').run(function* (tx) {
      yield tx.table(name).put(data)
      return data
    })
  }

  delete (id) {
    const name = this.name

    return this.db.transaction([name], 'rw').run(function* (tx) {
      yield tx.table(name).delete(id)
      return true
    })
  }
}

exports.Table = Table
