# Backend Development Rules (NestJS)

## Module Structure
```
module-name/
  module-name.module.ts    # Module definition
  module-name.service.ts   # Business logic
  module-name.controller.ts # API endpoints
  entity-name.entity.ts    # TypeORM entity
  dto/
    create-*.dto.ts
    update-*.dto.ts
```

## Entity Conventions
- Use `@PrimaryGeneratedColumn('uuid')` for IDs
- Use `@CreateDateColumn()` and `@UpdateDateColumn()`
- Relations: `@ManyToOne`, `@OneToMany` with proper cascade options
- JSON columns: `@Column({ type: 'simple-json' })`

## Service Patterns
```typescript
@Injectable()
export class SomeService {
  constructor(
    @InjectRepository(Entity)
    private readonly repo: Repository<Entity>,
  ) {}

  async findAll(options: PaginationOptions) {
    const [data, total] = await this.repo.findAndCount({
      skip: (options.page - 1) * options.limit,
      take: options.limit,
      order: { createdAt: 'DESC' },
    });
    return { data, total, page: options.page, limit: options.limit };
  }
}
```

## Controller Patterns
```typescript
@Controller('resource')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SomeController {
  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async create(@Body() dto: CreateDto) { }

  @Get()
  async findAll(@Query() query: PaginationDto) { }

  @Get(':id')
  async findOne(@Param('id') id: string) { }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async update(@Param('id') id: string, @Body() dto: UpdateDto) { }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string) { }
}
```

## DTO Validation
```typescript
import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSomeDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
```

## Error Handling
- Use `NotFoundException` for missing resources
- Use `BadRequestException` for validation errors
- Use `ForbiddenException` for permission errors
