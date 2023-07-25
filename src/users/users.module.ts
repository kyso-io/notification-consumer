import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { UsersController } from './users.controller'
import { SharedModule } from 'src/shared/shared.module'

@Module({
    imports: [DatabaseModule, SharedModule],
    controllers: [UsersController],
})
export class UsersModule {}
