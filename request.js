class Request {
  constructor (factory) {
    this.factory = factory
    this._request = null
  }

  run (cb) {
    return new Promise((resolve, reject) => {
      try {
        this._request = this.factory()
      } catch (e) {
        cb(e)
        return
      }

      this._request.onerror = e => reject(e)
      this._request.onsuccess = e => resolve(e.target.result)
    })
  }
}

exports.Request = Request
