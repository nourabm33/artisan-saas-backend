import { ServiceRequest } from '../../domain/entities/ServiceRequest';

export interface ScheduledSlot {
  start: Date;
  end: Date;
}

const SLOT_START_HOUR: Record<string, number> = {
  morning: 9,
  mattina: 9,
  afternoon: 15,
  pomeriggio: 15,
  evening: 18,
  sera: 18,
};

type SchedulingRequest = Pick<ServiceRequest, 'preferredDate' | 'preferredTimeSlot'>;

interface CivilDate {
  year: number;
  month: number;
  day: number;
  weekday: number;
}

/**
 * Picks the first appointment slot for an accepted request: the client's
 * preferred date/time slot when it is still in the future, otherwise the
 * next working day at opening time. Duration follows the quoted labor hours.
 * All wall-clock hours are interpreted in the business time zone, regardless
 * of the server's TZ.
 */
export class AppointmentSchedulingService {
  static readonly OPENING_HOUR = 9;
  static readonly MIN_DURATION_MINUTES = 30;
  static readonly DEFAULT_TIME_ZONE = 'Europe/Rome';

  private readonly parts: Intl.DateTimeFormat;

  constructor(readonly timeZone = AppointmentSchedulingService.DEFAULT_TIME_ZONE) {
    this.parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
  }

  schedule(request: SchedulingRequest, laborHours: number, now = new Date()): ScheduledSlot {
    const start = this.pickStart(request, now);
    const minutes = Math.max(
      AppointmentSchedulingService.MIN_DURATION_MINUTES,
      Math.ceil((laborHours * 60) / 30) * 30
    );
    const end = new Date(start.getTime() + minutes * 60_000);
    return { start, end };
  }

  /** Hour of the day (0-23) of an instant in the business time zone. */
  hourOf(date: Date): number {
    return Number(this.parts.formatToParts(date).find((p) => p.type === 'hour')?.value);
  }

  private pickStart(request: SchedulingRequest, now: Date): Date {
    const hour =
      SLOT_START_HOUR[(request.preferredTimeSlot ?? '').trim().toLowerCase()] ??
      AppointmentSchedulingService.OPENING_HOUR;

    if (request.preferredDate) {
      const preferred = this.atHour(this.civil(new Date(request.preferredDate)), hour);
      if (preferred.getTime() > now.getTime()) {
        return preferred;
      }
    }

    let day = this.civil(now);
    do {
      day = this.civil(new Date(this.atHour(day, 12).getTime() + 24 * 60 * 60_000));
    } while (day.weekday === 0);
    return this.atHour(day, hour);
  }

  private civil(date: Date): CivilDate {
    const get = (type: Intl.DateTimeFormatPartTypes): string =>
      this.parts.formatToParts(date).find((p) => p.type === type)?.value ?? '';
    return {
      year: Number(get('year')),
      month: Number(get('month')),
      day: Number(get('day')),
      weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')),
    };
  }

  /** Instant corresponding to `hour:00` on the given civil day in the business time zone. */
  private atHour({ year, month, day }: CivilDate, hour: number): Date {
    const guess = Date.UTC(year, month - 1, day, hour);
    const offset = this.offsetMs(new Date(guess));
    const candidate = new Date(guess - offset);
    // Re-check around DST transitions where the offset differs at the target instant.
    const secondOffset = this.offsetMs(candidate);
    return secondOffset === offset ? candidate : new Date(guess - secondOffset);
  }

  private offsetMs(date: Date): number {
    const c = this.civil(date);
    const hour = this.hourOf(date);
    const minute = Number(this.parts.formatToParts(date).find((p) => p.type === 'minute')?.value);
    const second = Number(this.parts.formatToParts(date).find((p) => p.type === 'second')?.value);
    const asUtc = Date.UTC(c.year, c.month - 1, c.day, hour, minute, second);
    return asUtc - Math.floor(date.getTime() / 1000) * 1000;
  }
}
