import { KysoEventEnum, KysoUsersCreateEvent, KysoUsersDeleteEvent, KysoUsersRecoveryPasswordEvent, KysoUsersUpdateEvent, KysoUsersVerificationEmailEvent } from '@kyso-io/kyso-model'
import { Controller, Inject, Logger } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { Db } from 'mongodb'
import { Constants } from '../constants'
import { UtilsService } from 'src/shared/utils.service'

@Controller()
export class UsersController {
    constructor(
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
        private readonly utilsService: UtilsService
    ) {}

    @EventPattern(KysoEventEnum.USERS_CREATE)
    async handleUsersCreated(kysoUsersCreateEvent: KysoUsersCreateEvent) {
        Logger.log(KysoEventEnum.USERS_CREATE, UsersController.name)
        Logger.debug(kysoUsersCreateEvent, UsersController.name)

        const { user } = kysoUsersCreateEvent
        this.utilsService.sendHandlebarsEmail(
                user.email,
                'Welcome to Kyso',
                'user-new',
                {
                    user,
                },
            )
            .catch((err) => {
                Logger.error(`Error sending welcome e-mail to ${user.display_name} ${user.email}`, err, UsersController.name)
            })
    }

    @EventPattern(KysoEventEnum.USERS_UPDATE)
    async handleUsersUpdated(kysoUsersUpdateEvent: KysoUsersUpdateEvent) {}

    @EventPattern(KysoEventEnum.USERS_DELETE)
    async handleUsersDeleted(kysoUsersDeleteEvent: KysoUsersDeleteEvent) {}

    @EventPattern(KysoEventEnum.USERS_VERIFICATION_EMAIL)
    async handleUsersVerificationEmail(kysoUsersVerificationEmailEvent: KysoUsersVerificationEmailEvent) {
        Logger.log(KysoEventEnum.USERS_VERIFICATION_EMAIL, UsersController.name)
        Logger.debug(kysoUsersVerificationEmailEvent, UsersController.name)

        const { user, userVerification, frontendUrl } = kysoUsersVerificationEmailEvent
        this.utilsService.sendHandlebarsEmail(
                user.email,
                'Verify your account',
                'verify-email',
                {
                    user,
                    userVerification: {
                        ...userVerification,
                        email: encodeURIComponent(user.email),
                    },
                    frontendUrl,
                }
            )
            .catch((err) => {
                Logger.error(`Error sending verify account e-mail to ${user.display_name}`, err, UsersController.name)
            })
    }

    @EventPattern(KysoEventEnum.USERS_RECOVERY_PASSWORD)
    async handleUsersRecoveryPassword(kysoUsersRecoveryPasswordEvent: KysoUsersRecoveryPasswordEvent) {
        Logger.log(KysoEventEnum.USERS_RECOVERY_PASSWORD, UsersController.name)
        Logger.debug(kysoUsersRecoveryPasswordEvent, UsersController.name)

        const { user, userForgotPassword, frontendUrl } = kysoUsersRecoveryPasswordEvent
        this.utilsService.sendHandlebarsEmail(
                user.email,
                'Change password',
                'change-password',
                {
                    user,
                    userForgotPassword,
                    frontendUrl,
                },
            )
            .catch((err) => {
                Logger.error(`Error sending recovery password e-mail to ${user.display_name}`, err, UsersController.name)
            })
    }
}
