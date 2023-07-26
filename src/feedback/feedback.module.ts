import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { FeedbackController } from './feedback.controller'
import { SharedModule } from 'src/shared/shared.module'

@Module({
    controllers: [FeedbackController],
    imports: [DatabaseModule, SharedModule],
})
export class FeedbackModule {}
