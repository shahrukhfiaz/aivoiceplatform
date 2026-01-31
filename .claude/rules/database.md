# Database Rules (TypeORM + SQLite)

## Entity Definition
```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity()
export class EntityName {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', default: 'active' })
  status: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, unknown>;

  @ManyToOne(() => RelatedEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'relatedId' })
  related?: RelatedEntity;

  @Column({ nullable: true })
  relatedId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

## Relationships

### One-to-Many (Parent side)
```typescript
@OneToMany(() => Child, (child) => child.parent)
children?: Child[];
```

### Many-to-One (Child side)
```typescript
@ManyToOne(() => Parent, (parent) => parent.children, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'parentId' })
parent: Parent;

@Column()
parentId: string;
```

## Column Types for SQLite
- String: `@Column()` or `@Column({ type: 'text' })`
- Number: `@Column({ type: 'integer' })` or `@Column({ type: 'decimal' })`
- Boolean: `@Column({ type: 'boolean', default: false })`
- JSON: `@Column({ type: 'simple-json' })`
- Date: `@Column({ type: 'datetime' })`

## Indexes
```typescript
@Index()
@Column()
searchableField: string;
```

## Enums (use string literals for SQLite)
```typescript
export type Status = 'active' | 'paused' | 'completed' | 'archived';

@Column({ type: 'text', default: 'active' })
status: Status;
```

## Query Patterns
```typescript
// Find with relations
const items = await this.repo.find({
  relations: ['related', 'children'],
  where: { status: 'active' },
  order: { createdAt: 'DESC' },
});

// Pagination
const [data, total] = await this.repo.findAndCount({
  skip: (page - 1) * limit,
  take: limit,
});

// Update
await this.repo.update(id, { field: 'value' });

// Delete
await this.repo.delete(id);
```
