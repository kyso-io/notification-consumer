import { KysoEvent, KysoOrganizationsAddMemberEvent, KysoOrganizationsRemoveMemberEvent } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Controller, Inject, Logger } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { Db } from 'mongodb'
import { Constants } from '../constants'

@Controller()
export class OrganizationsController {
    constructor(
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
        private readonly mailerService: MailerService,
    ) {}

    @EventPattern(KysoEvent.ORGANIZATIONS_ADD_MEMBER)
    async handleOrganizationsAddMember(kysoOrganizationsAddMemberEvent: KysoOrganizationsAddMemberEvent) {
        const { user, organization, emailsCentralized, role, frontendUrl } = kysoOrganizationsAddMemberEvent
        this.mailerService
            .sendMail({
                to: user.email,
                subject: `You are now member of ${organization.display_name} organization`,
                template: 'organization-you-were-added',
                context: {
                    addedUser: user,
                    organization,
                    role,
                    frontendUrl,
                },
            })
            .then((messageInfo) => {
                Logger.log(`Report mail ${messageInfo.messageId} sent to ${user.email}`, OrganizationsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurrend sending report mail to ${user.email}`, err, OrganizationsController.name)
            })

        if (emailsCentralized.length > 0) {
            this.mailerService
                .sendMail({
                    to: emailsCentralized,
                    subject: `New member at ${organization.display_name} organization`,
                    template: 'organization-new-member',
                    context: {
                        addedUser: user,
                        organization,
                        role,
                        frontendUrl,
                    },
                })
                .then((messageInfo) => {
                    Logger.log(`Report mail ${messageInfo.messageId} sent to ${user.email}`, OrganizationsController.name)
                })
                .catch((err) => {
                    Logger.error(`An error occurrend sending report mail to ${user.email}`, err, OrganizationsController.name)
                })
        }
    }

    @EventPattern(KysoEvent.ORGANIZATIONS_REMOVE_MEMBER)
    async handleOrganizationsRemoveMember(kysoOrganizationsRemoveMemberEvent: KysoOrganizationsRemoveMemberEvent) {
        const { user, organization, emailsCentralized, frontendUrl } = kysoOrganizationsRemoveMemberEvent
        this.mailerService
            .sendMail({
                to: user.email,
                subject: `You were removed from ${organization.display_name} organization`,
                template: 'organization-you-were-removed',
                context: {
                    removedUser: user,
                    organization,
                    frontendUrl,
                },
            })
            .then((messageInfo) => {
                Logger.log(`Report mail ${messageInfo.messageId} sent to ${user.email}`, OrganizationsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurrend sending report mail to ${user.email}`, err, OrganizationsController.name)
            })
        if (emailsCentralized.length > 0) {
            this.mailerService
                .sendMail({
                    to: emailsCentralized,
                    subject: `A member was removed from ${organization.display_name} organization`,
                    template: 'organization-removed-member',
                    context: {
                        removedUser: user,
                        organization,
                        frontendUrl,
                    },
                })
                .then((messageInfo) => {
                    Logger.log(`Report mail ${messageInfo.messageId} sent to ${user.email}`, OrganizationsController.name)
                })
                .catch((err) => {
                    Logger.error(`An error occurrend sending report mail to ${user.email}`, err, OrganizationsController.name)
                })
        }
    }
}
