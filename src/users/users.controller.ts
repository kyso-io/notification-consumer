import { KysoEvent, KysoUsersCreateEvent, KysoUsersDeleteEvent, KysoUsersUpdateEvent } from '@kyso-io/kyso-model'
import { Controller, Inject } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { Db } from 'mongodb'
import { Constants } from '../constants'

@Controller()
export class UsersController {
    constructor(
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
    ) {}

    @EventPattern(KysoEvent.USERS_CREATE)
    async handleUsersCreated(kysoUsersCreateEvent: KysoUsersCreateEvent) {}

    @EventPattern(KysoEvent.USERS_UPDATE)
    async handleUsersUpdated(kysoUsersUpdateEvent: KysoUsersUpdateEvent) {}

    @EventPattern(KysoEvent.USERS_DELETE)
    async handleUsersDeleted(kysoUsersDeleteEvent: KysoUsersDeleteEvent) {}
}
