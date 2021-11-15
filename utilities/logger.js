

class log {
	constructor(debug) {
		this.debug = debug;
	}

	info(message) { console.log(`[INFO] ${message}`); }
	debugs(message) { if (this.debug) console.log(`[DEBUG] ${message}`); }
}

module.exports = { log };