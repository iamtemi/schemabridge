import { z } from 'zod';

export const userSchema = z.object({
  name: z.string(),
  age: z.number().int(),
});

export const notASchema = {
  foo: 'bar',
};
