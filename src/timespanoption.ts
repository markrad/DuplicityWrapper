const MILLIS_PER_SECOND = 1000;
const MILLIS_PER_MINUTE = MILLIS_PER_SECOND * 60;
const MILLIS_PER_HOUR = MILLIS_PER_MINUTE * 60;
const MILLIS_PER_DAY = MILLIS_PER_HOUR * 24;
const MILLIS_PER_WEEK = MILLIS_PER_DAY * 7;
const MILLIS_PER_MONTH = MILLIS_PER_DAY * 30;
const MILLIS_PER_YEAR = MILLIS_PER_DAY * 365;

enum Scale {
    milliseconds = 1,
    seconds = MILLIS_PER_SECOND,
    minutes = MILLIS_PER_MINUTE,
    hours = MILLIS_PER_HOUR,
    days = MILLIS_PER_DAY
}

export class TimeSpanOption {

    private _millis: number;

    private static interval(value: number, scale: Scale): TimeSpanOption {
        if (value == null || value == undefined) throw new Error('value must be provided');

        const millis = TimeSpanOption.round(value * scale + (value >= 0? 0.5: -0.5));

        return new TimeSpanOption(millis);
    }

    private static round(value: number) {
        return value < 0
            ? Math.ceil(value)
            : value > 0
            ? Math.floor(value)
            : 0;
    }

    public static get zero(): TimeSpanOption {
        return new TimeSpanOption(0);
    }

    public static get maxValue(): TimeSpanOption {
        return new TimeSpanOption(Number.MAX_SAFE_INTEGER);
    }

    public static get minValue(): TimeSpanOption {
        return new TimeSpanOption(Number.MIN_SAFE_INTEGER);
    }

    public static fromDays(value: number): TimeSpanOption {
        return TimeSpanOption.interval(value, MILLIS_PER_DAY);
    }

    public static fromHours(value: number): TimeSpanOption {
        return TimeSpanOption.interval(value, MILLIS_PER_HOUR);
    }

    public static fromMilliseconds(value: number): TimeSpanOption {
        return TimeSpanOption.interval(value, 1);
    }

    public static fromMinutes(value: number): TimeSpanOption {
        return TimeSpanOption.interval(value, MILLIS_PER_MINUTE);
    }

    public static fromSeconds(value: number): TimeSpanOption {
        return TimeSpanOption.interval(value, MILLIS_PER_SECOND);
    }

    public static fromTime(...args: [hours: number, minutes: number, seconds: number] | [days: number, hours: number, minutes: number, seconds: number, milliseconds: number]): TimeSpanOption {
        return args.length == 5
            ? TimeSpanOption.fromTimeStartingFromDays(args[0], args[1], args[2], args[3], args[4])
            : TimeSpanOption.fromTimeStartingFromDays(0, args[0], args[1], args[2], 0);
    }

    public static fromDuplicitySpan(value: string) {
        // As documented in Duplicity manual such as 3Y2W = 3 years and 2 weeks, 1h10m = 1 hour 10 minutes. Same limitation applies for month and year spans (30 and 365 days respectively)
        const calc: { [char: string]: number} = { s: MILLIS_PER_SECOND, m: MILLIS_PER_MINUTE, h: MILLIS_PER_HOUR, D: MILLIS_PER_DAY, W: MILLIS_PER_WEEK, M: MILLIS_PER_MONTH, Y: MILLIS_PER_YEAR}
        value = value.trimEnd().trimStart();
        let re = /\d*[smhDWMY]/g;
        let match: any;
        let total = 0;

        while (null != (match = re.exec(value))) {
            if (re.lastIndex - match.index != match[0].length) {
                throw new Error(`Time string ${value} is invalid`);
            }
            let num = parseInt(match[0].substring(0, match[0].length));
            let scale: string = match[0].charAt(match[0].length - 1);
            total += num * calc[scale];
        }

        return new TimeSpanOption(total);
    }

    private static fromTimeStartingFromDays(days: number, hours: number, minutes: number, seconds: number, milliseconds: number): TimeSpanOption {
        return new TimeSpanOption(days * MILLIS_PER_DAY + hours * MILLIS_PER_HOUR + minutes * MILLIS_PER_MINUTE + seconds * MILLIS_PER_SECOND + milliseconds);
    }

    constructor(millis: number) {
        if (millis > Number.MAX_SAFE_INTEGER || millis < Number.MIN_SAFE_INTEGER) throw new Error('value is outside valid range');

        this._millis = millis;
    }

    public get days(): number {
        return TimeSpanOption.round(this.totalMilliseconds / MILLIS_PER_DAY);
    }

    public get hours(): number {
        return TimeSpanOption.round((this.totalMilliseconds / MILLIS_PER_HOUR) % 24);
    }

    public get minutes(): number {
        return TimeSpanOption.round((this.totalMilliseconds / MILLIS_PER_MINUTE) % 60);
    }

    public get seconds(): number {
        return TimeSpanOption.round((this.totalMilliseconds / MILLIS_PER_SECOND) % 60);
    }

    public get milliseconds(): number {
        return TimeSpanOption.round(this.totalMilliseconds % 1000);
    }

    public get totalDays(): number {
        return this.totalMilliseconds / MILLIS_PER_DAY;
    }

    public get totalHours(): number {
        return this.totalMilliseconds / MILLIS_PER_HOUR;
    }

    public get totalMinutes(): number {
        return this.totalMilliseconds / MILLIS_PER_MINUTE;
    }

    public get totalSeconds(): number {
        return this.totalMilliseconds / MILLIS_PER_SECOND;
    }

    public get totalMilliseconds(): number {
        return this._millis;
    }

    public add(ts: TimeSpanOption): TimeSpanOption {
        return new TimeSpanOption(this.totalMilliseconds + ts.totalMilliseconds);
    }

    public subtract(ts: TimeSpanOption): TimeSpanOption {
        return new TimeSpanOption(this.totalMilliseconds - ts.totalMilliseconds);
    }

    public subtractFromDate(date: Date): Date {
        return new Date(date.getTime() - this.totalMilliseconds);
    }

    public addToDate(date: Date): Date {
        return new Date(date.getTime() + this.totalMilliseconds);
    }
}
