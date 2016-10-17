class Request {
  constructor (factory) {
    this.factory = factory
    this._request = null
  }

  run () {
    return new Promise((resolve, reject) => {
      try {
        this._request = this.factory()
      } catch (e) {
        reject(e)
        return
      }

      this._request.onerror = e => reject(e)
      this._request.onsuccess = e => resolve(e.target.result)
    })
  }
}

exports.Request = Request
