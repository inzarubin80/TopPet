import { RegistrationField } from '../types/models';
import {
  registrationAnswersToDisplayRows,
  registrationAnswersToDisplaySections,
} from './registrationAnswersDisplay';

describe('registrationAnswersToDisplayRows', () => {
  const fields: RegistrationField[] = [
    {
      id: 'b1',
      contest_id: 'c',
      sort_order: 2,
      label: 'Согласие',
      field_type: 'boolean',
      required: true,
      created_at: '',
    },
    {
      id: 's1',
      contest_id: 'c',
      sort_order: 0,
      label: 'Город',
      field_type: 'string',
      required: false,
      created_at: '',
    },
    {
      id: 'n1',
      contest_id: 'c',
      sort_order: 1,
      label: 'Возраст',
      field_type: 'number',
      required: false,
      created_at: '',
    },
    {
      id: 't1',
      contest_id: 'c',
      sort_order: 3,
      label: 'О себе',
      field_type: 'textarea',
      required: false,
      created_at: '',
    },
    {
      id: 'i1',
      contest_id: 'c',
      sort_order: 4,
      label: 'Фото питомца',
      field_type: 'image',
      required: false,
      created_at: '',
    },
  ];

  it('sorts by sort_order and formats types', () => {
    const rows = registrationAnswersToDisplayRows(fields, {
      s1: 'Москва',
      n1: 3,
      b1: false,
      t1: 'Строка 1\nСтрока 2',
      i1: 'https://example.com/a.png',
    });
    expect(rows.map((r) => r.label)).toEqual([
      'Город',
      'Возраст',
      'Согласие',
      'О себе',
      'Фото питомца',
    ]);
    expect(rows.map((r) => r.value)).toEqual([
      'Москва',
      '3',
      'Нет',
      'Строка 1\nСтрока 2',
      'https://example.com/a.png',
    ]);
    expect(rows.map((r) => r.fieldType)).toEqual([
      'string',
      'number',
      'boolean',
      'textarea',
      'image',
    ]);
  });

  it('skips empty string answers', () => {
    const rows = registrationAnswersToDisplayRows(fields, { s1: '   ', n1: 1 });
    expect(rows.map((r) => r.id)).toEqual(['n1']);
  });
});

describe('registrationAnswersToDisplaySections', () => {
  const fields: RegistrationField[] = [
    {
      id: 'f1',
      contest_id: 'c',
      sort_order: 0,
      label: 'Имя',
      field_type: 'string',
      required: false,
      created_at: '',
    },
  ];

  it('adds orphan keys not in schema', () => {
    const deadKey = 'deadbeef-dead-dead-dead-deadbeef0001';
    const { schemaRows, orphanRows } = registrationAnswersToDisplaySections(fields, {
      f1: 'Вася',
      [deadKey]: 'старое значение',
    });
    expect(schemaRows).toHaveLength(1);
    expect(schemaRows[0].label).toBe('Имя');
    expect(orphanRows).toHaveLength(1);
    expect(orphanRows[0].isOrphan).toBe(true);
    expect(orphanRows[0].labelTitle).toBe(deadKey);
    expect(orphanRows[0].label).toContain('deadbeef');
    expect(orphanRows[0].value).toBe('старое значение');
  });

  it('formats orphan booleans and JSON', () => {
    const { orphanRows } = registrationAnswersToDisplaySections([], {
      x: true,
      y: { a: 1 },
    });
    expect(orphanRows.find((r) => r.labelTitle === 'x')?.value).toBe('Да');
    expect(orphanRows.find((r) => r.labelTitle === 'y')?.fieldType).toBe('textarea');
    expect(orphanRows.find((r) => r.labelTitle === 'y')?.value).toBe('{"a":1}');
  });

  it('infers image type for orphan URL with extension', () => {
    const { orphanRows } = registrationAnswersToDisplaySections([], {
      img: 'https://cdn.example.com/x.webp',
    });
    expect(orphanRows[0].fieldType).toBe('image');
  });

  it('lists all answers as orphans when no fields', () => {
    const { schemaRows, orphanRows } = registrationAnswersToDisplaySections([], {
      only: 'data',
    });
    expect(schemaRows).toHaveLength(0);
    expect(orphanRows).toHaveLength(1);
    expect(orphanRows[0].value).toBe('data');
  });
});
