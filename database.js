const { Table } = require('./table')
const { Transaction } = require('./transaction')

class Database {
  constructor (db, tableNames) {
    this.db = db
    this.tables = tableNames.reduce((obj, name) => {
      obj[name] = new Table(name, this)
      return obj
    }, {})
  }

  table (name) {
    return this.tables[name]
  }

  transaction (tableNames, mode = 'r') {
    let _mode
    if (mode === 'rw') {
      _mode = 'readwrite'
    } else {
      _mode = 'readonly'
    }

    const _tx = this.db.transaction(tableNames, _mode)
    const tx = new Transaction(tableNames, _tx)
    return tx
  }
}

exports.Database = Database
