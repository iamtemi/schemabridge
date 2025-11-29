import { z } from 'zod';

export const statusEnum = z.enum(['active', 'inactive', 'suspended']);
export const currencyEnum = z.enum(['USD', 'EUR', 'GBP', 'JPY']);
export const roleEnum = z.enum(['admin', 'analyst', 'ops', 'viewer']);
