import debug from 'debug';
export declare class Logger {
    private readonly _debug;
    private readonly _warn;
    private readonly _error;
    constructor(prefix?: string);
    readonly debug: debug.Debugger;
    readonly warn: debug.Debugger;
    readonly error: debug.Debugger;
}
//# sourceMappingURL=Logger.d.ts.map