import { MicrodataConverter } from "./converter/MicrodataConverter";
import { DataJsonConverter } from "./converter/DataJsonConverter";
import { DisplayJsonConverter } from "./converter/DisplayJsonConverter";
import { DisplayTextConverter } from "./converter/DisplayTextConverter";
import { normalizeLocalDate } from "./helpers";

export declare type DateType = Date | number | string;

export declare interface DateTimeObject {
  from: DateType;
  until: DateType;
}

export declare interface OpenTimeInternal {
  from: Date;
  until: Date;
  text?: string;
}

export declare interface OpenTimeInput extends DateTimeObject {
  day: WeekDays;
}

export declare interface OpenTimeRemovableInput {
  day?: WeekDays;
  days?: WeekDays[];
  from?: DateType;
  until?: DateType;
  spans?: Array<{ from?: DateType; until?: DateType }>;
}

export declare interface OpenTimeOutput {
  day: WeekDays;
  from: string;
  until: string;
  text?: string;
}

export declare interface OpenTimeResultOutput {
  active: boolean;
  day: string;
  times: Array<{
    from: string;
    until: string;
  }>;
}

export declare interface OpeningHoursOptions {
  weekStart?: WeekDays;
  currentDate?: Date;
  currentDayOnTop?: boolean;
  locales?: string;
  dateTimeFormatOptions?: Intl.DateTimeFormatOptions;
  showClosedDays?: boolean;
  text?: {
    timespanSeparator?: string;
    weekDays?: string[];
    closed?: string;
  };
}

export enum WeekDays {
  Sunday = 0,
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
  Saturday = 6,
}

export enum OpenState {
  Closed,
  Open,
}

export const WeekDaysShort = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export class OpeningHours {
  static readonly defaultOptions: OpeningHoursOptions = {
    weekStart: WeekDays.Monday,
    currentDate: new Date(),
    currentDayOnTop: false,
    locales: "de-DE",
    dateTimeFormatOptions: {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      minute: "2-digit",
    },
    text: {
      closed: "closed",
      timespanSeparator: " - ",
      weekDays: WeekDaysShort,
    },
  };

  readonly options!: OpeningHoursOptions;
  readonly text: {
    timespanSeparator: string;
    weekDays: string[];
    closed: string;
    break: string;
  };

  // TODO: add some info text to seasonal opening/closing times
  get times(): OpenTimeInternal[][] {
    const { currentDate } = this.options;
    const now = currentDate || new Date();
    const weekDay = now.getDay();
    const result = this.internalTimes.default.slice(0);
    const emptyTimes = [[], [], [], [], [], [], []];
    for (const season of this.internalTimes.seasons.values()) {
      for (let i = 0; i < 7; i++) {
        if (weekDay > i) {
          now.setDate(now.getDate() - (weekDay - i));
        } else {
          now.setDate(now.getDate() + i);
        }
        if (now >= season.fromDate && now <= season.untilDate) {
          result[i] = (season.times || emptyTimes)[i].slice(0);
        }
      }
    }
    return result;
  }

  private internalTimes: {
    default: OpenTimeInternal[][];
    seasons: Set<{
      fromDate: Date;
      untilDate: Date;
      text?: string;
      times?: OpenTimeInternal[][];
    }>;
  };

  constructor(options: OpeningHoursOptions = {}) {
    // prepare options
    this.options = { ...OpeningHours.defaultOptions, ...options };

    // prepare translations object
    this.text = {
      ...(OpeningHours.defaultOptions.text || {}),
      ...this.options.text,
    } as never;

    // setup a 2D array for 7 days, started by sunday.
    this.internalTimes = {
      default: [[], [], [], [], [], [], []],
      seasons: new Set(),
    };
  }

  getState(now = new Date()) {
    // make sure the timeZone is set with a value.
    // At least the local time of the current client.
    const { timeZone } = Intl.DateTimeFormat(
      this.options.locales,
      this.options.dateTimeFormatOptions
    ).resolvedOptions();
    const current = normalizeLocalDate(now, timeZone);
    const day = current.getDay();
    for (const time of this.internalTimes.default[day]) {
      const from = new Date(
        current.getFullYear(),
        current.getMonth(),
        current.getDate(),
        time.from.getHours(),
        time.from.getMinutes(),
        time.from.getSeconds()
      );
      const until = new Date(
        current.getFullYear(),
        current.getMonth(),
        current.getDate(),
        time.until.getHours(),
        time.until.getMinutes(),
        time.until.getSeconds()
      );
      if (from <= current && until >= current) {
        return OpenState.Open;
      }
    }
    return OpenState.Closed;
  }

  /**
   * Check if the subject is opening soon. Default is 30 minutes or
   * 1800 seconds.
   */
  isOpenSoon(now = new Date(), elapseSeconds?: number) {
    // make sure the timeZone is set with a value.
    // At least the local time of the current client.
    const { timeZone } = Intl.DateTimeFormat(
      this.options.locales,
      this.options.dateTimeFormatOptions
    ).resolvedOptions();
    const current = normalizeLocalDate(now, timeZone);
    const day = current.getDay();
    const soon = new Date(current);
    soon.setSeconds(soon.getSeconds() + (elapseSeconds || 1800));
    for (const time of this.times[day]) {
      const from = new Date(
        current.getFullYear(),
        current.getMonth(),
        current.getDate(),
        time.from.getHours(),
        time.from.getMinutes(),
        time.from.getSeconds()
      );
      if (from >= current && from <= soon) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if the subject is closing soon. Default is 30 minutes or
   * 1800 seconds.
   */
  isClosedSoon(now = new Date(), elapseSeconds?: number) {
    // make sure the timeZone is set with a value.
    // At least the local time of the current client.
    const { timeZone } = Intl.DateTimeFormat(
      this.options.locales,
      this.options.dateTimeFormatOptions
    ).resolvedOptions();
    const current = normalizeLocalDate(now, timeZone);
    const day = current.getDay();
    const soon = normalizeLocalDate(now, timeZone);
    soon.setSeconds(soon.getSeconds() + (elapseSeconds || 1800));
    for (const time of this.times[day]) {
      const from = new Date(
        current.getFullYear(),
        current.getMonth(),
        current.getDate(),
        time.from.getHours(),
        time.from.getMinutes(),
        time.from.getSeconds()
      );
      const until = new Date(
        current.getFullYear(),
        current.getMonth(),
        current.getDate(),
        time.until.getHours(),
        time.until.getMinutes(),
        time.until.getSeconds()
      );
      if (
        (from > soon || until < soon) &&
        from <= current &&
        until >= current
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns the local time string of the next opening time.
   */
  getNextOpenTime(now = new Date()) {
    // make sure the timeZone is set with a value.
    // At least the local time of the current client.
    const { timeZone } = Intl.DateTimeFormat(
      this.options.locales,
      this.options.dateTimeFormatOptions
    ).resolvedOptions();
    const { locales } = this.options;
    const format: Intl.DateTimeFormatOptions = {
      ...this.options.dateTimeFormatOptions,
    };
    delete format.timeZone;
    const current = this.normalizeLocalDate(now, timeZone);
    const day = current.getDay();
    for (const time of this.times[day]) {
      const { from, until } = time;
      if (from > current && until > current) {
        return from.toLocaleTimeString(locales, format);
      }
    }
    return this.options.text?.closed;
  }

  /**
   * add a single time object and optimize it
   */
  add(day: WeekDays, from: DateType, until: DateType) {
    const time = { day, from, until };
    const optimized = this.optimize(time);
    this.addIfNotExist(optimized);
    this.postOptimize();
  }

  /**
   * Cut a timespan out of the opening hours.
   */
  cut(days: WeekDays | WeekDays[], from: DateType, until: DateType) {
    if ("number" === typeof days) {
      days = [days];
    }
    const optimized = [];
    for (const day of days) {
      const time = { day, from, until };
      // The second value (if exists) in the optimized array is the
      // time after midnight from the next day. This must not be
      // used in this case, so we avoid wrong remove operations.
      optimized.push(this.optimize(time).shift());
    }
    this.cutTimespans(optimized);
    this.postOptimize();
  }

  /**
   * Cut multiple chunks out of the opening hours.
   */
  cutMulti(removables: Array<OpenTimeRemovableInput>) {
    const optimizedRemovables = [];
    for (const removable of removables) {
      const days = [];
      const times = [];
      if ("undefined" !== typeof removable.days) {
        days.push(...removable.days);
      } else if ("number" === typeof removable.day) {
        days.push(removable.day);
      }

      if ("undefined" !== typeof removable.spans) {
        for (const span of removable.spans) {
          for (const day of days) {
            times.push({
              day,
              from: span.from || "0000",
              until: span.until || "2359",
            });
          }
        }
      } else {
        for (const day of days) {
          times.push({
            day,
            from: removable.from || "0000",
            until: removable.until || "2359",
          });
        }
      }

      for (const time of times) {
        optimizedRemovables.push(this.optimize(time).shift());
      }
    }

    this.cutTimespans(optimizedRemovables);
    this.postOptimize();
  }

  /**
   * loading a list of time objects and optimize them
   */
  load(times: OpenTimeInput[]) {
    this.internalTimes.default.forEach((times) => times.splice(0));
    for (const time of times) {
      const optimized = this.optimize(time);
      this.addIfNotExist(optimized);
    }
    this.postOptimize();
  }

  /**
   * Creates normalized JSON format.
   */
  toJSON(options: OpeningHoursOptions = {}) {
    const converter = new DataJsonConverter();
    return converter.convert(this, {
      ...this.options,
      ...options,
    });
  }

  /**
   * Creates an array output for opening hours.
   */
  toLocaleJSON(options: OpeningHoursOptions = {}) {
    const converter = new DisplayJsonConverter();
    return converter.convert(this, {
      ...this.options,
      ...options,
    });
  }

  /**
   * Creates a string or a string array output of opening hours
   * in microdata format.
   */
  toMicrodata(options: OpeningHoursOptions = {}) {
    const converter = new MicrodataConverter();
    return converter.convert(this, {
      ...this.options,
      ...options,
    });
  }

  /**
   * Creates a string output for opening hours.
   */
  toString(options: OpeningHoursOptions = {}) {
    const converter = new DisplayTextConverter();
    return converter.convert(this, {
      ...this.options,
      ...options,
    });
  }

  /**
   * Creates a date object from currentDate and the given
   * opening hours time.
   */
  private getTimeByCurrentDay(date: Date | [number, number, number, number]) {
    if (Array.isArray(date)) {
      const { currentDate } = this.options;
      const now = currentDate || new Date();
      const [day, hours, minutes, seconds] = date;
      const dayOffset = day - now.getDay();

      return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + dayOffset,
        hours,
        minutes,
        seconds
      );
    } else {
      const timeZone = this.options.dateTimeFormatOptions?.timeZone;
      const result = date.toLocaleString("sv", { timeZone });
      return new Date(result.replace(" ", "T"));
    }
  }

  /**
   * add new time entry if it does not exist
   */
  private addIfNotExist(optimizedTimes: OpenTimeInternal[]) {
    for (const time of optimizedTimes) {
      const times = this.internalTimes.default[time.from.getDay()];
      times.push(time);
    }
  }

  /**
   * this method is the magical unicorn that gets all the funky shit done!
   * - Interpreting Date, Unix Timestamp, ISO 8601 DateTime => CHECK
   * - Interpreting fuzzy 24h time strings => CHECK
   */
  private normalizeTimeString(
    time: Date | number | string,
    day: WeekDays,
    pattern = /\d{1,2}/g
  ) {
    const date = new Date(time);
    if (
      "Invalid Date" !== date.toString() &&
      "string" === typeof time &&
      24 === time.length
    ) {
      return this.getTimeByCurrentDay(date);
    } else if ("string" === typeof time) {
      const matched = time.match(pattern);
      if (matched) {
        let [hours, minutes, seconds] = matched
          .slice(0, 3)
          .map((n) => parseInt(n));

        // make sure second has a valid value.
        if ("undefined" === typeof seconds) {
          seconds = 0;
        }

        // I'm zeroing the values 24:00 and 23:59,
        // because I need a solid foundation to
        // normalize for after midnight

        if (hours === 24 && minutes === 0) {
          hours = 0;
        }
        if (hours === 23 && minutes === 59) {
          hours = 0;
          minutes = 0;
        }
        const date = this.getTimeByCurrentDay([day, hours, minutes, seconds]);
        if (date.getDay() !== day) {
          date.setDate(date.getDate() - 1);
        }
        return date;
      }
    }
    throw new Error(`Invalid time string: ${time}`);
  }

  /**
   * Make sure the until time for midnight is 23:59
   */
  private normalizeUntilTime(date: Date) {
    if (date.getHours() === 0 && date.getMinutes() === 0) {
      date.setHours(23);
      date.setMinutes(59);
    }
  }

  /**
   * Optimize incoming timespans, convert them to Date format and handle timespans
   * that extend beyond midnight.
   */
  private optimize(
    time: OpenTimeInput,
    removePattern?: RegExp
  ): OpenTimeInternal[] {
    const internal: OpenTimeInternal = {
      from: this.normalizeTimeString(time.from, time.day, removePattern),
      until: this.normalizeTimeString(time.until, time.day, removePattern),
    };
    this.normalizeUntilTime(internal.until);

    internal.from.setDate(internal.from.getDate());
    internal.until.setDate(internal.until.getDate());

    if (internal.until < internal.from) {
      internal.until.setDate(internal.until.getDate() + 1);
      return [
        {
          from: internal.from,
          until: this.getTimeByCurrentDay([internal.from.getDay(), 23, 59, 0]),
        },
        {
          from: this.getTimeByCurrentDay([internal.until.getDay(), 0, 0, 0]),
          until: internal.until,
        },
      ];
    }
    return [internal];
  }

  /**
   * Executes sort and merge functions to every timespan on every weekday.
   */
  private postOptimize() {
    for (const times of this.internalTimes.default.values()) {
      this.sort(times);
      this.mergeTimespans(times);
    }
  }

  /**
   * Sort the timespans by start time.
   */
  private sort(times: OpenTimeInternal[]) {
    times.sort((a, b) =>
      a.from < b.from || a.until < b.from ? -1 : a.from > b.until ? 1 : 0
    );
  }

  /**
   * Tool to merge multiple overlapping timespans.
   */
  private mergeTimespans(times: OpenTimeInternal[]) {
    const tmp = times.splice(0);
    let last!: OpenTimeInternal;
    for (const time of tmp) {
      if (!last || time.from > last.until) {
        times.push(time);
        last = time;
      } else if (time.until > last.until) {
        last.until = time.until;
      }
    }
  }

  /**
   * Tool to remove parts of timespans or complete timespans.
   */
  private cutTimespans(removables: unknown[]) {
    for (const removable of removables as OpenTimeInternal[]) {
      if (!removable) {
        continue;
      }
      const times = this.internalTimes.default[removable.from.getDay()];
      const tmp = times.splice(0);
      for (const time of tmp) {
        // no remove operation needed
        if (time.from > removable.until || time.until < removable.from) {
          times.push(time);
        }

        // cut in two time objects
        else if (time.from < removable.from && time.until > removable.until) {
          times.push(
            {
              from: time.from,
              until: removable.from,
            },
            {
              from: removable.until,
              until: time.until,
            }
          );
        }

        // cut start time (from)
        else if (
          time.from >= removable.from &&
          time.from <= removable.until &&
          time.until > removable.until
        ) {
          times.push({
            from: removable.until,
            until: time.until,
          });
        }

        // cut end time (until)
        else if (
          time.until <= removable.until &&
          time.until >= removable.from &&
          time.from < removable.from
        ) {
          times.push({
            from: time.from,
            until: removable.from,
          });
        }
      }
    }
  }
}

export default function createOpeningHours(options?: OpeningHoursOptions) {
  return new OpeningHours(options);
}
