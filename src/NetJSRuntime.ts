import { EventEmitter } from 'events';

declare function require(name:string);
const WebSocket = require('ws');

export interface NetJSBreakpoint {
	id: number;
	line: number;
	verified: boolean;
}

export class NetJSRuntime extends EventEmitter {

	// the initial (and one and only) file we are 'debugging'
	private _sourceFile: string;
	public get sourceFile() {
		return this._sourceFile;
	}

	private _breakPoints = new Map<string, NetJSBreakpoint[]>();

	// since we want to send breakpoint events, we will assign an id to every event
	// so that the frontend can match events with breakpoints.
	private _breakpointId = 1;

	private _socket: any;
	private _startBuffer = new Array();

	private _stack = null;
	private _scopes = new Array();

	constructor() {
		super();
	}

	/**
	 * Start executing the given program.
	 */
	public start(program: string, localRoot: string) {
		this._socket = new WebSocket(program);

		var runtime = this;

		this._socket.on("open", function(){
			runtime.send({command: "start"});

			for(var i = 0; i < runtime._startBuffer.length; i++){
				runtime.send(runtime._startBuffer[i]);
			}
		});

		this._socket.on("error", function(){

		});

		this._socket.on("message", function(message){
			var data = JSON.parse(message);

			if("event" in data){
				if(data.event == "breakpointValidated"){
					runtime.sendEvent(data.event, <NetJSBreakpoint> {verified: data.breakpoint.verified, line: data.breakpoint.line, id: data.breakpoint.id});
				}else{
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

	public stop(){
		this._socket.close();
	}

	public send(data){
		if(!this._socket){
			this._startBuffer.push(data);
		}else{
			try{
				this._socket.send(JSON.stringify(data));
			}catch(e){

			}
		}
	}

	/**
	 * Continue execution to the end/beginning.
	 */
	public continue(reverse = false) {
		this.send({
			command: "continue",
			reverse: reverse
		});
	}

	public stepInto() {
		this.send({
			command: "stepInto"
		});
	}

	public stepOut() {
		this.send({
			command: "stepOut"
		});
	}

	public stepOver() {
		this.send({
			command: "stepOver"
		});
	}

	/**
	 * Returns a fake 'stacktrace' where every 'stackframe' is a word from the current line.
	 */
	public stack(startFrame: number, endFrame: number): any {
		if(this._stack){
			return this._stack;
		}else{
			return {frames: [], count: 0}
		}
	}

	public scopes(frameReference: number): any {
		if(this._scopes){
			return this._scopes;
		}else{
			return [];
		}
	}

	public variables(id: string): any {
		if(this._scopes){
			for(var i = 0; i < this._scopes.length; i++){
				var scope = this._scopes[i];
				if(scope.name + "_1" == id){
					return scope.variables;
				}
			}
		}

		return {};
	}

	/*
	 * Set breakpoint in file with given line.
	 */
	public setBreakPoint(path: string, line: number) : NetJSBreakpoint {
		const bp = <NetJSBreakpoint> { verified: false, line, id: this._breakpointId++ };
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
	public clearBreakPoint(path: string, line: number) : NetJSBreakpoint | undefined {
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
	public clearBreakpoints(path: string): void {
		this.send({
			command: "clearBreakpoints",
			file: path
		});
	}

	private sendEvent(event: string, ... args: any[]) {
		setImmediate(_ => {
			this.emit(event, ...args);
		});
	}
}