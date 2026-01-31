import { IsString, IsArray, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class FieldMapping {
  @IsString()
  csvField: string;

  @IsString()
  leadField: string;
}

export class UploadLeadsDto {
  @IsString()
  listId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldMapping)
  fieldMappings: FieldMapping[];

  @IsArray()
  @IsObject({ each: true })
  data: Record<string, string>[];
}
