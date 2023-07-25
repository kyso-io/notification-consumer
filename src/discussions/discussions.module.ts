import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { DiscussionsController } from './discussions.controller'
import { SharedModule } from 'src/shared/shared.module'

@Module({
    imports: [DatabaseModule, SharedModule],
    controllers: [DiscussionsController],
})
export class DiscussionsModule {}
