import {
    KysoEventEnum,
    KysoSetting,
    KysoSettingsEnum,
    KysoTeamRequestAccessCreatedEvent,
    KysoTeamsAddMemberEvent,
    KysoTeamsCreateEvent,
    KysoTeamsDeleteEvent,
    KysoTeamsRemoveMemberEvent,
    KysoTeamsUpdateMemberRolesEvent,
    OrganizationMemberJoin,
    Team,
    TeamMemberJoin,
    TeamVisibilityEnum,
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
export class TeamsController {
    constructor(
        private mailerService: MailerService,
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
        private readonly utilsService: UtilsService,
    ) {}

    @EventPattern(KysoEventEnum.TEAMS_CREATE)
    async handleTeamsCreate(kysoTeamsCreateEvent: KysoTeamsCreateEvent) {
        Logger.log(KysoEventEnum.TEAMS_CREATE, TeamsController.name)
        Logger.debug(kysoTeamsCreateEvent, TeamsController.name)
        if (kysoTeamsCreateEvent.team.visibility === TeamVisibilityEnum.PRIVATE) {
            return
        }
        const organizationMembersJoin: OrganizationMemberJoin[] = await this.db
            .collection<OrganizationMemberJoin>(Constants.DATABASE_COLLECTION_ORGANIZATION_MEMBER)
            .find({
                organization_id: kysoTeamsCreateEvent.organization.id,
            })
            .toArray()
        for (const organizationMemberJoin of organizationMembersJoin) {
            const user: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ id: organizationMemberJoin.member_id })
            if (!user) {
                continue
            }
            const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(user.id, 'new_channel', kysoTeamsCreateEvent.organization.id, kysoTeamsCreateEvent.team.id)
            if (sendNotification) {
                try {
                    await this.utilsService.sendHandlebarsEmail(
                        
                        user.email,
                        `New ${kysoTeamsCreateEvent.team.display_name} channel`,
                        'new-team',
                        {
                            notifiedUser: user,
                            user: kysoTeamsCreateEvent.user,
                            organization: kysoTeamsCreateEvent.organization,
                            team: kysoTeamsCreateEvent.team,
                            frontendUrl: kysoTeamsCreateEvent.frontendUrl,
                        },
                    )
                    await this.utilsService.sleep(2000)
                } catch (e) {
                    Logger.error(`An error occurrend sending new team mail to ${user.email}`, e, TeamsController.name)
                }
            }
        }
    }

    @EventPattern(KysoEventEnum.TEAMS_ADD_MEMBER)
    async handleCommentsCreated(kysoTeamsAddMemberEvent: KysoTeamsAddMemberEvent) {
        Logger.log(KysoEventEnum.TEAMS_ADD_MEMBER, TeamsController.name)
        Logger.debug(kysoTeamsAddMemberEvent, TeamsController.name)
        const { userCreatingAction, userReceivingAction, organization, team, roles, frontendUrl } = kysoTeamsAddMemberEvent
        const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(userReceivingAction.id, 'new_member_channel', organization.id, team.id)
        if (sendNotification) {
            try {
                await this.utilsService.sendHandlebarsEmail(
                    
                    userReceivingAction.email,
                    `You were added to ${team.display_name} channel`,
                    'team-you-were-added',
                    {
                        userCreatingAction,
                        addedUser: userReceivingAction,
                        organization,
                        team,
                        frontendUrl,
                    },
                )
                
                await this.utilsService.sleep(2000)
            } catch (e) {
                Logger.error(`An error occurrend sending report mail to ${userReceivingAction.email}`, e, TeamsController.name)
            }
        }
        let centralizedEmails: string[] = []
        if (organization?.options?.notifications?.centralized && Array.isArray(organization?.options?.notifications?.emails)) {
            centralizedEmails = organization.options.notifications.emails
        }
        if (centralizedEmails.length > 0) {
            for (const email of centralizedEmails) {
                const user: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ email })
                if (!user) {
                    continue
                }
                try {
                    await this.utilsService.sendHandlebarsEmail(
                        
                        user.email,
                        `A member was added to ${team.display_name} channel`,
                        'team-new-member',
                        {
                            user,
                            addedUser: userReceivingAction,
                            organization,
                            team,
                            role: roles.map((r) => UtilsService.getDisplayTextByChannelRoleName(r)).join(', '),
                            frontendUrl,
                        },
                    )
                    
                    await this.utilsService.sleep(2000)
                } catch (e) {
                    Logger.error(`An error occurrend sending new user in channel mail to ${user.email}`, e, TeamsController.name)
                }
            }
        } else {
            const users: User[] = await this.getTeamMembers(team)
            for (const u of users) {
                if (u.id === userReceivingAction.id) {
                    continue
                }
                const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(u.id, 'new_member_channel', organization.id, team.id)
                if (!sendNotification) {
                    continue
                }
                try {
                    await this.utilsService.sendHandlebarsEmail(
                        
                        u.email,
                        `A member was added to ${team.display_name} channel`,
                        'team-new-member',
                        {
                            user: u,
                            addedUser: userReceivingAction,
                            organization,
                            team,
                            role: roles.map((r) => UtilsService.getDisplayTextByChannelRoleName(r)).join(', '),
                            frontendUrl,
                        },
                    )
                    
                    await this.utilsService.sleep(2000)
                } catch (e) {
                    Logger.error(`An error occurrend sending new user in channel mail to ${u.email}`, e, TeamsController.name)
                }
            }
        }
    }

    @EventPattern(KysoEventEnum.TEAMS_REMOVE_MEMBER)
    async handleCommentsUpdated(kysoTeamsRemoveMemberEvent: KysoTeamsRemoveMemberEvent) {
        Logger.log(KysoEventEnum.TEAMS_REMOVE_MEMBER, TeamsController.name)
        Logger.debug(kysoTeamsRemoveMemberEvent, TeamsController.name)
        const { userCreatingAction, user, organization, team, frontendUrl } = kysoTeamsRemoveMemberEvent
        await this.utilsService.sendHandlebarsEmail(
                
                user.email,
                `You were removed from ${team.display_name} channel`,
                'team-you-were-removed',
                {
                    userCreatingAction,
                    removedUser: user,
                    organization,
                    team,
                    frontendUrl,
                },
            )
            .catch((err) => {
                Logger.error(`An error occurrend sending report mail to ${user.email}`, err, TeamsController.name)
            })
        let centralizedEmails: string[] = []
        if (organization?.options?.notifications?.centralized && Array.isArray(organization?.options?.notifications?.emails)) {
            centralizedEmails = organization.options.notifications.emails
        }
        if (centralizedEmails.length > 0) {
            for (const email of centralizedEmails) {
                const userEmail: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ email })
                if (!userEmail) {
                    continue
                }
                try {
                    await this.utilsService.sendHandlebarsEmail(
                        
                        userEmail.email,
                        `A member was removed from ${team.display_name} channel`,
                        'team-removed-member',
                        {
                            user: userEmail,
                            userCreatingAction,
                            removedUser: user,
                            organization,
                            team,
                            frontendUrl,
                        },
                    )
                    
                    await this.utilsService.sleep(2000)
                } catch (e) {
                    Logger.error(`An error occurrend sending removed user form team mail to ${userEmail.email}`, e, TeamsController.name)
                }
            }
        } else {
            const users: User[] = await this.getTeamMembers(team)
            for (const u of users) {
                if (u.id === user.id) {
                    continue
                }
                const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(u.id, 'removed_member_in_channel', organization.id, team.id)
                if (!sendNotification) {
                    continue
                }
                try {
                    await this.utilsService.sendHandlebarsEmail(
                        
                        u.email,
                        `A member was removed from ${team.display_name} channel`,
                        'team-removed-member',
                        {
                            user: u,
                            userCreatingAction,
                            removedUser: user,
                            organization,
                            team,
                            frontendUrl,
                        },
                    )
                    
                    await this.utilsService.sleep(2000)
                } catch (e) {
                    Logger.error(`An error occurrend sending removed user form team mail to ${u.email}`, e, TeamsController.name)
                }
            }
        }
    }

    @EventPattern(KysoEventEnum.TEAMS_UPDATE_MEMBER_ROLES)
    async handleTeamsUpdateMemberRoles(kysoTeamsUpdateMemberRolesEvent: KysoTeamsUpdateMemberRolesEvent) {
        Logger.log(KysoEventEnum.TEAMS_UPDATE_MEMBER_ROLES, TeamsController.name)
        Logger.debug(kysoTeamsUpdateMemberRolesEvent, TeamsController.name)
        const { userCreatingAction, userReceivingAction, organization, team, frontendUrl, previousRoles, currentRoles } = kysoTeamsUpdateMemberRolesEvent
        const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(userReceivingAction.id, 'updated_role_in_channel', organization.id, team.id)
        if (sendNotification) {
            await this.utilsService.sendHandlebarsEmail(
                    
                    userReceivingAction.email,
                    `Your role in ${team.display_name} channel has changed`,
                    'team-user-role-changed',
                    {
                        userCreatingAction,
                        userReceivingAction,
                        organization,
                        team,
                        frontendUrl,
                        previousRole: previousRoles.length > 0 ? UtilsService.getDisplayTextByChannelRoleName(previousRoles[0]) : '',
                        newRole: UtilsService.getDisplayTextByChannelRoleName(currentRoles[0]),
                    },
                )
                
                .catch((err) => {
                    Logger.error(`An error occurred sending team role changed mail to ${userReceivingAction.email}`, err, TeamsController.name)
                })
        }
        let centralizedEmails: string[] = []
        if (organization?.options?.notifications?.centralized && Array.isArray(organization?.options?.notifications?.emails)) {
            centralizedEmails = organization.options.notifications.emails
        }
        if (centralizedEmails.length > 0) {
            for (const email of centralizedEmails) {
                const user: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ email })
                if (!user) {
                    continue
                }
                try {
                    await this.utilsService.sendHandlebarsEmail(
                        
                        user.email,
                        `A member's role has changed in ${team.display_name} channel`,
                        'team-member-role-changed',
                        {
                            user,
                            userCreatingAction,
                            userReceivingAction,
                            organization,
                            team,
                            frontendUrl,
                            previousRole: previousRoles.length > 0 ? UtilsService.getDisplayTextByChannelRoleName(previousRoles[0]) : '',
                            newRole: UtilsService.getDisplayTextByChannelRoleName(currentRoles[0]),
                        },
                    )
                    
                    await this.utilsService.sleep(2000)
                } catch (e) {
                    Logger.error(`An error occurred sending team role changed mail to ${user.email}`, e, TeamsController.name)
                }
            }
        }
    }

    @EventPattern(KysoEventEnum.TEAMS_DELETE)
    async handleOrganizationsDelete(kysoTeamsDeleteEvent: KysoTeamsDeleteEvent) {
        Logger.log(KysoEventEnum.TEAMS_DELETE, TeamsController.name)
        Logger.debug(kysoTeamsDeleteEvent, TeamsController.name)
        const { organization, team, user, user_ids } = kysoTeamsDeleteEvent
        const teamUsers: User[] = await this.db
            .collection<User>(Constants.DATABASE_COLLECTION_USER)
            .find({
                id: {
                    $in: user_ids,
                },
            })
            .toArray()
        const kysoSetting: KysoSetting = (await this.db.collection(Constants.DATABASE_COLLECTION_KYSO_SETTINGS).findOne({ key: KysoSettingsEnum.FRONTEND_URL })) as any
        for (const teamUser of teamUsers) {
            const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(teamUser.id, 'channel_removed', organization.id, team.id)
            if (!sendNotification) {
                continue
            }
            try {
                await this.utilsService.sendHandlebarsEmail(
                    
                    teamUser.email,
                    `Channel ${team.display_name} was removed`,
                    'team-deleted',
                    {
                        user: teamUser,
                        userCreatingAction: user,
                        organization,
                        team,
                        frontendUrl: kysoSetting.value,
                    },
                )
                
                await this.utilsService.sleep(2000)
            } catch (e) {
                Logger.error(`An error occurred sending team removed mail to ${teamUser.id} ${teamUser.email}`, e, TeamsController.name)
            }
        }
    }

    @EventPattern(KysoEventEnum.TEAMS_REQUEST_ACCESS_CREATED)
    async handleRequestAccessCreated(kysoTeamRequestAccessCreatedEvent: KysoTeamRequestAccessCreatedEvent) {
        Logger.log(KysoEventEnum.TEAMS_REQUEST_ACCESS_CREATED, TeamsController.name)
        Logger.debug(kysoTeamRequestAccessCreatedEvent, TeamsController.name)

        const { organization, team, organizationAdmins, requesterUser, request, frontendUrl } = kysoTeamRequestAccessCreatedEvent

        for (const admin of organizationAdmins) {
            if (admin) {
                try {
                    await this.utilsService.sendHandlebarsEmail(
                        
                        admin.email,
                        `${requesterUser.display_name} requested access for team ${team.display_name}`,
                        'team-request-access-created',
                        {
                            admin,
                            organization,
                            team,
                            requesterUser,
                            frontendUrl,
                            request,
                        },
                    )
                    
                    await this.utilsService.sleep(2000)
                } catch (e) {
                    Logger.error(`An error occurred sending created request access to team ${team.display_name} to user ${admin.email}`, e, TeamsController.name)
                }
            }
        }
    }

    @EventPattern(KysoEventEnum.TEAMS_REQUEST_ACCESS_REJECTED)
    async handleRequestAccessRejected(kysoTeamRequestAccessRejectedEvent: any) {
        Logger.log(KysoEventEnum.TEAMS_REQUEST_ACCESS_REJECTED, TeamsController.name)
        Logger.debug(kysoTeamRequestAccessRejectedEvent, TeamsController.name)

        const { organization, team, rejecterUser, requesterUser, frontendUrl } = kysoTeamRequestAccessRejectedEvent

        if (requesterUser && requesterUser.email && requesterUser.display_name) {
            try {
                await this.utilsService.sendHandlebarsEmail(
                    
                    requesterUser.email,
                    `Your access request to team ${team.display_name} has been rejected`,
                    'team-request-access-rejected',
                    {
                        rejecterUser,
                        organization,
                        team,
                        requesterUser,
                        frontendUrl,
                    },
                )

                await this.utilsService.sleep(2000)
            } catch (e) {
                Logger.error(`An error occurred sending rejected request access to organization ${organization.display_name} to user ${rejecterUser.email}`, e, TeamsController.name)
            }
        }
    }

    private async getTeamMembers(team: Team): Promise<User[]> {
        const teamMembers: TeamMemberJoin[] = await this.db.collection<TeamMemberJoin>(Constants.DATABASE_COLLECTION_TEAM_MEMBER).find({ team_id: team.id }).toArray()
        let usersIds: string[] = teamMembers.map((x: TeamMemberJoin) => x.member_id)
        if (team.visibility === TeamVisibilityEnum.PUBLIC || team.visibility === TeamVisibilityEnum.PROTECTED) {
            const organizationMembers: OrganizationMemberJoin[] = await this.db
                .collection<OrganizationMemberJoin>(Constants.DATABASE_COLLECTION_ORGANIZATION_MEMBER)
                .find({ organization_id: team.organization_id })
                .toArray()
            organizationMembers.forEach((x: OrganizationMemberJoin) => {
                const index: number = usersIds.indexOf(x.id)
                if (index === -1) {
                    usersIds.push(x.id)
                }
            })
        }
        if (usersIds.length === 0) {
            return []
        }
        return this.db
            .collection<User>(Constants.DATABASE_COLLECTION_USER)
            .find({ id: { $in: usersIds } })
            .toArray()
    }
}
