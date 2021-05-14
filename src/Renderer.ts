import { OpeningHours, OpeningHoursOptions } from "./OpeningHours";

export abstract class Renderer<T, U = OpeningHoursOptions> {
    readonly options!: OpeningHoursOptions;
    constructor(readonly openingHours: OpeningHours, options: OpeningHoursOptions = {}) {
        this.options = { ...this.openingHours.options, ...options };
    }

    abstract render(options?: U): T;
}