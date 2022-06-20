import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { FeedbackController } from './feedback.controller'

@Module({
    controllers: [FeedbackController],
    imports: [DatabaseModule],
})
export class FeedbackModule {}
