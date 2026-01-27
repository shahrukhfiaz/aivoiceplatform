import { Module } from '@nestjs/common';
import { CostsService } from './costs.service';

@Module({
  providers: [CostsService],
  exports: [CostsService],
})
export class CostsModule {}
