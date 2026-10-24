import { IsString, MaxLength, MinLength } from 'class-validator';

export class AskDocumentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(400)
  question!: string;
}
