import { describe, it, expect } from 'vitest';
import { importProjectXml, parseDurationToDays, resolveTaskProgress } from './projectXmlImporter';
import { buildTaskHierarchy } from '../../utils/ganttUtils';
import * as fs from 'fs';
import * as path from 'path';

describe('projectXmlImporter', () => {

  it('should parse duration correctly', () => {
    expect(parseDurationToDays('PT8H0M0S')).toBe(1);
    expect(parseDurationToDays('P2D')).toBe(2);
    expect(parseDurationToDays('PT4H0M0S')).toBe(0.5);
  });

  describe('resolveTaskProgress', () => {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM("");
    const parser = new dom.window.DOMParser();
    const map = new Map<string, string>();
    map.set('1', 'avance');
    map.set('2', 'progreso');
    map.set('3', 'unknown field');

    it('Caso A: PercentComplete > PercentWorkComplete', () => {
      const xml = `<Task><PercentComplete>40</PercentComplete><PercentWorkComplete>70</PercentWorkComplete></Task>`;
      const doc = parser.parseFromString(xml, 'application/xml');
      const res = resolveTaskProgress(doc.documentElement, map);
      expect(res).toEqual({ value: 40, source: 'PercentComplete' });
    });

    it('Caso B: Fallback to PercentWorkComplete', () => {
      const xml = `<Task><PercentWorkComplete>70</PercentWorkComplete></Task>`;
      const doc = parser.parseFromString(xml, 'application/xml');
      const res = resolveTaskProgress(doc.documentElement, map);
      expect(res).toEqual({ value: 70, source: 'PercentWorkComplete' });
    });

    it('Caso C: PhysicalPercentComplete when EarnedValueMethod is 1', () => {
      const xml = `<Task><EarnedValueMethod>1</EarnedValueMethod><PhysicalPercentComplete>55</PhysicalPercentComplete><PercentComplete>40</PercentComplete></Task>`;
      const doc = parser.parseFromString(xml, 'application/xml');
      const res = resolveTaskProgress(doc.documentElement, map);
      expect(res).toEqual({ value: 55, source: 'PhysicalPercentComplete' });
    });

    it('Caso D: Ignore PhysicalPercentComplete if EarnedValueMethod is not 1', () => {
      const xml = `<Task><EarnedValueMethod>0</EarnedValueMethod><PhysicalPercentComplete>55</PhysicalPercentComplete><PercentComplete>40</PercentComplete></Task>`;
      const doc = parser.parseFromString(xml, 'application/xml');
      const res = resolveTaskProgress(doc.documentElement, map);
      expect(res).toEqual({ value: 40, source: 'PercentComplete' });
    });

    it('Caso E: Custom field mapping', () => {
      const xml = `<Task><ExtendedAttribute><FieldID>1</FieldID><Value>65</Value></ExtendedAttribute></Task>`;
      const doc = parser.parseFromString(xml, 'application/xml');
      const res = resolveTaskProgress(doc.documentElement, map);
      expect(res).toEqual({ value: 65, source: 'custom' });
    });

    it('Caso F: Default', () => {
      const xml = `<Task><ExtendedAttribute><FieldID>3</FieldID><Value>100</Value></ExtendedAttribute></Task>`;
      const doc = parser.parseFromString(xml, 'application/xml');
      const res = resolveTaskProgress(doc.documentElement, map);
      expect(res).toEqual({ value: 0, source: 'default' });
    });
  });

  describe('Date Fallbacks', () => {
    it('Start -> EarlyStart fallback', () => {
      const xml = `<Project>
        <Tasks>
          <Task>
            <UID>1</UID>
            <EarlyStart>2026-08-10T00:00:00.000Z</EarlyStart>
            <EarlyFinish>2026-08-12T00:00:00.000Z</EarlyFinish>
            <ActualStart>2026-08-01T00:00:00.000Z</ActualStart>
          </Task>
        </Tasks>
      </Project>`;
      const project = importProjectXml(xml);
      const t = project.tasks[0];
      expect(t.importMetadata?.startSource).toBe('EarlyStart');
      expect(t.importMetadata?.finishSource).toBe('EarlyFinish');
      expect(t.start).toContain('2026-08-10');
      expect(t.actualStart).toContain('2026-08-01'); // Kept optional
    });
  });

  describe('Duration Parsing', () => {
    it('Caso A: parsePT40H0M0S with MinutesPerDay 480', () => {
      const xml = `<Project><MinutesPerDay>480</MinutesPerDay><Tasks><Task><UID>1</UID><Duration>PT40H0M0S</Duration></Task></Tasks></Project>`;
      const project = importProjectXml(xml);
      expect(project.tasks[0].duration).toBe(5);
    });

    it('Caso B: parsePT20H0M0S with MinutesPerDay 480', () => {
      const xml = `<Project><MinutesPerDay>480</MinutesPerDay><Tasks><Task><UID>1</UID><Duration>PT20H0M0S</Duration></Task></Tasks></Project>`;
      const project = importProjectXml(xml);
      expect(project.tasks[0].duration).toBe(2.5);
    });

    it('Caso C: Duration takes precedence over date diff', () => {
      const xml = `<Project><MinutesPerDay>480</MinutesPerDay><Tasks><Task><UID>1</UID><Duration>PT8H0M0S</Duration><Start>2026-01-01T00:00:00</Start><Finish>2026-01-10T00:00:00</Finish></Task></Tasks></Project>`;
      const project = importProjectXml(xml);
      expect(project.tasks[0].duration).toBe(1); // Not 10 days
      expect(project.tasks[0].importMetadata?.durationSource).toBe('Duration');
    });

    it('Caso D: Fallback to dates if Duration missing', () => {
      const xml = `<Project><MinutesPerDay>480</MinutesPerDay><Tasks><Task><UID>1</UID><Start>2026-01-01T00:00:00</Start><Finish>2026-01-10T00:00:00</Finish></Task></Tasks></Project>`;
      const project = importProjectXml(xml);
      expect(project.tasks[0].duration).toBe(10); // Difference in days + 1 = 10
      expect(project.tasks[0].importMetadata?.durationSource).toBe('calculated-from-dates');
    });

    it('Caso E: DurationFormat Estimated', () => {
      const xml = `<Project><MinutesPerDay>480</MinutesPerDay><Tasks><Task><UID>1</UID><Duration>PT8H0M0S</Duration><DurationFormat>39</DurationFormat></Task></Tasks></Project>`;
      const project = importProjectXml(xml);
      expect(project.tasks[0].importMetadata?.durationEstimated).toBe(true);
    });
  });

  it('should parse real ProjectLibre XML without errors', () => {
    const realXmlPath = path.join(__dirname, '../../../documentos/Planificacion Parques Chile v2.pod.xml');
    if (fs.existsSync(realXmlPath)) {
      const xmlContent = fs.readFileSync(realXmlPath, 'utf-8');
      const project = importProjectXml(xmlContent);
      
      expect(project).toBeDefined();
      expect(project.tasks.length).toBeGreaterThan(0);
      
      let validStarts = 0;
      let validEnds = 0;
      let invalidDates = 0;
      let endsAfterStarts = 0;
      
      const allStarts: Date[] = [];
      const allEnds: Date[] = [];

      project.tasks.forEach(task => {
        const dStart = new Date(task.start);
        const dEnd = new Date(task.end);
        
        if (!isNaN(dStart.getTime())) {
          validStarts++;
          allStarts.push(dStart);
        } else {
          invalidDates++;
        }
        
        if (!isNaN(dEnd.getTime())) {
          validEnds++;
          allEnds.push(dEnd);
        } else {
          invalidDates++;
        }
        
        if (dEnd >= dStart) {
          endsAfterStarts++;
        }
        
        // Ensure sources
        expect(task.importMetadata?.progressSource).toBe('PercentComplete');
        expect(task.importMetadata?.startSource).toBe('Start');
        expect(task.importMetadata?.finishSource).toBe('Finish');
        // Progress should be 0 for this file
        expect(task.progress).toBe(0);
      });
      
      expect(validStarts).toBe(project.tasks.length);
      expect(validEnds).toBe(project.tasks.length);
      expect(invalidDates).toBe(0);
      expect(endsAfterStarts).toBeGreaterThan(0);
      expect(project.tasks.length).toBe(109);
    } else {
      console.log('Real XML not found at', realXmlPath);
    }
  });
});
