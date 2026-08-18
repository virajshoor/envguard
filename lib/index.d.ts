export interface EnvMap {
  [key: string]: string;
}

export interface SchemaRule {
  key: string;
  type: string;
  required: boolean;
  description: string;
  pattern: RegExp | null;
  defaultValue: string | undefined;
  allowEmpty: boolean;
  deprecated: boolean;
  deprecatedReason: string;
}

export interface RequireIfCondition {
  type: 'require-if' | 'forbidden-if';
  sourceKey: string;
  expectedValue: string;
  targetKey: string;
  reason: string;
}

export interface RequireIfMissingCondition {
  type: 'require-if-missing';
  sourceKey: string;
  targetKey: string;
  reason: string;
}

export type ConditionalRule = RequireIfCondition | RequireIfMissingCondition;

export interface Schema {
  [key: string]: SchemaRule | ConditionalRule[] | undefined;
  __conditions?: ConditionalRule[];
}

export interface ValidateOptions {
  strict?: boolean;
}

export interface ValidationResult {
  key: string;
  type: string;
  required: boolean;
  value: string | undefined;
  pass: boolean;
  reason: string;
  severity?: 'warning';
}

export function parseEnvContent(content: string): EnvMap;
export function parseEnvFile(filePath: string): EnvMap;
export function parseSchemaContent(content: string): Schema;
export function parseSchemaFile(filePath: string): Schema;

export function validate(
  env: EnvMap,
  schema: Schema,
  options?: ValidateOptions
): ValidationResult[];
export function validateKey(env: EnvMap, rule: SchemaRule): ValidationResult;
export function checkType(value: string, type: string): string | null;
export function isEmpty(value: unknown): boolean;
export function isNumber(value: string): boolean;
export function isInteger(value: string): boolean;
export function isBoolean(value: string): boolean;
export function isUrl(value: string): boolean;
export function isEmail(value: string): boolean;
export function isPort(value: string): boolean;
export function isJson(value: string): boolean;

export function formatResults(results: ValidationResult[]): string;
export function formatSummary(results: ValidationResult[]): string;

export function presetNames(): string[];
export function schemaFromPreset(name: string): string | null;

export function secretWarnings(env: EnvMap): ValidationResult[];
