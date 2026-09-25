import { IsIn } from 'class-validator';

export class DecideTaskDto {
  @IsIn(['approve', 'reject', 'cancel'])
  decision!: 'approve' | 'reject' | 'cancel';
}
