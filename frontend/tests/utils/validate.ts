import Ajv, { type ErrorObject } from "ajv";
import { schemas, type SchemaName } from "../schemas/crm-api.schemas";

const ajv = new Ajv({ allErrors: true, strict: false });

const validators = Object.fromEntries(
  Object.entries(schemas).map(([name, schema]) => [name, ajv.compile(schema)]),
) as Record<SchemaName, ReturnType<typeof ajv.compile>>;

export type ValidationResult = {
  valid: boolean;
  errors: ErrorObject[];
};

export function validateResponse(name: SchemaName, payload: unknown): ValidationResult {
  const fn = validators[name];
  const valid = fn(payload);
  return { valid: !!valid, errors: (fn.errors ?? []) as ErrorObject[] };
}

export function formatErrors(errors: ErrorObject[]): string {
  if (errors.length === 0) return "";
  return errors
    .map((e) => `  ${e.instancePath || "/"}: ${e.message} (${JSON.stringify(e.params)})`)
    .join("\n");
}
