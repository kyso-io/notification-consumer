import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { InvitationsController } from './invitations.controller'
import { SharedModule } from 'src/shared/shared.module'

@Module({
    imports: [DatabaseModule, SharedModule],
    controllers: [InvitationsController],
})
export class InvitationsModule {}
