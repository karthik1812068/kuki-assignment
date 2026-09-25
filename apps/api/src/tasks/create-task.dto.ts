import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateTaskDto {
  @IsUUID()
  repositoryId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4_000)
  description!: string;

  @IsOptional()
  @IsIn(['implement', 'review', 'security', 'docs', 'issue'])
  mode?: 'implement' | 'review' | 'security' | 'docs' | 'issue';
}
