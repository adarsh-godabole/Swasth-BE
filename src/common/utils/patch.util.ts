/**
 * PATCH semantics for nullable fields.
 *
 *   undefined -> field absent from the request, leave the stored value alone
 *   null      -> caller is explicitly clearing the field
 *   value     -> set it, after running `transform`
 *
 * Prisma treats an `undefined` value in an update payload as "don't touch this
 * column", so the result can be assigned straight into the update input.
 *
 * The distinction matters because class-validator's @IsOptional() skips
 * validation for null as well as undefined - so a null reaches the service
 * whatever the DTO says, and every transform applied to it has to be null-safe.
 */
export function patchField<T, R>(
  value: T | null | undefined,
  transform: (input: T) => R,
): R | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return transform(value);
}
