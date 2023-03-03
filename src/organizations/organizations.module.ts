import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { SharedModule } from '../shared/shared.module'
import { OrganizationsController } from './organizations.controller'

@Module({
    imports: [DatabaseModule, SharedModule],
    controllers: [OrganizationsController],
})
export class OrganizationsModule {}
