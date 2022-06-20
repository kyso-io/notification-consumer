import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { InvitationsController } from './invitations.controller'

@Module({
    imports: [DatabaseModule],
    controllers: [InvitationsController],
})
export class InvitationsModule {}
