class Request {
  constructor (factory) {
    this.factory = factory
    this._request = null
  }

  run (cb) {
    try {
      this._request = this.factory()
    } catch (e) {
      cb(e)
      return
    }

    this._request.onerror = e => cb(e)
    this._request.onsuccess = e => cb(null, e.target.result)
  }
}

exports.Request = Request
