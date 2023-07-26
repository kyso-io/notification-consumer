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
            await this.utilsService.sendHandlebarsEmail(
                
                kysoOrganizationsAddMemberEvent.userReceivingAction.email,
                `You are now member of ${kysoOrganizationsAddMemberEvent.organization.display_name} organization`,
                'organization-you-were-added',
                {
                    userCreatingAction: kysoOrganizationsAddMemberEvent.userCreatingAction,
                    addedUser: kysoOrganizationsAddMemberEvent.userReceivingAction,
                    organization: kysoOrganizationsAddMemberEvent.organization,
                    frontendUrl: kysoOrganizationsAddMemberEvent.frontendUrl,
                },
            )
        } catch (e) {
            Logger.error(`An error occurrend sending user member in organization mail to ${kysoOrganizationsAddMemberEvent.userReceivingAction.email}`, e, OrganizationsController.name)
        }
    }

    private async sendMailNewMemberInOrganization(kysoOrganizationsAddMemberEvent: KysoOrganizationsAddMemberEvent, user: User): Promise<void> {
        try {
            await this.utilsService.sendHandlebarsEmail(
                
                user.email,
                `New member at ${kysoOrganizationsAddMemberEvent.organization.display_name} organization`,
                'organization-new-member',
                {
                    admin: user,
                    addedUser: kysoOrganizationsAddMemberEvent.userReceivingAction,
                    organization: kysoOrganizationsAddMemberEvent.organization,
                    role: UtilsService.getDisplayTextByOrganizationRoleName(kysoOrganizationsAddMemberEvent.newRole),
                    frontendUrl: kysoOrganizationsAddMemberEvent.frontendUrl,
                },
            )
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
                await this.utilsService.sleep(2000)
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
                    await this.utilsService.sleep(2000)
                }
            }
        }
    }

    private async sendMailMemberRemovedFromOrganization(kysoOrganizationsRemoveMemberEvent: KysoOrganizationsRemoveMemberEvent): Promise<void> {
        try {
            await this.utilsService.sendHandlebarsEmail(
                
                kysoOrganizationsRemoveMemberEvent.user.email,
                `You were removed from ${kysoOrganizationsRemoveMemberEvent.organization.display_name} organization`,
                'organization-you-were-removed',
                {
                    userCreatingAction: kysoOrganizationsRemoveMemberEvent.userCreatingAction,
                    removedUser: kysoOrganizationsRemoveMemberEvent.user,
                    organization: kysoOrganizationsRemoveMemberEvent.organization,
                    frontendUrl: kysoOrganizationsRemoveMemberEvent.frontendUrl,
                },
            )
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
                await this.utilsService.sendHandlebarsEmail(
                        
                        u.email,
                        `A member was removed from ${organization.display_name} organization`,
                        'organization-removed-member',
                        {
                            admin: u,
                            userCreatingAction,
                            removedUser: user,
                            organization,
                            frontendUrl,
                        },
                    )
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
                    await this.utilsService.sendHandlebarsEmail(
                        
                        u.email,
                        `A member was removed from ${organization.display_name} organization`,
                        'organization-removed-member',
                        {
                            admin: u,
                            userCreatingAction,
                            removedUser: user,
                            organization,
                            frontendUrl,
                        },
                    )
                    await this.utilsService.sleep(2000)
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
            await this.utilsService.sendHandlebarsEmail(
                    
                    userReceivingAction.email,
                    `Your role in ${organization.display_name} organization has changed`,
                    'organization-user-role-changed',
                    {
                        userCreatingAction,
                        user: userReceivingAction,
                        organization,
                        frontendUrl,
                        previousRole: UtilsService.getDisplayTextByOrganizationRoleName(previousRole),
                        newRole: UtilsService.getDisplayTextByOrganizationRoleName(newRole),
                    },
                )
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
                await this.utilsService.sendHandlebarsEmail(
                        
                        u.email,
                        `A member's role has changed in ${organization.display_name} organization`,
                        'organization-member-role-changed',
                        {
                            admin: u,
                            user: userReceivingAction,
                            organization,
                            frontendUrl,
                            previousRole: UtilsService.getDisplayTextByOrganizationRoleName(previousRole),
                            newRole: UtilsService.getDisplayTextByOrganizationRoleName(newRole),
                        },
                    )
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
            await this.utilsService.sendHandlebarsEmail(
                    
                    adminUser.email,
                    `Centralized notifications were updated for ${organization.display_name} organization`,
                    'organization-centralized-notifications',
                    {
                        receiver: adminUser,
                        user,
                        organization,
                        frontendUrl: kysoSetting.value,
                        emailsNotifications,
                    },
                )
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
                await this.utilsService.sendHandlebarsEmail(
                    
                    organizationUser.email,
                    `Organization ${organization.display_name} was removed`,
                    'organization-deleted',
                    {
                        frontendUrl: kysoSetting.value,
                        user: organizationUser,
                        userCreatingAction: user,
                        organization,
                    },
                )
                await this.utilsService.sleep(2000)
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
                    await this.utilsService.sendHandlebarsEmail(
                        
                        admin.email,
                        `${requesterUser.display_name} requested access for organization ${organization.display_name}`,
                        'organization-request-access-created',
                        {
                            admin,
                            organization,
                            requesterUser,
                            frontendUrl,
                            request,
                        },
                    )
                    await this.utilsService.sleep(2000)
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
                await this.utilsService.sendHandlebarsEmail(
                    
                    requesterUser.email,
                    `Your access request to organization ${organization.display_name} has been rejected`,
                    'organization-request-access-rejected',
                    {
                        rejecterUser,
                        organization,
                        requesterUser,
                        frontendUrl,
                    },
                )
                await this.utilsService.sleep(2000)
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
