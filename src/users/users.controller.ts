import { KysoEvent, KysoUsersCreateEvent, KysoUsersDeleteEvent, KysoUsersRecoveryPasswordEvent, KysoUsersUpdateEvent, KysoUsersVerificationEmailEvent } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Controller, Inject, Logger } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { Db } from 'mongodb'
import { Constants } from '../constants'

@Controller()
export class UsersController {
    constructor(
        private readonly mailerService: MailerService,
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
    ) {}

    @EventPattern(KysoEvent.USERS_CREATE)
    async handleUsersCreated(kysoUsersCreateEvent: KysoUsersCreateEvent) {
        const { user } = kysoUsersCreateEvent
        this.mailerService
            .sendMail({
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

    @EventPattern(KysoEvent.USERS_UPDATE)
    async handleUsersUpdated(kysoUsersUpdateEvent: KysoUsersUpdateEvent) {}

    @EventPattern(KysoEvent.USERS_DELETE)
    async handleUsersDeleted(kysoUsersDeleteEvent: KysoUsersDeleteEvent) {}

    @EventPattern(KysoEvent.USERS_VERIFICATION_EMAIL)
    async handleUsersVerificationEmail(kysoUsersVerificationEmailEvent: KysoUsersVerificationEmailEvent) {
        const { user, userVerification, frontendUrl } = kysoUsersVerificationEmailEvent
        this.mailerService
            .sendMail({
                to: user.email,
                subject: 'Verify your account',
                template: 'verify-email',
                context: {
                    user,
                    userVerification,
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

    @EventPattern(KysoEvent.USERS_RECOVERY_PASSWORD)
    async handleUsersRecoveryPassword(kysoUsersRecoveryPasswordEvent: KysoUsersRecoveryPasswordEvent) {
        const { user, userForgotPassword, frontendUrl } = kysoUsersRecoveryPasswordEvent
        this.mailerService
            .sendMail({
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
