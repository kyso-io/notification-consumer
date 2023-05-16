import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { SharedModule } from '../shared/shared.module'
import { InlineCommentsController } from './inline-comments.controller'

@Module({
    imports: [DatabaseModule, SharedModule],
    controllers: [InlineCommentsController],
})
export class InlineCommentsModule {}
