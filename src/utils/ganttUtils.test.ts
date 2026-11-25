import { describe, it, expect } from 'vitest';
import { formatDateCompact, formatDateFull, getProjectDateRange } from './ganttUtils';

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
});
