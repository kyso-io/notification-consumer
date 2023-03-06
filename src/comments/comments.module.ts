import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { SharedModule } from '../shared/shared.module'
import { CommentsController } from './comments.controller'

@Module({
    imports: [DatabaseModule, SharedModule],
    controllers: [CommentsController],
})
export class CommentsModule {}
