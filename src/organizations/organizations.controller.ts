import {
    KysoEventEnum,
    KysoOrganizationRequestAccessCreatedEvent,
    KysoOrganizationsAddMemberEvent,
    KysoOrganizationsDeleteEvent,
    KysoOrganizationsRemoveMemberEvent,
    KysoOrganizationsUpdateEvent,
    KysoSetting,
    KysoSettingsEnum,
    Organization,
    OrganizationMemberJoin,
    User,
} from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Controller, Inject, Logger } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { Db } from 'mongodb'
import { SentMessageInfo } from 'nodemailer'
import { Constants } from '../constants'
import { UtilsService } from '../shared/utils.service'

@Controller()
export class OrganizationsController {
    constructor(
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
        private readonly mailerService: MailerService,
        private readonly utilsService: UtilsService,
    ) {}

    private async sendMailMemberAddedToOrganization(kysoOrganizationsAddMemberEvent: KysoOrganizationsAddMemberEvent): Promise<void> {
        try {
            const messageInfo: SentMessageInfo = await this.mailerService.sendMail({
                to: kysoOrganizationsAddMemberEvent.userReceivingAction.email,
                subject: `You are now member of ${kysoOrganizationsAddMemberEvent.organization.display_name} organization`,
                template: 'organization-you-were-added',
                context: {
                    userCreatingAction: kysoOrganizationsAddMemberEvent.userCreatingAction,
                    addedUser: kysoOrganizationsAddMemberEvent.userReceivingAction,
                    organization: kysoOrganizationsAddMemberEvent.organization,
                    frontendUrl: kysoOrganizationsAddMemberEvent.frontendUrl,
                },
            })
            Logger.log(`User member in organization mail ${messageInfo.messageId} sent to ${kysoOrganizationsAddMemberEvent.userReceivingAction.email}`, OrganizationsController.name)
        } catch (e) {
            Logger.error(`An error occurrend sending user member in organization mail to ${kysoOrganizationsAddMemberEvent.userReceivingAction.email}`, e, OrganizationsController.name)
        }
    }

    private async sendMailNewMemberInOrganization(kysoOrganizationsAddMemberEvent: KysoOrganizationsAddMemberEvent, user: User): Promise<void> {
        try {
            const messageInfo: SentMessageInfo = await this.mailerService.sendMail({
                to: user.email,
                subject: `New member at ${kysoOrganizationsAddMemberEvent.organization.display_name} organization`,
                template: 'organization-new-member',
                context: {
                    admin: user,
                    addedUser: kysoOrganizationsAddMemberEvent.userReceivingAction,
                    organization: kysoOrganizationsAddMemberEvent.organization,
                    role: UtilsService.getDisplayTextByOrganizationRoleName(kysoOrganizationsAddMemberEvent.newRole),
                    frontendUrl: kysoOrganizationsAddMemberEvent.frontendUrl,
                },
            })
            Logger.log(`New member in organization mail ${messageInfo.messageId} sent to ${kysoOrganizationsAddMemberEvent.userReceivingAction.email}`, OrganizationsController.name)
        } catch (e) {
            Logger.error(`An error occurrend sending new member in organization mail to ${kysoOrganizationsAddMemberEvent.userReceivingAction.email}`, e, OrganizationsController.name)
        }
    }

    @EventPattern(KysoEventEnum.ORGANIZATIONS_ADD_MEMBER)
    async handleOrganizationsAddMember(kysoOrganizationsAddMemberEvent: KysoOrganizationsAddMemberEvent) {
        Logger.log(KysoEventEnum.ORGANIZATIONS_ADD_MEMBER, OrganizationsController.name)
        Logger.debug(kysoOrganizationsAddMemberEvent, OrganizationsController.name)
        const { userReceivingAction, organization } = kysoOrganizationsAddMemberEvent
        await this.sendMailMemberAddedToOrganization(kysoOrganizationsAddMemberEvent)
        let centralizedEmails: string[] = []
        if (organization?.options?.notifications?.centralized && Array.isArray(organization?.options?.notifications?.emails)) {
            centralizedEmails = organization.options.notifications.emails
        }
        if (centralizedEmails.length > 0) {
            for (const email of centralizedEmails) {
                const u: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ email })
                if (!u) {
                    continue
                }
                await this.sendMailNewMemberInOrganization(kysoOrganizationsAddMemberEvent, u)
                await this.utilsService.sleep(200)
            }
        } else {
            const users: User[] = await this.getOrganizationMembers(organization)
            for (const u of users) {
                if (u.id === userReceivingAction.id) {
                    continue
                }
                const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(u.id, 'new_member_organization', organization.id)
                if (sendNotification) {
                    await this.sendMailNewMemberInOrganization(kysoOrganizationsAddMemberEvent, u)
                    await this.utilsService.sleep(200)
                }
            }
        }
    }

    private async sendMailMemberRemovedFromOrganization(kysoOrganizationsRemoveMemberEvent: KysoOrganizationsRemoveMemberEvent): Promise<void> {
        try {
            const messageInfo: SentMessageInfo = await this.mailerService.sendMail({
                to: kysoOrganizationsRemoveMemberEvent.user.email,
                subject: `You were removed from ${kysoOrganizationsRemoveMemberEvent.organization.display_name} organization`,
                template: 'organization-you-were-removed',
                context: {
                    userCreatingAction: kysoOrganizationsRemoveMemberEvent.userCreatingAction,
                    removedUser: kysoOrganizationsRemoveMemberEvent.user,
                    organization: kysoOrganizationsRemoveMemberEvent.organization,
                    frontendUrl: kysoOrganizationsRemoveMemberEvent.frontendUrl,
                },
            })
            Logger.log(`Removed user from organization mail ${messageInfo.messageId} sent to ${kysoOrganizationsRemoveMemberEvent.user.email}`, OrganizationsController.name)
        } catch (e) {
            Logger.error(`An error occurrend sending removed user from organization mail to ${kysoOrganizationsRemoveMemberEvent.user.email}`, e, OrganizationsController.name)
        }
    }

    @EventPattern(KysoEventEnum.ORGANIZATIONS_REMOVE_MEMBER)
    async handleOrganizationsRemoveMember(kysoOrganizationsRemoveMemberEvent: KysoOrganizationsRemoveMemberEvent) {
        Logger.log(KysoEventEnum.ORGANIZATIONS_REMOVE_MEMBER, OrganizationsController.name)
        Logger.debug(kysoOrganizationsRemoveMemberEvent, OrganizationsController.name)
        const { userCreatingAction, user, organization, frontendUrl } = kysoOrganizationsRemoveMemberEvent
        await this.sendMailMemberRemovedFromOrganization(kysoOrganizationsRemoveMemberEvent)
        let centralizedEmails: string[] = []
        if (organization?.options?.notifications?.centralized && Array.isArray(organization?.options?.notifications?.emails)) {
            centralizedEmails = organization.options.notifications.emails
        }
        if (centralizedEmails.length > 0) {
            for (const email of centralizedEmails) {
                const u: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ email })
                if (!u) {
                    continue
                }
                this.mailerService
                    .sendMail({
                        to: u.email,
                        subject: `A member was removed from ${organization.display_name} organization`,
                        template: 'organization-removed-member',
                        context: {
                            admin: u,
                            userCreatingAction,
                            removedUser: user,
                            organization,
                            frontendUrl,
                        },
                    })
                    .then((messageInfo) => {
                        Logger.log(`User removed from organization mail ${messageInfo.messageId} sent to ${user.email}`, OrganizationsController.name)
                    })
                    .catch((err) => {
                        Logger.error(`An error occurrend sending user removed from organization mail to ${user.email}`, err, OrganizationsController.name)
                    })
            }
        } else {
            const users: User[] = await this.getOrganizationMembers(organization)
            for (const u of users) {
                const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(u.id, 'removed_member_in_organization', organization.id)
                if (!sendNotification) {
                    continue
                }
                try {
                    const sentMessageInfo: SentMessageInfo = await this.mailerService.sendMail({
                        to: u.email,
                        subject: `A member was removed from ${organization.display_name} organization`,
                        template: 'organization-removed-member',
                        context: {
                            admin: u,
                            userCreatingAction,
                            removedUser: user,
                            organization,
                            frontendUrl,
                        },
                    })
                    Logger.log(`User removed from organization mail ${sentMessageInfo.messageId} sent to ${u.email}`, OrganizationsController.name)
                    await this.utilsService.sleep(200)
                } catch (e) {
                    Logger.error(`An error occurrend sending user removed from organization mail to ${u.email}`, e, OrganizationsController.name)
                }
            }
        }
    }

    @EventPattern(KysoEventEnum.ORGANIZATIONS_UPDATE_MEMBER_ROLE)
    async handleTeamsUpdateMemberRoles(kysoOrganizationsAddMemberEvent: KysoOrganizationsAddMemberEvent) {
        Logger.log(KysoEventEnum.ORGANIZATIONS_UPDATE_MEMBER_ROLE, OrganizationsController.name)
        Logger.debug(kysoOrganizationsAddMemberEvent, OrganizationsController.name)
        const { userCreatingAction, userReceivingAction, organization, frontendUrl, newRole, previousRole } = kysoOrganizationsAddMemberEvent
        const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(userReceivingAction.id, 'updated_role_in_organization', organization.id)
        if (sendNotification) {
            this.mailerService
                .sendMail({
                    to: userReceivingAction.email,
                    subject: `Your role in ${organization.display_name} organization has changed`,
                    template: 'organization-user-role-changed',
                    context: {
                        userCreatingAction,
                        user: userReceivingAction,
                        organization,
                        frontendUrl,
                        previousRole: UtilsService.getDisplayTextByOrganizationRoleName(previousRole),
                        newRole: UtilsService.getDisplayTextByOrganizationRoleName(newRole),
                    },
                })
                .then((messageInfo) => {
                    Logger.log(`Organization role changed mail ${messageInfo.messageId} sent to ${userReceivingAction.email}`, OrganizationsController.name)
                })
                .catch((err) => {
                    Logger.error(`An error occurred sending organization role changed mail to ${userReceivingAction.email}`, err, OrganizationsController.name)
                })
        }
        let centralizedEmails: string[] = []
        if (organization?.options?.notifications?.centralized && Array.isArray(organization?.options?.notifications?.emails)) {
            centralizedEmails = organization.options.notifications.emails
        }
        if (centralizedEmails.length > 0) {
            for (const email of centralizedEmails) {
                const u: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ email })
                if (!u) {
                    continue
                }
                this.mailerService
                    .sendMail({
                        to: u.email,
                        subject: `A member's role has changed in ${organization.display_name} organization`,
                        template: 'organization-member-role-changed',
                        context: {
                            admin: u,
                            user: userReceivingAction,
                            organization,
                            frontendUrl,
                            previousRole: UtilsService.getDisplayTextByOrganizationRoleName(previousRole),
                            newRole: UtilsService.getDisplayTextByOrganizationRoleName(newRole),
                        },
                    })
                    .then((messageInfo) => {
                        Logger.log(`Organization role changed mail ${messageInfo.messageId} sent to ${u.email}`, OrganizationsController.name)
                    })
                    .catch((err) => {
                        Logger.error(`An error occurred sending organization role changed mail to ${u.email}`, err, OrganizationsController.name)
                    })
            }
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
            .collection(Constants.DATABASE_COLLECTION_ORGANIZATION_MEMBER)
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
        const kysoSetting: KysoSetting = (await this.db.collection(Constants.DATABASE_COLLECTION_KYSO_SETTINGS).findOne({ key: KysoSettingsEnum.FRONTEND_URL })) as any
        const adminUsers: User[] = (await this.db
            .collection(Constants.DATABASE_COLLECTION_USER)
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
        const organizationUsers: User[] = await this.db
            .collection<User>('User')
            .find({
                id: {
                    $in: user_ids,
                },
            })
            .toArray()
        const kysoSetting: KysoSetting = (await this.db.collection(Constants.DATABASE_COLLECTION_KYSO_SETTINGS).findOne({ key: KysoSettingsEnum.FRONTEND_URL })) as any
        for (const organizationUser of organizationUsers) {
            const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(organizationUser.id, 'organization_removed', organization.id)
            if (!sendNotification) {
                continue
            }
            try {
                await this.mailerService.sendMail({
                    to: organizationUser.email,
                    subject: `Organization ${organization.display_name} was removed`,
                    template: 'organization-deleted',
                    context: {
                        frontendUrl: kysoSetting.value,
                        user: organizationUser,
                        userCreatingAction: user,
                        organization,
                    },
                })
                await this.utilsService.sleep(200)
            } catch (e) {
                Logger.error(`An error occurred sending organization removed mail to ${organizationUser.id} ${organizationUser.email}`, e, OrganizationsController.name)
            }
        }
    }

    @EventPattern(KysoEventEnum.ORGANIZATION_REQUEST_ACCESS_CREATED)
    async handleRequestAccessCreated(kysoOrganizationRequestAccessCreatedEvent: KysoOrganizationRequestAccessCreatedEvent) {
        Logger.log(KysoEventEnum.ORGANIZATION_REQUEST_ACCESS_CREATED, OrganizationsController.name)
        Logger.debug(kysoOrganizationRequestAccessCreatedEvent, OrganizationsController.name)
        const { organization, organizationAdmins, requesterUser, request, frontendUrl } = kysoOrganizationRequestAccessCreatedEvent
        for (const admin of organizationAdmins) {
            if (admin) {
                try {
                    await this.mailerService.sendMail({
                        to: admin.email,
                        subject: `${requesterUser.display_name} requested access for organization ${organization.display_name}`,
                        template: 'organization-request-access-created',
                        context: {
                            admin,
                            organization,
                            requesterUser,
                            frontendUrl,
                            request,
                        },
                    })
                    await this.utilsService.sleep(200)
                } catch (e) {
                    Logger.error(`An error occurred sending created request access to organization ${organization.display_name} to user ${admin.email}`, e, OrganizationsController.name)
                }
            }
        }
    }

    @EventPattern(KysoEventEnum.ORGANIZATION_REQUEST_ACCESS_REJECTED)
    async handleRequestAccessRejected(kysoOrganizationRequestAccessRejectedEvent: any) {
        Logger.log(KysoEventEnum.ORGANIZATION_REQUEST_ACCESS_REJECTED, OrganizationsController.name)
        Logger.debug(kysoOrganizationRequestAccessRejectedEvent, OrganizationsController.name)

        const { organization, rejecterUser, requesterUser, frontendUrl } = kysoOrganizationRequestAccessRejectedEvent

        if (requesterUser && requesterUser.email && requesterUser.display_name) {
            try {
                await this.mailerService.sendMail({
                    to: requesterUser.email,
                    subject: `Your access request to organization ${organization.display_name} has been rejected`,
                    template: 'organization-request-access-rejected',
                    context: {
                        rejecterUser,
                        organization,
                        requesterUser,
                        frontendUrl,
                    },
                })

                await this.utilsService.sleep(200)
            } catch (e) {
                Logger.error(`An error occurred sending rejected request access to organization ${organization.display_name} to user ${rejecterUser.email}`, e, OrganizationsController.name)
            }
        }
    }

    private async getOrganizationMembers(organization: Organization): Promise<User[]> {
        const organizationMembers: OrganizationMemberJoin[] = await this.db
            .collection<OrganizationMemberJoin>(Constants.DATABASE_COLLECTION_ORGANIZATION_MEMBER)
            .find({ organization_id: organization.id })
            .toArray()
        if (organizationMembers.length === 0) {
            return []
        }
        return this.db
            .collection<User>(Constants.DATABASE_COLLECTION_USER)
            .find({
                id: { $in: organizationMembers.map((x: OrganizationMemberJoin) => x.member_id) },
            })
            .toArray()
    }
}
