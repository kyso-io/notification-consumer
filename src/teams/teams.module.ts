import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { TeamsController } from './teams.controller'

@Module({
    imports: [DatabaseModule],
    controllers: [TeamsController],
})
export class TeamsModule {}
