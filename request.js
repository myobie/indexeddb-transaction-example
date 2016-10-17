class Request {
  constructor (factory) {
    this.factory = factory
    this._request = null
    this.isRequest = true
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

Request.run = function (factory) {
  return (new Request(factory)).run()
}

exports.Request = Request
