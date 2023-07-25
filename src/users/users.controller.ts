import { KysoEventEnum, KysoUsersCreateEvent, KysoUsersDeleteEvent, KysoUsersRecoveryPasswordEvent, KysoUsersUpdateEvent, KysoUsersVerificationEmailEvent } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Controller, Inject, Logger } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { Db } from 'mongodb'
import { Constants } from '../constants'
import { UtilsService } from 'src/shared/utils.service'

@Controller()
export class UsersController {
    constructor(
        private readonly mailerService: MailerService,
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
        private readonly utilsService: UtilsService
    ) {}

    @EventPattern(KysoEventEnum.USERS_CREATE)
    async handleUsersCreated(kysoUsersCreateEvent: KysoUsersCreateEvent) {
        Logger.log(KysoEventEnum.USERS_CREATE, UsersController.name)
        Logger.debug(kysoUsersCreateEvent, UsersController.name)

        const { user } = kysoUsersCreateEvent
        this.mailerService
            .sendMail({
                from: await this.utilsService.getMailFrom(),
                to: user.email,
                subject: 'Welcome to Kyso',
                template: 'user-new',
                context: {
                    user,
                },
            })
            .then(() => {
                Logger.log(`Welcome e-mail sent to ${user.display_name} ${user.email}`, UsersController.name)
            })
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
        this.mailerService
            .sendMail({
                from: await this.utilsService.getMailFrom(),
                to: user.email,
                subject: 'Verify your account',
                template: 'verify-email',
                context: {
                    user,
                    userVerification: {
                        ...userVerification,
                        email: encodeURIComponent(user.email),
                    },
                    frontendUrl,
                },
            })
            .then(() => {
                Logger.log(`Verify account e-mail sent to ${user.display_name}`, UsersController.name)
            })
            .catch((err) => {
                Logger.error(`Error sending verify account e-mail to ${user.display_name}`, err, UsersController.name)
            })
    }

    @EventPattern(KysoEventEnum.USERS_RECOVERY_PASSWORD)
    async handleUsersRecoveryPassword(kysoUsersRecoveryPasswordEvent: KysoUsersRecoveryPasswordEvent) {
        Logger.log(KysoEventEnum.USERS_RECOVERY_PASSWORD, UsersController.name)
        Logger.debug(kysoUsersRecoveryPasswordEvent, UsersController.name)

        const { user, userForgotPassword, frontendUrl } = kysoUsersRecoveryPasswordEvent
        this.mailerService
            .sendMail({
                from: await this.utilsService.getMailFrom(),
                to: user.email,
                subject: 'Change password',
                template: 'change-password',
                context: {
                    user,
                    userForgotPassword,
                    frontendUrl,
                },
            })
            .then(() => {
                Logger.log(`Recovery password e-mail sent to ${user.display_name}`, UsersController.name)
            })
            .catch((err) => {
                Logger.error(`Error sending recovery password e-mail to ${user.display_name}`, err, UsersController.name)
            })
    }
}
