import {
    KysoEventEnum,
    KysoOrganizationsAddMemberEvent,
    KysoOrganizationsDeleteEvent,
    KysoOrganizationsRemoveMemberEvent,
    KysoOrganizationsUpdateEvent,
    KysoSetting,
    KysoSettingsEnum,
    OrganizationMemberJoin,
    User,
} from '@kyso-io/kyso-model'
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

    private getTextForEmail(role: string): string {
        switch (role) {
            case 'organization-admin':
                return 'You can admin the organization.'
            case 'team-admin':
                return `You can admin all public and protected channels of the organization.`
            case 'team-contributor':
                return `You can contribute creating reports across all public and protected channels of the organization.`
            case 'team-reader':
                return 'You can read and comment across all public and protected channels of the organization.'
            default:
                return ''
        }
    }

    @EventPattern(KysoEventEnum.ORGANIZATIONS_ADD_MEMBER)
    async handleOrganizationsAddMember(kysoOrganizationsAddMemberEvent: KysoOrganizationsAddMemberEvent) {
        Logger.log(KysoEventEnum.ORGANIZATIONS_ADD_MEMBER, OrganizationsController.name)
        Logger.debug(kysoOrganizationsAddMemberEvent, OrganizationsController.name)

        const { user, organization, emailsCentralized, role, frontendUrl } = kysoOrganizationsAddMemberEvent
        this.mailerService
            .sendMail({
                to: user.email,
                subject: `You are now member of ${organization.display_name} organization`,
                template: 'organization-you-were-added',
                context: {
                    addedUser: user,
                    organization,
                    text: this.getTextForEmail(role),
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

    @EventPattern(KysoEventEnum.ORGANIZATIONS_REMOVE_MEMBER)
    async handleOrganizationsRemoveMember(kysoOrganizationsRemoveMemberEvent: KysoOrganizationsRemoveMemberEvent) {
        Logger.log(KysoEventEnum.ORGANIZATIONS_REMOVE_MEMBER, OrganizationsController.name)
        Logger.debug(kysoOrganizationsRemoveMemberEvent, OrganizationsController.name)

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

    @EventPattern(KysoEventEnum.ORGANIZATIONS_UPDATE_MEMBER_ROLE)
    async handleTeamsUpdateMemberRoles(kysoOrganizationsAddMemberEvent: KysoOrganizationsAddMemberEvent) {
        Logger.log(KysoEventEnum.ORGANIZATIONS_UPDATE_MEMBER_ROLE, OrganizationsController.name)
        Logger.debug(kysoOrganizationsAddMemberEvent, OrganizationsController.name)

        const { user, organization, emailsCentralized, frontendUrl, role } = kysoOrganizationsAddMemberEvent
        this.mailerService
            .sendMail({
                to: user.email,
                subject: `Your role in ${organization.display_name} organization has changed`,
                template: 'organization-user-role-changed',
                context: {
                    user,
                    organization,
                    frontendUrl,
                    text: this.getTextForEmail(role),
                },
            })
            .then((messageInfo) => {
                Logger.log(`Organization role changed mail ${messageInfo.messageId} sent to ${user.email}`, OrganizationsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurred sending organization role changed mail to ${user.email}`, err, OrganizationsController.name)
            })
        if (emailsCentralized.length > 0) {
            this.mailerService
                .sendMail({
                    to: emailsCentralized,
                    subject: `A member's role has changed in ${organization.display_name} organization`,
                    template: 'organization-member-role-changed',
                    context: {
                        user,
                        organization,
                        frontendUrl,
                        role,
                    },
                })
                .then((messageInfo) => {
                    Logger.log(`Organization role changed mail ${messageInfo.messageId} sent to ${emailsCentralized.join(', ')}`, OrganizationsController.name)
                })
                .catch((err) => {
                    Logger.error(`An error occurred sending organization role changed mail to ${emailsCentralized.join(', ')}`, err, OrganizationsController.name)
                })
        }
    }

    @EventPattern(KysoEventEnum.ORGANIZATIONS_UPDATE_OPTIONS)
    async handleOrganizationUpdateOptions(kysoOrganizationsUpdateEvent: KysoOrganizationsUpdateEvent) {
        // Logger.log(KysoEventEnum.ORGANIZATIONS_UPDATE_OPTIONS, OrganizationsController.name)
        // Logger.debug(kysoOrganizationsUpdateEvent, OrganizationsController.name)
    }

    @EventPattern(KysoEventEnum.ORGANIZATIONS_UPDATE_CENTRALIZED_COMMUNICATIONS)
    async handleOrganizationUpdateCentralizedCommunications(kysoOrganizationsUpdateEvent: KysoOrganizationsUpdateEvent) {
        Logger.log(KysoEventEnum.ORGANIZATIONS_UPDATE_CENTRALIZED_COMMUNICATIONS, OrganizationsController.name)
        Logger.debug(kysoOrganizationsUpdateEvent, OrganizationsController.name)
        const { user, organization } = kysoOrganizationsUpdateEvent
        const organizationMembersJoin: OrganizationMemberJoin[] = (await this.db
            .collection('OrganizationMember')
            .find({
                organization_id: organization.id,
                role_names: { $in: ['organization-admin'] },
            })
            .toArray()) as any[]
        if (organizationMembersJoin.length === 0) {
            return
        }
        if (organization.options.notifications.emails.length === 0) {
            return
        }
        const emailsNotifications: string = organization.options.notifications.emails.join(', ')
        const kysoSetting: KysoSetting = (await this.db.collection('KysoSettings').findOne({ key: KysoSettingsEnum.FRONTEND_URL })) as any
        const adminUsers: User[] = (await this.db
            .collection('User')
            .find({ id: { $in: organizationMembersJoin.map((om: OrganizationMemberJoin) => om.member_id) } })
            .toArray()) as any[]
        for (const adminUser of adminUsers) {
            this.mailerService
                .sendMail({
                    to: adminUser.email,
                    subject: `Centralized notifications were updated for ${organization.display_name} organization`,
                    template: 'organization-centralized-notifications',
                    context: {
                        receiver: adminUser,
                        user,
                        organization,
                        frontendUrl: kysoSetting.value,
                        emailsNotifications,
                    },
                })
                .then((messageInfo) => {
                    Logger.log(`Mail ${messageInfo.messageId} of centralized notifications for the organization ${organization.sluglified_name} sent to ${user.email}`, OrganizationsController.name)
                })
                .catch((err) => {
                    Logger.error(`An error occurred sending centralized notifications organization  mail to ${user.email}`, err, OrganizationsController.name)
                })
        }
    }

    @EventPattern(KysoEventEnum.ORGANIZATIONS_DELETE)
    async handleOrganizationsDelete(kysoOrganizationsDeleteEvent: KysoOrganizationsDeleteEvent) {
        Logger.log(KysoEventEnum.ORGANIZATIONS_DELETE, OrganizationsController.name)
        Logger.debug(kysoOrganizationsDeleteEvent, OrganizationsController.name)
        const { organization, user, user_ids } = kysoOrganizationsDeleteEvent
        const organizationUsers: User[] = (await this.db
            .collection('User')
            .find({
                id: {
                    $in: user_ids,
                },
            })
            .toArray()) as any[]
        for (const organizationUser of organizationUsers) {
            try {
                await this.mailerService.sendMail({
                    to: organizationUser.email,
                    subject: `Organization ${organization.display_name} was removed`,
                    template: 'organization-deleted',
                    context: {
                        user,
                        organization,
                    },
                })
                await new Promise((resolve) => setTimeout(resolve, 200))
            } catch (e) {
                Logger.error(`An error occurred sending organization removed mail to ${organizationUser.id} ${organizationUser.email}`, e, OrganizationsController.name)
            }
        }
    }

    @EventPattern(KysoEventEnum.ORGANIZATION_REQUEST_ACCESS_CREATED)
    async handleRequestAccessCreated(kysoOrganizationRequestAccessCreatedEvent: any) {
        Logger.log(KysoEventEnum.ORGANIZATION_REQUEST_ACCESS_CREATED, OrganizationsController.name)
        Logger.debug(kysoOrganizationRequestAccessCreatedEvent, OrganizationsController.name)
        
        const { organization, organizationAdmins, requesterUser, request, frontendUrl } = kysoOrganizationRequestAccessCreatedEvent;
        
        for (const admin of organizationAdmins) {
            try {
                console.log(admin);
                
                await this.mailerService.sendMail({
                    to: admin.email,
                    subject: `${requesterUser.display_name} requested access for organization ${organization.display_name}`,
                    template: 'organization-request-access-created',
                    context: {
                        admin,
                        organization,
                        requesterUser,
                        frontendUrl,
                        request
                    },
                });

                await new Promise((resolve) => setTimeout(resolve, 200))
            } catch (e) {
                Logger.error(`An error occurred sending created request access to organization ${organization.display_name} to user ${admin.email}`, e, OrganizationsController.name)
            }
        }
    }
}
