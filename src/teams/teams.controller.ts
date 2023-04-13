import {
    KysoEventEnum,
    KysoTeamRequestAccessCreatedEvent,
    KysoTeamsAddMemberEvent,
    KysoTeamsCreateEvent,
    KysoTeamsDeleteEvent,
    KysoTeamsRemoveMemberEvent,
    KysoTeamsUpdateMemberRolesEvent,
    OrganizationMemberJoin,
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

    private getTextForEmail(role: string): string {
        switch (role) {
            case 'team-admin':
                return `You can admin this channel.`
            case 'team-contributor':
                return `You can contribute creating reports in this channel.`
            case 'team-reader':
                return 'You can read and comment all reports in this channel.'
            default:
                return ''
        }
    }

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
                    const messageInfo: SentMessageInfo = await this.mailerService.sendMail({
                        to: user.email,
                        subject: `New ${kysoTeamsCreateEvent.team.display_name} channel`,
                        template: 'new-team',
                        context: {
                            user: kysoTeamsCreateEvent.user,
                            organization: kysoTeamsCreateEvent.organization,
                            team: kysoTeamsCreateEvent.team,
                            frontendUrl: kysoTeamsCreateEvent.frontendUrl,
                        },
                    })
                    Logger.log(`New team mail ${messageInfo.messageId} sent to ${user.email}`, TeamsController.name)
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
        const { user, organization, team, emailsCentralized, roles, frontendUrl } = kysoTeamsAddMemberEvent
        const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(user.id, 'new_member_channel', organization.id, team.id)
        if (sendNotification) {
            this.mailerService
                .sendMail({
                    to: user.email,
                    subject: `You were added to ${team.display_name} channel`,
                    template: 'team-you-were-added',
                    context: {
                        addedUser: user,
                        organization,
                        team,
                        frontendUrl,
                        text: this.getTextForEmail(roles[0]),
                    },
                })
                .then((messageInfo) => {
                    Logger.log(`Report mail ${messageInfo.messageId} sent to ${user.email}`, TeamsController.name)
                })
                .catch((err) => {
                    Logger.error(`An error occurrend sending report mail to ${user.email}`, err, TeamsController.name)
                })
        }
        if (emailsCentralized.length > 0) {
            this.mailerService
                .sendMail({
                    to: emailsCentralized,
                    subject: `A member was added from ${team.display_name} channel`,
                    template: 'team-new-member',
                    context: {
                        addedUser: user,
                        organization,
                        team,
                        role: roles,
                        frontendUrl,
                    },
                })
                .then((messageInfo) => {
                    Logger.log(`Report mail ${messageInfo.messageId} sent to ${user.email}`, TeamsController.name)
                })
                .catch((err) => {
                    Logger.error(`An error occurrend sending report mail to ${user.email}`, err, TeamsController.name)
                })
        }
    }

    @EventPattern(KysoEventEnum.TEAMS_REMOVE_MEMBER)
    async handleCommentsUpdated(kysoTeamsRemoveMemberEvent: KysoTeamsRemoveMemberEvent) {
        Logger.log(KysoEventEnum.TEAMS_REMOVE_MEMBER, TeamsController.name)
        Logger.debug(kysoTeamsRemoveMemberEvent, TeamsController.name)
        const { user, organization, team, emailsCentralized, frontendUrl } = kysoTeamsRemoveMemberEvent
        const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(user.id, 'removed_member_in_channel', organization.id, team.id)
        if (sendNotification) {
            this.mailerService
                .sendMail({
                    to: user.email,
                    subject: `You were removed to ${team.display_name} channel`,
                    template: 'team-you-were-removed',
                    context: {
                        removedUser: user,
                        organization,
                        team,
                        frontendUrl,
                    },
                })
                .then((messageInfo) => {
                    Logger.log(`Report mail ${messageInfo.messageId} sent to ${user.email}`, TeamsController.name)
                })
                .catch((err) => {
                    Logger.error(`An error occurrend sending report mail to ${user.email}`, err, TeamsController.name)
                })
        }
        if (emailsCentralized.length > 0) {
            this.mailerService
                .sendMail({
                    to: emailsCentralized,
                    subject: `A member was removed from ${team.display_name} channel`,
                    template: 'team-removed-member',
                    context: {
                        removedUser: user,
                        organization,
                        team,
                        frontendUrl,
                    },
                })
                .then((messageInfo) => {
                    Logger.log(`Report mail ${messageInfo.messageId} sent to ${user.email}`, TeamsController.name)
                })
                .catch((err) => {
                    Logger.error(`An error occurrend sending report mail to ${user.email}`, err, TeamsController.name)
                })
        }
    }

    @EventPattern(KysoEventEnum.TEAMS_UPDATE_MEMBER_ROLES)
    async handleTeamsUpdateMemberRoles(kysoTeamsUpdateMemberRolesEvent: KysoTeamsUpdateMemberRolesEvent) {
        Logger.log(KysoEventEnum.TEAMS_UPDATE_MEMBER_ROLES, TeamsController.name)
        Logger.debug(kysoTeamsUpdateMemberRolesEvent, TeamsController.name)
        const { user, organization, team, emailsCentralized, frontendUrl, currentRoles } = kysoTeamsUpdateMemberRolesEvent
        const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(user.id, 'updated_role_in_channel', organization.id, team.id)
        if (sendNotification) {
            this.mailerService
                .sendMail({
                    to: user.email,
                    subject: `Your role in ${team.display_name} channel has changed`,
                    template: 'team-user-role-changed',
                    context: {
                        user,
                        organization,
                        team,
                        frontendUrl,
                        text: this.getTextForEmail(currentRoles[0]),
                    },
                })
                .then((messageInfo) => {
                    Logger.log(`Team role changed mail ${messageInfo.messageId} sent to ${user.email}`, TeamsController.name)
                })
                .catch((err) => {
                    Logger.error(`An error occurred sending team role changed mail to ${user.email}`, err, TeamsController.name)
                })
        }
        if (emailsCentralized.length > 0) {
            this.mailerService
                .sendMail({
                    to: emailsCentralized,
                    subject: `A member's role has changed in ${team.display_name} channel`,
                    template: 'team-member-role-changed',
                    context: {
                        user,
                        organization,
                        team,
                        frontendUrl,
                        role: currentRoles[0],
                    },
                })
                .then((messageInfo) => {
                    Logger.log(`Team role changed mail ${messageInfo.messageId} sent to ${emailsCentralized.join(', ')}`, TeamsController.name)
                })
                .catch((err) => {
                    Logger.error(`An error occurred sending team role changed mail to ${emailsCentralized.join(', ')}`, err, TeamsController.name)
                })
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
        for (const teamUser of teamUsers) {
            const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(teamUser.id, 'channel_removed', organization.id, team.id)
            if (!sendNotification) {
                continue
            }
            try {
                await this.mailerService.sendMail({
                    to: teamUser.email,
                    subject: `Team ${team.display_name} was removed`,
                    template: 'team-deleted',
                    context: {
                        user,
                        organization,
                        team,
                    },
                })
                await this.utilsService.sleep(200)
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
                    await this.mailerService.sendMail({
                        to: admin.email,
                        subject: `${requesterUser.display_name} requested access for team ${team.display_name}`,
                        template: 'team-request-access-created',
                        context: {
                            admin,
                            organization,
                            team,
                            requesterUser,
                            frontendUrl,
                            request,
                        },
                    })

                    await this.utilsService.sleep(200)
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
                await this.mailerService.sendMail({
                    to: requesterUser.email,
                    subject: `Your access request to team ${team.display_name} has been rejected`,
                    template: 'team-request-access-rejected',
                    context: {
                        rejecterUser,
                        organization,
                        team,
                        requesterUser,
                        frontendUrl,
                    },
                })

                await this.utilsService.sleep(200)
            } catch (e) {
                Logger.error(`An error occurred sending rejected request access to organization ${organization.display_name} to user ${rejecterUser.email}`, e, TeamsController.name)
            }
        }
    }
}
