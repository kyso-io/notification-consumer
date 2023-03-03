import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { UtilsService } from './utils.service'

@Module({
    exports: [UtilsService],
    imports: [DatabaseModule],
    providers: [UtilsService],
})
export class SharedModule {}
