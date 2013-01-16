var https = require('https')
  , querystring = require('querystring')
  , $$ = require('stepdown')
  , DEFAULT_HOST = 'app.zencoder.com'
  , DEFAULT_VERSION = 2
  , JobProgress = {
      PENDING: 'pending',
      WAITING: 'waiting',
      PROCESSING: 'processing',
      FINISHED: 'finished',
      FAILED: 'failed',
      CANCELLED: 'cancelled'
    }

//
// # ZencoderClient
//
function ZencoderClient(options) {
  if (!(this instanceof ZencoderClient)) {
    return new ZencoderClient(options)
  }

  options = options || {}

  this.key = this.key || options.key
  this.host = this.host || options.host || DEFAULT_HOST
  this.version = this.version || options.version || DEFAULT_VERSION

  this._progressQueue = []
  this._startPQ()
}
ZencoderClient.createClient = ZencoderClient

//
// ## _startPQ
//
ZencoderClient.prototype._startPQ = _startPQ
function _startPQ() {
  var self = this

  setInterval(function () {
    if (!self._progressQueue.length) {
      return
    }

    // TODO: Rotate through queue.
    var pending = self._progressQueue.shift()

    $$([
      function ($) {
        self.getJobProgress(pending.id, $.first())
      },
      function ($, response) {
        switch (response.body.state) {
          case JobProgress.FINISHED:
            self.getJobDetails(pending.id, $.first())
            return
          case JobProgress.FAILED:
            pending.callback({
              message: 'Job Failed'
            })
            // If we haven't succeeded, we don't want to make the additional Details request and call back.
            $.end()
            break
          case JobProgress.CANCELLED:
            pending.callback({
              message: 'Job Cancelled'
            })
            $.end()
            break
          default:
            self._progressQueue.push(pending)
        }
      },
      function ($, response) {
        pending.callback(null, response.body.job)
      }
    ])
  }, 250)
}

//
// ## addPendingJob
//
ZencoderClient.prototype.addPendingJob = addPendingJob
function addPendingJob(jobId, callback) {
  var self = this

  self._progressQueue.push({
    id: jobId,
    callback: callback
  })
}

//
// ## request
//
ZencoderClient.prototype.request = request
function request(method, path, body, headers, callback) {
  var self = this
    , req

  if (typeof headers === 'function') {
    callback = headers
    headers = {}
  }

  method = method || 'GET'

  if (method === 'GET') {
    path += querystring.stringify(body)
  }

  req = https.request({
    host: self.host,
    method: method,
    path: '/api/v' + self.version + path,
    headers: headers
  })

  if (body) {
    if (typeof body === 'string') {
      req.write(body)
    } else {
      req.write(JSON.stringify(body))
    }
  }

  req.end()
}

//
// ## getHeaders
//
ZencoderClient.prototype.getHeaders = getHeaders
function getHeaders(body) {
  var self = this
    , headers

  headers = {
    'Zencoder-Api-Key': self.key
  }

  if (body) {
    headers['Content-Length'] = body.length
  }

  return headers
}

//
// ## wrapCallback
//
ZencoderClient.prototype.wrapCallback = wrapCallback
function wrapCallback(callback) {
  var self = this

  return function wrapped(res) {
    var error = null
      , response = {
          headers: res.headers
        }
      , body = ''

    response.code = res.statusCode
    if (res.statusCode < 200 || res.statusCode > 299) {
      error = response
    }

    res.setEncoding('utf8')
    res.on('data', function (chunk) {
      body += chunk
    })
    res.on('end', function () {
      if (error) {
        error.message = body
        callback(error)
      } else {
        body = JSON.parse(body)

        response.body = body
        callback(null, response)
      }
    })
  }
}

//
// ## request
//
ZencoderClient.prototype.request = request
function request(method, path, qs, body, callback) {
  var self = this
    , req

  if (body && typeof body !== 'string') {
    body = JSON.stringify(body)
  }

  if (qs) {
    path = path + '?' + querystring.stringify(qs)
  }

  // TODO: CA.
  req = https.request({
    host: self.host,
    method: method.toUpperCase(),
    path: '/api/v' + self.version + path,
    headers: self.getHeaders(body)
  }, self.wrapCallback(callback))

  if (body) {
    req.write(body)
  }

  req.end()
}

//
// ## post
//
ZencoderClient.prototype.post = post
function post(path, body, callback) {
  var self = this

  if (typeof body === 'function') {
    callback = body
    body = null
  }

  self.request('POST', path, null, body, callback)
}

//
// ## get
//
ZencoderClient.prototype.get = get
function get(path, qs, callback) {
  var self = this

  if (typeof qs === 'function') {
    callback = qs
    qs = null
  }

  self.request('GET', path, qs, null, callback)
}

//
// ## put
//
ZencoderClient.prototype.put = put
function put(path, body, callback) {
  var self = this

  if (typeof body === 'function') {
    callback = body
    body = null
  }

  self.request('PUT', path, null, body, callback)
}

//
// ## wrapJobCallback
//
ZencoderClient.prototype.wrapJobCallback = wrapJobCallback
function wrapJobCallback(callback) {
  var self = this

  return function wrappedJob(err, body) {
  }
}

//
// ## watchProgress
//
ZencoderClient.prototype.watchProgress = watchProgress
function watchProgress(options, callback) {
  var self = this
}

//
// ## createJob
//
ZencoderClient.prototype.createJob = createJob
function createJob(job, callback) {
  var self = this

  self.post('/jobs', job, function (err, response) {
    if (err) {
      callback(err)
      return
    }

    self.addPendingJob(response.body.id, callback)
  })
}

//
// ## getJobProgress
//
ZencoderClient.prototype.getJobProgress = getJobProgress
function getJobProgress(jobId, callback) {
  var self = this

  self.get('/jobs/' + jobId + '/progress.json', callback)
}

//
// ## getJobDetails
//
ZencoderClient.prototype.getJobDetails = getJobDetails
function getJobDetails(jobId, callback) {
  var self = this

  self.get('/jobs/' + jobId + '.json', callback)
}

//
// ## listJobs
//
ZencoderClient.prototype.listJobs = listJobs
function listJobs(callback) {
  var self = this

  self.get('/jobs', callback)
}

//
// ## resubmitJob
//
ZencoderClient.prototype.resubmitJob = resubmitJob
function resubmitJob(jobId, callback) {
  var self = this

  self.put('/jobs/' + jobId + '/resubmit.json', callback)
}

//
// ## cancelJob
//
ZencoderClient.prototype.cancelJob = cancelJob
function cancelJob(jobId, callback) {
  var self = this

  self.put('/jobs/' + jobId + '/cancel.json', callback)
}

module.exports = ZencoderClient
