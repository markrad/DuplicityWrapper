// import fs from 'fs';
import { execSync, spawn } from 'child_process';
import EventEmitter from 'events';
import { TimeSpanOption } from './timespanoption';
export { TimeSpanOption };

export interface CommonOptions {
    url: string;
    // passPhrase can either be specified here or set up in the environment as PASSPHRASE
    passPhrase?: string;
    verbosity?: number | string;
    archiveDir?: string;
    name?: string;
    dryRun?: boolean;
    extraArgs?: string | string[];
    timeout?: number;
}

export interface SourceOptions extends CommonOptions {
    cwd: string;
    target: string;
}

export interface FullOptions extends SourceOptions { }

export interface IncrOptions extends FullOptions {
    fullIfOlderThan?: TimeSpanOption | Date;
}

export interface VerifyOptions extends FullOptions {
    fileToRestore?: string;
    time?: Date | TimeSpanOption;
    compareData: boolean;
}

export interface ListCurrentFilesOptions extends CommonOptions {
    cwd?: string;
    time?: Date | TimeSpanOption;
}

export interface RemoveOlderThanOptions extends CommonOptions {
    cwd?: string;
    time: Date | TimeSpanOption;
    force: boolean;
}

export interface RemoveAllButNFullOptions extends CommonOptions {
    cwd?: string;
    count: number;
    force: boolean;
}

export interface ConsoleOutput {
    stdout: string;
    stderr: string;
}

export interface CommandResult extends ConsoleOutput {
    rc: number;
}

export interface CommonResults {
    rc: number;
    command: string,
    Output: ConsoleOutput;
}

export interface FullResults extends CommonResults {
    result: {
        ElapsedTime: number;
        SourceFiles: number;
        SourceFileSize: number;
        NewFiles: number;
        NewFileSize: number;
        DeletedFiles: number;
        ChangedFiles: number;
        ChangedFileSize: number;
        DeltaEntries: number;
        TotalDestinationSizeChange: number;
        Errors: number,
        FullBackup: boolean;
    }
}

export interface IncrResults extends FullResults { }

export interface VerifyResults extends CommonResults {
    FilesCompared: number;
    DifferencesFound: number;
    LastFullBackupDate: Date;
}

export interface ListCurrentFilesResults extends CommonResults {
    Entries: ListFileEntry[];
}

export type ListFileEntry = {
    FileTime: Date;
    FileName: string;
}

export interface RemoveOlderThanResults extends CommonResults {
    requireForce: boolean;
    Entries: Date[];
}

export interface RemoveAllButNFullResults extends CommonResults {
    requireForce: boolean;
}

export class DuplicityWrapper extends EventEmitter {
    private _appPath: string;
    private _version: string;
    private static _instance: DuplicityWrapper = null;

    private static readonly days: string[] = ['Mon ', 'Tue ', 'Wed ', 'Thu ', 'Fri ', 'Sat '];

    private constructor(appPath?: string) {
        super();
        this._appPath = appPath ?? '/usr/bin/duplicity';
        this._version = execSync(`${this._appPath} --version`).toString('utf8').trimEnd();
    }

    public static getInstance(appPath?: string) {
        if (!DuplicityWrapper._instance) {
            DuplicityWrapper._instance = new DuplicityWrapper(appPath);
        }

        return DuplicityWrapper._instance;
    }

    get appPath() {
        return this._appPath;
    }

    get version() {
        return this._version;
    }

    async commandFull(options: FullOptions): Promise<FullResults> {
        return new Promise<FullResults>(async (resolve, reject) => {
            try {
                let args = ['full'];
                args = args.concat(DuplicityWrapper.buildExtraArgs(options.extraArgs), DuplicityWrapper.doCommon(options), [options.target, options.url]);
                let opts: any = { cwd: options.cwd, env: DuplicityWrapper.checkPassPhrase(options) };

                let rc = await DuplicityWrapper.runCommand(args, opts, options.timeout ?? 0);
                resolve(DuplicityWrapper.parseOutput(rc, args[0]));
            }
            catch (err) {
                reject(err);
            }
        });
    }

    async commandIncr(options: IncrOptions): Promise<IncrResults> {
        return new Promise<IncrResults>(async (resolve, reject) => {
            try {
                let args = ['incr'];
                if (options.fullIfOlderThan) {
                    args = args.concat(DuplicityWrapper.formatTime('--full-if-older-than', options.fullIfOlderThan));
                }
                args = args.concat(DuplicityWrapper.buildExtraArgs(options.extraArgs), DuplicityWrapper.doCommon(options), [options.target, options.url]);
                let opts: any = { cwd: options.cwd, env: DuplicityWrapper.checkPassPhrase(options) };

                let rc = await DuplicityWrapper.runCommand(args, opts, options.timeout ?? 0);
                resolve(DuplicityWrapper.parseOutput(rc, args[0]));
            }
            catch (err) {
                reject(err);
            }
        });
    }

    async commandIncremental(options: IncrOptions): Promise<IncrResults> {
        return this.commandIncr(options);
    }

    async commandVerify(options: VerifyOptions): Promise<VerifyResults> {
        return new Promise<VerifyResults>(async (resolve, reject) => {
            try {
                let args = ['verify'];
                if (options.time) args = args.concat(DuplicityWrapper.formatTime('--time', options.time));
                if (options.compareData) args.push('--compare-data');
                // TODO: Implement file-to-restore
                args = args.concat(DuplicityWrapper.buildExtraArgs(options.extraArgs), DuplicityWrapper.doCommon(options), [options.url, options.target]);
                let opts: any = { cwd: options.cwd, env: DuplicityWrapper.checkPassPhrase(options) };

                let rc = await DuplicityWrapper.runCommand(args, opts, options.timeout ?? 0);
                let matches = /Verify complete: (\d*) files compared, (\d*) /.exec(rc.stdout);
                let backup = /Last full backup date: (.*)/.exec(rc.stdout);
                if (matches == null || backup == null) reject(new Error('Unable to parse verify output'));
                resolve({ rc: rc.rc, command: args[0], FilesCompared: parseInt(matches[1]), DifferencesFound: parseInt(matches[2]), LastFullBackupDate: new Date(backup[1]), Output: { stdout: rc.stdout, stderr: rc.stderr } });
            }
            catch (err) {
                reject(err);
            }
        });
    }

    async commandCollectionStatus(_options: any): Promise<string> {
        return new Promise<string>((_resolve, _reject) => {
            throw new Error('Not implemented');
        })
    }

    async commandListCurrentFiles(options: ListCurrentFilesOptions): Promise<ListCurrentFilesResults> {
        return new Promise<ListCurrentFilesResults>(async (resolve, reject) => {
            try {
                let args = ['list-current-files'];
                if (options.time) {
                    args = args.concat(DuplicityWrapper.formatTime('--time', options.time));
                }
                args = args.concat(DuplicityWrapper.buildExtraArgs(options.extraArgs), DuplicityWrapper.doCommon(options), [options.url]);
                let opts: any = { env: DuplicityWrapper.checkPassPhrase(options) };
                if (options.cwd) opts['cwd'] = options.cwd;

                let rc = await DuplicityWrapper.runCommand(args, opts, options.timeout ?? 0);
                let data: ListFileEntry[] = [];
                let lines = rc.stdout.split('\n').filter((value: string) => DuplicityWrapper.days.includes(value.substring(0, 4)));
                lines.forEach((value: string) => {
                    let parts = value.split(' ');
                    let timestamp = new Date(parts.slice(0, 4).join(' '));
                    let filename = parts.slice(5).join(' ');
                    data.push({ FileName: filename, FileTime: timestamp });
                });
                resolve({ rc: rc.rc, command: args[0], Entries: data, Output: { stdout: rc.stdout, stderr: rc.stderr } });
            }
            catch (err) {
                reject(err);
            }
        });
    }

    async commandRestore(_options: any): Promise<string> {
        return new Promise<string>((_resolve, _reject) => {
            throw new Error('Not implemented');
        })
    }

    async commandRemoveOlderThan(options: RemoveOlderThanOptions): Promise<RemoveOlderThanResults> {
        return new Promise<RemoveOlderThanResults>(async (resolve, reject) => {
            try {
                let args = ['remove-older-than'];
                args = args.concat(DuplicityWrapper.formatTime(null, options.time));
                if (options.force) args.push('--force');
                args = args.concat(DuplicityWrapper.buildExtraArgs(options.extraArgs), DuplicityWrapper.doCommon(options), [ options.url ]);
                let opts: any = { env: DuplicityWrapper.checkPassPhrase(options) };
                if (options.cwd) opts['cwd'] = options.cwd;

                let rc = await DuplicityWrapper.runCommand(args, opts, options.timeout ?? 0);
                let data: RemoveOlderThanResults = { rc: rc.rc, command: args[0], requireForce: (-1 != rc.stdout.indexOf('Rerun command with --force')), Entries: [], Output: { stdout: rc.stdout, stderr: rc.stderr} };
                if (rc.stdout.indexOf('No old backup sets found') > -1) {
                    data.Entries = rc.stdout.split('\n').filter((value: string) => DuplicityWrapper.days.includes(value.substring(0, 4))).map((value) => new Date(value));
                }
                resolve(data);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    async commandRemoveAllButNFull(options: RemoveAllButNFullOptions): Promise<RemoveAllButNFullResults> {
        return new Promise<RemoveAllButNFullResults>(async (resolve, reject) => {
            try {
                let args = ['remove-all-but-n-full'];
                args = args.concat(options.count.toString());
                if (options.force) args.push('--force');
                args.push(options.url);
                let opts: any = { env: DuplicityWrapper.checkPassPhrase(options) };
                if (options.cwd) opts['cwd'] = options.cwd;

                let rc = await DuplicityWrapper.runCommand(args, opts, options.timeout ?? 0);
                let data: RemoveAllButNFullResults = { rc: rc.rc, command: args[0], requireForce: (-1 != rc.stdout.indexOf('Rerun command with --force')), Output: { stderr: rc.stderr, stdout: rc.stdout} };
                resolve(data);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    async commandRemoveAllIncOfButNFull(_options: any): Promise<string> {
        return new Promise<string>((_resolve, _reject) => {
            throw new Error('Not implemented');
        })
    }

    async commandCleanup(_options: any): Promise<string> {
        return new Promise<string>((_resolve, _reject) => {
            throw new Error('Not implemented');
        })
    }

    async commandReplicate(_options: any): Promise<string> {
        return new Promise<string>((_resolve, _reject) => {
            throw new Error('Not implemented');
        })
    }

    private static checkPassPhrase(options: CommonOptions): any {
        let result = { ...process.env };

        if (options && options?.passPhrase) {
            result = { ...process.env, PASSPHRASE: options.passPhrase };
        }
        else if (!process.env['PASSPHRASE']) {
            throw new Error('Pass phrase must be provided');
        }

        return result;
    }

    private static doCommon(common: CommonOptions): string[] {
        let commonOptions: string[] = [];

        if (common) {
            if (common.name) commonOptions.push('--name', common.name);
            if (common.dryRun && common.dryRun == true) commonOptions.push('--dryrun');
            if (common.archiveDir) commonOptions.push('--archive-dir', common.archiveDir);
            if (common.verbosity) commonOptions.push('--verbosity', common.verbosity.toString());
        }

        return commonOptions;
    }

    private static buildExtraArgs(args: string | string[]): string[] {
        let extraArgs = args ?? [];
        return Array.isArray(extraArgs) ? extraArgs : extraArgs.split(' ');
    }

    private static formatTime(optionName: string, value: Date | TimeSpanOption): string[] {
        let olderThan: Date;
        if (value instanceof TimeSpanOption) {
            olderThan = value.subtractFromDate(new Date());
        }
        else if (value instanceof Date) {
            olderThan = value;
        }
        else {
            throw new Error('Invalid type passed for date');
        }
        if (olderThan.getTime() == NaN || olderThan.getTime() >= Date.now()) {
            throw new Error('Invalid date passed for fullIfOlderThan');
        }

        let result: string[] = optionName == null? [] : [ optionName ];
        result = result.concat((Math.floor(olderThan.getTime() / 1000).toString()));

        return result;
    }

    private static async runCommand(args: string[], opts: any, timeout: number): Promise<CommandResult> {
        return new Promise<CommandResult>((resolve, reject) => {
            let errs = '';
            let out = '';
            let cmd = `duplicity ${args.join(' ')}`;
            DuplicityWrapper._instance.emit('command', cmd);
            let sp = spawn('duplicity', args, opts);
            let timer: NodeJS.Timer = null;

            if (timeout > 0) {
                timer = setTimeout(() => {
                    if (sp.exitCode != null) {
                        sp.kill('SIGTERM');
                        reject(new Error(`Command ${cmd} timed out - check for input prompt`));
                    }
                }, timeout * 1000);
            }
            sp.stdout.on("data", (data: any) => {
                out += data;
            });

            sp.stderr.on("data", (data: any) => {
                errs += data;
            });

            sp.on('error', (error: any) => {
                reject(error);
            });

            sp.on("close", (code: any) => {
                clearTimeout(timer);
                DuplicityWrapper._instance.emit('stdout', out);
                DuplicityWrapper._instance.emit('stderr', errs);
                DuplicityWrapper._instance.emit('close');
                resolve({ rc: code, stdout: out, stderr: errs });
            });
        });
    }

    private static parseOutput(result: CommandResult, command: string): FullResults {
        if (result.rc != 0) {
            throw new Error(`Return code = ${result.rc}: ${result.stderr}`);
        }
        try {
            let ret: FullResults = {
                rc: result.rc,
                command: command,
                result: {
                    ElapsedTime: parseFloat(/\nElapsedTime (\d*\.\d*)/.exec(result.stdout)[1]),
                    SourceFiles: parseInt(/\nSourceFiles (\d*)/.exec(result.stdout)[1]),
                    SourceFileSize: parseInt(/\nSourceFileSize (\d*)/.exec(result.stdout)[1]),
                    NewFiles: parseInt(/\nNewFiles (\d*)/.exec(result.stdout)[1]),
                    NewFileSize: parseInt(/\nNewFileSize (\d*)/.exec(result.stdout)[1]),
                    DeletedFiles: parseInt(/\nDeletedFiles (\d*)/.exec(result.stdout)[1]),
                    ChangedFiles: parseInt(/\nChangedFiles (\d*)/.exec(result.stdout)[1]),
                    ChangedFileSize: parseInt(/\nChangedFileSize (\d*)/.exec(result.stdout)[1]),
                    DeltaEntries: parseInt(/\nDeltaEntries (\d*)/.exec(result.stdout)[1]),
                    TotalDestinationSizeChange: parseInt(/\nTotalDestinationSizeChange (\d*)/.exec(result.stdout)[1]),
                    Errors: parseInt(/\nErrors (\d*)/.exec(result.stdout)[1]),
                    FullBackup: command == 'full' ? true : null != /\nLast full backup is too old/.exec(result.stdout),
                },
                Output: { stdout: result.stdout, stderr: result.stderr },
            }
            return ret;
        }
        catch (err) {
            throw new Error('Parsing error: ' + err.message);
        }
    }
}
