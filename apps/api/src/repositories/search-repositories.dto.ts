import { Validate, ValidatorConstraint, type ValidatorConstraintInterface } from 'class-validator';

@ValidatorConstraint({ name: 'repositorySearch', async: false })
class RepositorySearchConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > 200) {
      return false;
    }
    for (const char of trimmed) {
      if (char.charCodeAt(0) <= 31) {
        return false;
      }
    }
    return true;
  }
}

export class SearchRepositoriesDto {
  @Validate(RepositorySearchConstraint)
  q!: string;
}
