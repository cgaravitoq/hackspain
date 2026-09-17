import { z } from "zod";

export const environmentSchema = z.enum([
  "development",
  "staging",
  "production",
]);

export type Environment = z.infer<typeof environmentSchema>;

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  environment: environmentSchema,
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
