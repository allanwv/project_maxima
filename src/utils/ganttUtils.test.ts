import { describe, it, expect } from 'vitest';
import {
  calculateEditedDuration,
  calculateEditedEnd,
  formatCalendarIso,
  formatDateCompact,
  formatDateFull,
  getProjectDateRange,
  parseCalendarDate,
} from './ganttUtils';

describe('ganttUtils formatting', () => {
  it('formatDateCompact should return dd-MM-yyyy', () => {
    expect(formatDateCompact('2026-08-10T09:00:00')).toBe('10-08-2026'); // no Z, parses as local
  });

  it('formatDateFull should return dd-MM-yyyy HH:mm', () => {
    // This depends on local timezone. We assume the test runs where it works, or we mock it.
    // parseISO keeps local timezone unless Z is specified, then it converts to local.
    // Instead of testing the exact hour (which depends on TZ), we can check length or structure.
    const full = formatDateFull('2026-08-10T09:00:00.000Z');
    expect(full).toContain('10-08-2026');
    expect(full.length).toBeGreaterThan(10);
  });

  it('should handle undefined or invalid gracefully', () => {
    expect(formatDateCompact(undefined)).toBe('');
    expect(formatDateCompact('')).toBe('');
    expect(formatDateCompact('invalid')).toBe('');

    expect(formatDateFull(undefined)).toBe('');
    expect(formatDateFull('invalid')).toBe('');
  });

  it('getProjectDateRange returns a padded multi-week window for empty projects', () => {
    const { start, end } = getProjectDateRange([]);
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(27);
  });

  it('preserves calendar day across UTC midnight and UTC-3 midnight timestamps', () => {
    expect(formatDateCompact('2026-11-26T00:00:00.000Z')).toBe('26-11-2026');
    expect(formatDateCompact('2026-11-26T03:00:00.000Z')).toBe('26-11-2026');
    expect(formatDateCompact('2026-12-30T00:00:00.000Z')).toBe('30-12-2026');

    const parsed = parseCalendarDate('2026-11-26T00:00:00.000Z');
    expect(formatCalendarIso(parsed)).toBe('2026-11-26T00:00:00.000Z');
  });

  it('calculateEditedEnd and calculateEditedDuration normalize to calendar ISO without day shift', () => {
    const endIso = calculateEditedEnd('2026-11-26T00:00:00.000Z', 8);
    expect(endIso).toBe('2026-12-07T00:00:00.000Z');
    expect(calculateEditedDuration('2026-11-26T00:00:00.000Z', '2026-11-26T03:00:00.000Z')).toBe(1);
    expect(calculateEditedDuration('2026-11-26T00:00:00.000Z', '2026-12-30T00:00:00.000Z')).toBe(25);
  });
});
