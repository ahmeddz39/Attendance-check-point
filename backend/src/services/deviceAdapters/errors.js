class DeviceProtocolError extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.statusCode = 502;
  }
}

module.exports = { DeviceProtocolError };
