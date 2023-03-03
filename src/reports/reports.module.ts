import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { SharedModule } from '../shared/shared.module'
import { ReportsController } from './reports.controller'

@Module({
    imports: [DatabaseModule, SharedModule],
    controllers: [ReportsController],
})
export class ReportsModule {}
