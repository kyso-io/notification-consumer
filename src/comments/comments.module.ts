import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { CommentsController } from './comments.controller'

@Module({
    imports: [DatabaseModule],
    controllers: [CommentsController],
})
export class CommentsModule {}
