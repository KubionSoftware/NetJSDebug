"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const WebSocket = require('ws');
class NetJSRuntime extends events_1.EventEmitter {
    constructor() {
        super();
        this._breakPoints = new Map();
        // since we want to send breakpoint events, we will assign an id to every event
        // so that the frontend can match events with breakpoints.
        this._breakpointId = 1;
        this._startBuffer = new Array();
        this._stack = null;
        this._scopes = new Array();
    }
    get sourceFile() {
        return this._sourceFile;
    }
    /**
     * Start executing the given program.
     */
    start(program, localRoot) {
        this._socket = new WebSocket(program);
        var runtime = this;
        this._socket.on("open", function () {
            runtime.send({ command: "start" });
            for (var i = 0; i < runtime._startBuffer.length; i++) {
                runtime.send(runtime._startBuffer[i]);
            }
        });
        this._socket.on("error", function () {
        });
        this._socket.on("message", function (message) {
            var data = JSON.parse(message);
            if ("event" in data) {
                if (data.event == "breakpointValidated") {
                    runtime.sendEvent(data.event, { verified: data.breakpoint.verified, line: data.breakpoint.line, id: data.breakpoint.id });
                }
                else {
                    data.stack.frames = data.stack.frames.map(s => {
                        s.file = localRoot + "/" + s.file;
                        return s;
                    });
                    runtime._stack = data.stack;
                    runtime._scopes = data.scopes;
                    runtime.sendEvent(data.event);
                }
            }
        });
    }
    stop() {
        this._socket.close();
    }
    send(data) {
        if (!this._socket) {
            this._startBuffer.push(data);
        }
        else {
            try {
                this._socket.send(JSON.stringify(data));
            }
            catch (e) {
            }
        }
    }
    /**
     * Continue execution to the end/beginning.
     */
    continue(reverse = false) {
        this.send({
            command: "continue",
            reverse: reverse
        });
    }
    stepInto() {
        this.send({
            command: "stepInto"
        });
    }
    stepOut() {
        this.send({
            command: "stepOut"
        });
    }
    stepOver() {
        this.send({
            command: "stepOver"
        });
    }
    /**
     * Returns a fake 'stacktrace' where every 'stackframe' is a word from the current line.
     */
    stack(startFrame, endFrame) {
        if (this._stack) {
            return this._stack;
        }
        else {
            return { frames: [], count: 0 };
        }
    }
    scopes(frameReference) {
        if (this._scopes) {
            return this._scopes;
        }
        else {
            return [];
        }
    }
    variables(id) {
        if (this._scopes) {
            for (var i = 0; i < this._scopes.length; i++) {
                var scope = this._scopes[i];
                if (scope.name + "_1" == id) {
                    return scope.variables;
                }
            }
        }
        return {};
    }
    /*
     * Set breakpoint in file with given line.
     */
    setBreakPoint(path, line) {
        const bp = { verified: false, line, id: this._breakpointId++ };
        this.send({
            command: "setBreakpoint",
            id: bp.id,
            file: path,
            line: line
        });
        return bp;
    }
    /*
     * Clear breakpoint in file with given line.
     */
    clearBreakPoint(path, line) {
        let bps = this._breakPoints.get(path);
        if (bps) {
            const index = bps.findIndex(bp => bp.line === line);
            if (index >= 0) {
                const bp = bps[index];
                bps.splice(index, 1);
                this.send({
                    command: "clearBreakpoint",
                    file: path,
                    line: line
                });
                return bp;
            }
        }
        return undefined;
    }
    /*
     * Clear all breakpoints for file.
     */
    clearBreakpoints(path) {
        this.send({
            command: "clearBreakpoints",
            file: path
        });
    }
    sendEvent(event, ...args) {
        setImmediate(_ => {
            this.emit(event, ...args);
        });
    }
}
exports.NetJSRuntime = NetJSRuntime;
//# sourceMappingURL=NetJSRuntime.js.map