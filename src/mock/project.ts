import { GanttProject } from '../domain/models';

export const mockProject: GanttProject = {
  id: 'proj-1',
  name: 'Planificación Parques Chile v2',
  resources: [
    { id: 'res-1', name: 'Juan Pérez' },
    { id: 'res-2', name: 'Ana Silva' }
  ],
  tasks: [
    {
      id: 't-1',
      name: 'Operaciones Comerciales',
      start: '2026-08-10T00:00:00.000Z',
      end: '2026-09-10T00:00:00.000Z',
      duration: 30,
      progress: 40,
      milestone: false,
      dependencies: [],
      resourceIds: [],
      isExpanded: true
    },
    {
      id: 't-1-1',
      parentId: 't-1',
      name: 'Precontrato / Historial',
      start: '2026-08-10T00:00:00.000Z',
      end: '2026-08-15T00:00:00.000Z',
      duration: 5,
      progress: 100,
      milestone: false,
      dependencies: [],
      resourceIds: ['res-1']
    },
    {
      id: 't-2',
      name: 'Desarrollo Backend',
      start: '2026-08-16T00:00:00.000Z',
      end: '2026-09-05T00:00:00.000Z',
      duration: 20,
      progress: 25,
      milestone: false,
      dependencies: [{ taskId: 't-1-1', type: 'FS' }],
      resourceIds: ['res-2'],
      isExpanded: true
    },
    {
      id: 't-2-1',
      parentId: 't-2',
      name: 'Base de Datos',
      start: '2026-08-16T00:00:00.000Z',
      end: '2026-08-20T00:00:00.000Z',
      duration: 4,
      progress: 80,
      milestone: false,
      dependencies: [],
      resourceIds: []
    },
    {
      id: 't-2-2',
      parentId: 't-2',
      name: 'Integraciones',
      start: '2026-08-21T00:00:00.000Z',
      end: '2026-09-05T00:00:00.000Z',
      duration: 15,
      progress: 10,
      milestone: false,
      dependencies: [{ taskId: 't-2-1', type: 'FS' }],
      resourceIds: []
    },
    {
      id: 't-3',
      name: 'Desarrollo Frontend',
      start: '2026-08-25T00:00:00.000Z',
      end: '2026-09-15T00:00:00.000Z',
      duration: 21,
      progress: 0,
      milestone: false,
      dependencies: [{ taskId: 't-2-1', type: 'FS' }],
      resourceIds: [],
      isExpanded: true
    },
    {
      id: 't-4',
      name: 'Infra DevOps',
      start: '2026-08-10T00:00:00.000Z',
      end: '2026-08-30T00:00:00.000Z',
      duration: 20,
      progress: 50,
      milestone: false,
      dependencies: [],
      resourceIds: []
    },
    {
      id: 't-5',
      name: 'Operaciones Parque',
      start: '2026-09-10T00:00:00.000Z',
      end: '2026-09-20T00:00:00.000Z',
      duration: 10,
      progress: 0,
      milestone: false,
      dependencies: [{ taskId: 't-1', type: 'FS' }],
      resourceIds: [],
      isExpanded: true
    },
    {
      id: 't-5-1',
      parentId: 't-5',
      name: 'Operaciones Caja',
      start: '2026-09-10T00:00:00.000Z',
      end: '2026-09-15T00:00:00.000Z',
      duration: 5,
      progress: 0,
      milestone: false,
      dependencies: [],
      resourceIds: []
    },
    {
      id: 't-6',
      name: 'Testing',
      start: '2026-09-16T00:00:00.000Z',
      end: '2026-09-25T00:00:00.000Z',
      duration: 9,
      progress: 0,
      milestone: false,
      dependencies: [{ taskId: 't-2', type: 'FS' }, { taskId: 't-3', type: 'FS' }],
      resourceIds: []
    },
    {
      id: 't-7',
      name: 'Implementación a Testing',
      start: '2026-09-15T00:00:00.000Z',
      end: '2026-09-15T00:00:00.000Z',
      duration: 0,
      progress: 0,
      milestone: true,
      dependencies: [{ taskId: 't-2', type: 'FS' }, { taskId: 't-3', type: 'FS' }],
      resourceIds: []
    },
    {
      id: 't-8',
      name: 'UAT Cliente',
      start: '2026-09-26T00:00:00.000Z',
      end: '2026-10-05T00:00:00.000Z',
      duration: 9,
      progress: 0,
      milestone: false,
      dependencies: [{ taskId: 't-6', type: 'FS' }],
      resourceIds: []
    },
    {
      id: 't-9',
      name: 'Implementación a Producción',
      start: '2026-10-06T00:00:00.000Z',
      end: '2026-10-06T00:00:00.000Z',
      duration: 0,
      progress: 0,
      milestone: true,
      dependencies: [{ taskId: 't-8', type: 'FS' }],
      resourceIds: []
    },
    {
      id: 't-10',
      name: 'Soporte Post Productivo',
      start: '2026-10-07T00:00:00.000Z',
      end: '2026-10-21T00:00:00.000Z',
      duration: 14,
      progress: 0,
      milestone: false,
      dependencies: [{ taskId: 't-9', type: 'FS' }],
      resourceIds: []
    }
  ]
};
