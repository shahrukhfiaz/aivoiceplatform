import { PartialType } from '@nestjs/mapped-types';
import { CreateCallerIdPoolDto } from './create-pool.dto';

export class UpdateCallerIdPoolDto extends PartialType(CreateCallerIdPoolDto) {}
