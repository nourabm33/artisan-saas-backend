import { Appointment } from '@/domain/entities/Appointment';
import { ValidationError } from '@/domain/errors/ValidationError';
import { AppointmentSchedulingService } from '@/application/services/AppointmentSchedulingService';

const base = {
  requestId: 'req-1',
  orgId: 'org-1',
  assignedTo: 'user-1',
  scheduledStart: new Date('2030-01-10T09:00:00Z'),
  scheduledEnd: new Date('2030-01-10T10:00:00Z'),
};

describe('Appointment entity', () => {
  it('rejects an end before the start', () => {
    expect(
      () => new Appointment({ ...base, scheduledEnd: new Date('2030-01-10T08:00:00Z') })
    ).toThrow(ValidationError);
  });

  it('starts pending and follows the status machine', () => {
    const a = Appointment.create(base);
    expect(a.status).toBe('pending');
    expect(a.isOpen).toBe(true);

    const confirmed = a.withStatus('confirmed');
    const done = confirmed.withStatus('in_progress').withStatus('completed');
    expect(done.status).toBe('completed');
    expect(done.isOpen).toBe(false);
    expect(() => done.withStatus('cancelled')).toThrow(ValidationError);
    expect(() => a.withStatus('completed')).toThrow(ValidationError);
  });

  it('reschedules open appointments only', () => {
    const a = Appointment.create(base);
    const moved = a.reschedule(
      new Date('2030-01-11T09:00:00Z'),
      new Date('2030-01-11T09:30:00Z'),
      'user-2'
    );
    expect(moved.scheduledStart.toISOString()).toBe('2030-01-11T09:00:00.000Z');
    expect(moved.assignedTo).toBe('user-2');

    const cancelled = a.withStatus('cancelled');
    expect(() =>
      cancelled.reschedule(new Date('2030-01-11T09:00:00Z'), new Date('2030-01-11T10:00:00Z'))
    ).toThrow(ValidationError);
  });
});

describe('AppointmentSchedulingService', () => {
  const service = new AppointmentSchedulingService('Europe/Rome');
  const rome = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome',
    weekday: 'short',
    day: 'numeric',
  });
  const dayOf = (d: Date) => Number(rome.formatToParts(d).find((p) => p.type === 'day')?.value);
  const weekdayOf = (d: Date) => rome.formatToParts(d).find((p) => p.type === 'weekday')?.value;
  // Wednesday 2030-01-09, noon UTC
  const now = new Date('2030-01-09T12:00:00Z');

  it('uses the preferred future date and time slot in Rome time', () => {
    const slot = service.schedule(
      { preferredDate: new Date('2030-01-15'), preferredTimeSlot: 'pomeriggio' },
      1.5,
      now
    );
    expect(dayOf(slot.start)).toBe(15);
    expect(service.hourOf(slot.start)).toBe(15);
    // CET (UTC+1) in January
    expect(slot.start.toISOString()).toBe('2030-01-15T14:00:00.000Z');
    expect(slot.end.getTime() - slot.start.getTime()).toBe(90 * 60_000);
  });

  it('handles summer time (CEST, UTC+2)', () => {
    const slot = service.schedule(
      { preferredDate: new Date('2030-07-10'), preferredTimeSlot: 'morning' },
      1,
      now
    );
    expect(slot.start.toISOString()).toBe('2030-07-10T07:00:00.000Z');
    expect(service.hourOf(slot.start)).toBe(9);
  });

  it('falls back to the next working day when the preferred date has passed', () => {
    const slot = service.schedule(
      { preferredDate: new Date('2030-01-01'), preferredTimeSlot: 'morning' },
      1,
      now
    );
    expect(dayOf(slot.start)).toBe(10);
    expect(service.hourOf(slot.start)).toBe(9);
  });

  it('skips Sundays and enforces the minimum duration', () => {
    // Saturday 2030-01-12 -> next non-Sunday is Monday 14th
    const saturday = new Date('2030-01-12T12:00:00Z');
    const slot = service.schedule({}, 0.1, saturday);
    expect(weekdayOf(slot.start)).toBe('Mon');
    expect(dayOf(slot.start)).toBe(14);
    expect(slot.end.getTime() - slot.start.getTime()).toBe(30 * 60_000);
  });
});
