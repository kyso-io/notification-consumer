import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { OrganizationsController } from './organizations.controller'

@Module({
    imports: [DatabaseModule],
    controllers: [OrganizationsController],
})
export class OrganizationsModule {}
