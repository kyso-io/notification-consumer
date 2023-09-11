import {
    KysoEventEnum,
    KysoReportsCreateEvent,
    KysoReportsDeleteEvent,
    KysoReportsMentionsEvent,
    KysoReportsMoveEvent,
    KysoReportsNewMentionEvent,
    KysoReportsNewVersionEvent,
    Organization,
    OrganizationMemberJoin,
    Report,
    Team,
    TeamMemberJoin,
    TeamVisibilityEnum,
    User,
} from '@kyso-io/kyso-model'
import { Controller, Inject, Logger } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { Db } from 'mongodb'
import { Constants } from '../constants'
import { UtilsService } from '../shared/utils.service'

@Controller()
export class ReportsController {
    constructor(
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
        private readonly utilsService: UtilsService,
    ) {}

    private async sendMailNewReport(kysoReportsCreateEvent: KysoReportsCreateEvent, email: string): Promise<void> {
        try {
            await this.utilsService.sendHandlebarsEmail(email, `New report '${kysoReportsCreateEvent.report.title}' published`, 'report-new', {
                user: kysoReportsCreateEvent.user,
                organization: kysoReportsCreateEvent.organization,
                team: kysoReportsCreateEvent.team,
                report: kysoReportsCreateEvent.report,
                frontendUrl: kysoReportsCreateEvent.frontendUrl,
            })
        } catch (e) {
            Logger.error(`An error occurrend sending report mail to ${email}`, e, ReportsController.name)
        }
    }

    @EventPattern(KysoEventEnum.REPORTS_CREATE)
    async handleReportsCreate(kysoReportsCreateEvent: KysoReportsCreateEvent) {
        Logger.log(KysoEventEnum.REPORTS_CREATE, ReportsController.name)
        Logger.debug(kysoReportsCreateEvent, ReportsController.name)
        const { organization, team } = kysoReportsCreateEvent
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        if (centralizedMails && Array.isArray(emails) && emails.length > 0) {
            for (const email of emails) {
                await this.sendMailNewReport(kysoReportsCreateEvent, email)
            }
        } else {
            const users: User[] = await this.getUsersToNotify(organization, team)
            for (const user of users) {
                const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(user.id, 'new_report', organization.id, team.id)
                if (sendNotification) {
                    await this.sendMailNewReport(kysoReportsCreateEvent, user.email)
                }
            }
        }
    }

    private async sendMailReportMoved(kysoReportsMoveEvent: KysoReportsMoveEvent, email: string): Promise<void> {
        try {
            await this.utilsService.sendHandlebarsEmail(email, `Report '${kysoReportsMoveEvent.report.title}' moved`, 'report-moved', kysoReportsMoveEvent)
        } catch (e) {
            Logger.error(`An error occurrend sending report mail to ${email}`, e, ReportsController.name)
        }
    }

    @EventPattern(KysoEventEnum.REPORTS_MOVE)
    async handleReportsMove(kysoReportsMoveEvent: KysoReportsMoveEvent) {
        Logger.log(KysoEventEnum.REPORTS_MOVE, ReportsController.name)
        Logger.debug(kysoReportsMoveEvent, ReportsController.name)
        const { targetOrganization, targetTeam, report } = kysoReportsMoveEvent
        const centralizedMails: boolean = targetOrganization?.options?.notifications?.centralized || false
        const emails: string[] = targetOrganization?.options?.notifications?.emails || []
        if (centralizedMails && Array.isArray(emails) && emails.length > 0) {
            for (const email of emails) {
                await this.sendMailReportMoved(kysoReportsMoveEvent, email)
            }
        } else {
            const users: User[] = await this.db
                .collection<User>(Constants.DATABASE_COLLECTION_USER)
                .find({
                    id: {
                        $in: report.author_ids,
                    },
                })
                .toArray()
            for (const user of users) {
                const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(user.id, 'report_moved', targetOrganization.id, targetTeam.id)
                if (sendNotification) {
                    await this.sendMailReportMoved(kysoReportsMoveEvent, user.email)
                }
            }
        }
    }

    @EventPattern(KysoEventEnum.REPORTS_UPDATE)
    async handleReportsUpdate(report: Report) {
        Logger.log(KysoEventEnum.REPORTS_UPDATE, ReportsController.name)
        Logger.debug(report, ReportsController.name)
    }

    private async sendMailNewReportVersion(kysoReportsNewVersionEvent: KysoReportsNewVersionEvent, email: string): Promise<void> {
        try {
            await this.utilsService.sendHandlebarsEmail(email, `Existing report '${kysoReportsNewVersionEvent.report.title}' updated`, 'report-updated', {
                userCreatingAction: kysoReportsNewVersionEvent.user,
                organization: kysoReportsNewVersionEvent.organization,
                team: kysoReportsNewVersionEvent.team,
                report: kysoReportsNewVersionEvent.report,
                frontendUrl: kysoReportsNewVersionEvent.frontendUrl,
            })
        } catch (e) {
            Logger.error(`An error occurrend sending report mail to ${email}`, e, ReportsController.name)
        }
    }

    @EventPattern(KysoEventEnum.REPORTS_NEW_VERSION)
    async handleReportsNewVersion(kysoReportsNewVersionEvent: KysoReportsNewVersionEvent) {
        Logger.log(KysoEventEnum.REPORTS_NEW_VERSION, ReportsController.name)
        Logger.debug(kysoReportsNewVersionEvent, ReportsController.name)
        const { organization, team, report } = kysoReportsNewVersionEvent
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        if (centralizedMails && Array.isArray(emails) && emails.length > 0) {
            for (const email of emails) {
                await this.sendMailNewReportVersion(kysoReportsNewVersionEvent, email)
            }
        } else {
            const users: User[] = await this.db
                .collection<User>(Constants.DATABASE_COLLECTION_USER)
                .find({
                    id: {
                        $in: report.author_ids,
                    },
                })
                .toArray()
            for (const user of users) {
                const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(user.id, 'new_report_version', organization.id, team.id)
                if (sendNotification) {
                    await this.sendMailNewReportVersion(kysoReportsNewVersionEvent, user.email)
                }
            }
        }
    }

    private async sendMailReportDeleted(kysoReportsDeleteEvent: KysoReportsDeleteEvent, userReceivingAction: User): Promise<void> {
        try {
            await this.utilsService.sendHandlebarsEmail(userReceivingAction.email, `Report '${kysoReportsDeleteEvent.report.title}' deleted`, 'report-delete', {
                userReceivingAction: userReceivingAction,
                userCreatingAction: kysoReportsDeleteEvent.user,
                organization: kysoReportsDeleteEvent.organization,
                team: kysoReportsDeleteEvent.team,
                report: kysoReportsDeleteEvent.report,
                frontendUrl: kysoReportsDeleteEvent.frontendUrl,
            })
        } catch (e) {
            Logger.error(`An error occurrend sending report mail to ${userReceivingAction.email}`, e, ReportsController.name)
        }
    }

    @EventPattern(KysoEventEnum.REPORTS_DELETE)
    async handleReportsDelete(kysoReportsDeleteEvent: KysoReportsDeleteEvent) {
        Logger.log(KysoEventEnum.REPORTS_DELETE, ReportsController.name)
        Logger.debug(kysoReportsDeleteEvent, ReportsController.name)
        const { organization, team, report } = kysoReportsDeleteEvent
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        if (centralizedMails && Array.isArray(emails) && emails.length > 0) {
            for (const email of emails) {
                const user: User | null = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ email })
                if (user) {
                    await this.sendMailReportDeleted(kysoReportsDeleteEvent, user)
                }
            }
        } else {
            const users: User[] = await this.db
                .collection<User>(Constants.DATABASE_COLLECTION_USER)
                .find({
                    id: {
                        $in: report.author_ids,
                    },
                })
                .toArray()
            for (const user of users) {
                const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(user.id, 'report_removed', organization.id, team.id)
                if (sendNotification) {
                    await this.sendMailReportDeleted(kysoReportsDeleteEvent, user)
                }
            }
        }
    }

    @EventPattern(KysoEventEnum.REPORTS_CREATE_NO_PERMISSIONS)
    async handleReportsCreateNoPermissions(kysoReportsCreateEvent: KysoReportsCreateEvent) {
        Logger.log(KysoEventEnum.REPORTS_CREATE_NO_PERMISSIONS, ReportsController.name)
        Logger.debug(kysoReportsCreateEvent, ReportsController.name)

        const { user } = kysoReportsCreateEvent
        await this.utilsService.sendHandlebarsEmail(user.email, 'Error creating report', 'report-error-permissions', {}).catch((err) => {
            Logger.error(`Error sending mail 'Invalid permissions for creating report' to ${user.display_name}`, err, ReportsController.name)
        })
    }

    @EventPattern(KysoEventEnum.REPORTS_NEW_MENTION)
    async handleDiscussionsNewMention(kysoReportsNewMentionEvent: KysoReportsNewMentionEvent) {
        Logger.log(KysoEventEnum.REPORTS_NEW_MENTION, ReportsController.name)
        Logger.debug(kysoReportsNewMentionEvent, ReportsController.name)
        const { user, creator, organization, team, report, frontendUrl } = kysoReportsNewMentionEvent
        const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(user.id, 'new_mention_in_report', organization.id, team.id)
        if (!sendNotification) {
            return
        }
        await this.utilsService
            .sendHandlebarsEmail(user.email, 'You have been mentioned in a report', 'report-mention', {
                creator,
                organization,
                team,
                report,
                frontendUrl,
            })
            .catch((err) => {
                Logger.error(`An error occurrend sending mention in report mail to ${user.email}`, err, ReportsController.name)
            })
    }

    private async sendMailMentionsInReport(kysoReportsMentionsEvent: KysoReportsMentionsEvent, email: string): Promise<void> {
        try {
            await this.utilsService.sendHandlebarsEmail(email, 'Mentions in a report', 'report-mentions', {
                creator: kysoReportsMentionsEvent.creator,
                users: kysoReportsMentionsEvent.users.map((u: User) => u.display_name).join(','),
                organization: kysoReportsMentionsEvent.organization,
                team: kysoReportsMentionsEvent.team,
                report: kysoReportsMentionsEvent.report,
                frontendUrl: kysoReportsMentionsEvent.frontendUrl,
            })
        } catch (e) {
            Logger.error(`An error occurrend sending mention in report mail to ${email}`, e, ReportsController.name)
        }
    }

    @EventPattern(KysoEventEnum.REPORTS_MENTIONS)
    async handleReportsMentions(kysoReportsMentionsEvent: KysoReportsMentionsEvent) {
        Logger.log(KysoEventEnum.REPORTS_MENTIONS, ReportsController.name)
        Logger.debug(kysoReportsMentionsEvent, ReportsController.name)
        const { to, organization, team } = kysoReportsMentionsEvent
        if (!to || !Array.isArray(to)) {
            return
        }
        for (const email of to) {
            const user: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ email })
            if (!user) {
                continue
            }
            const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(user.id, 'new_mention_in_report', organization.id, team.id)
            if (!sendNotification) {
                continue
            }
            await this.sendMailMentionsInReport(kysoReportsMentionsEvent, email)
        }
    }

    private async getUsersToNotify(organization: Organization, team: Team): Promise<User[]> {
        let userIds: string[] = []
        switch (team.visibility) {
            case TeamVisibilityEnum.PUBLIC:
            case TeamVisibilityEnum.PROTECTED:
                const organizationMembers: OrganizationMemberJoin[] = await this.db
                    .collection<OrganizationMemberJoin>(Constants.DATABASE_COLLECTION_ORGANIZATION_MEMBER)
                    .find({ organization_id: organization.id })
                    .toArray()
                userIds = organizationMembers.map((om: OrganizationMemberJoin) => om.member_id)
                break
            case TeamVisibilityEnum.PRIVATE:
                const teamMembers: TeamMemberJoin[] = await this.db.collection<TeamMemberJoin>(Constants.DATABASE_COLLECTION_TEAM_MEMBER).find({ id: team.id }).toArray()
                userIds = teamMembers.map((tm: TeamMemberJoin) => tm.member_id)
                break
            default:
                break
        }
        if (userIds.length === 0) {
            return []
        }
        let users: User[] = []
        const OFFSET = 50
        for (let i = 0; i < userIds.length; i++) {
            const usersOffset: User[] = await this.db
                .collection<User>(Constants.DATABASE_COLLECTION_USER)
                .find({ id: { $in: userIds.slice(i * OFFSET, (i + 1) * OFFSET) } })
                .toArray()
            for (const user of usersOffset) {
                const index: number = users.findIndex((u: User) => u.id === user.id)
                if (index === -1) {
                    users.push(user)
                }
            }
        }
        return users
    }
}
