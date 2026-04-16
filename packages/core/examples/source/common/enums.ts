import { z } from 'zod';

export const statusEnum = z.enum(['active', 'inactive', 'suspended']);
export const currencyEnum = z.enum(['USD', 'EUR', 'GBP', 'JPY']);
export const roleEnum = z.enum(['admin', 'analyst', 'ops', 'viewer']);

export const ipv4 = z.ipv4();
const datetimeSchema = z.iso.datetime();
export const diffDateTypes = z.union([
  z.date(),
  z.iso.date(),
  z.iso.datetime(),
  z.string().datetime(),
]);

const defaultBase = z.object({
  id: z.uuid(),
  datetime: datetimeSchema,
  diffDateTypes: diffDateTypes,
});
