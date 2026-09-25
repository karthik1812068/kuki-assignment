import { IsString, Matches } from 'class-validator';

export class ImportRepositoryDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)
  fullName!: string;
}
