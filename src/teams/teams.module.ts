import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { SharedModule } from '../shared/shared.module'
import { TeamsController } from './teams.controller'

@Module({
    imports: [DatabaseModule, SharedModule],
    controllers: [TeamsController],
})
export class TeamsModule {}
