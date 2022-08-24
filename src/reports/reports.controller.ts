import { KysoEventEnum, KysoReportsCreateEvent, KysoReportsDeleteEvent, KysoReportsMentionsEvent, KysoReportsNewMentionEvent, KysoReportsNewVersionEvent, Report, User } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Controller, Inject, Logger } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { Db, FindCursor } from 'mongodb'
import { Constants } from '../constants'

@Controller()
export class ReportsController {
    constructor(
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
        private readonly mailerService: MailerService,
    ) {}

    @EventPattern(KysoEventEnum.REPORTS_CREATE)
    async handleReportsCreate(kysoReportsCreateEvent: KysoReportsCreateEvent) {
        Logger.log(KysoEventEnum.REPORTS_CREATE, ReportsController.name)
        Logger.debug(kysoReportsCreateEvent, ReportsController.name)

        const { organization, team, report, frontendUrl } = kysoReportsCreateEvent
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        let to: string[] = []
        if (centralizedMails && emails.length > 0) {
            to = emails
        } else {
            const cursor: FindCursor<User> = (await this.db.collection(Constants.DATABASE_COLLECTION_USER).find({
                id: {
                    $in: report.author_ids,
                },
            })) as any
            to = (await cursor.toArray()).map((user: User) => user.email)
        }
        if (to.length === 0) {
            Logger.error(`No authors found for report ${report.id} ${report.sluglified_name}`, ReportsController.name)
            return
        }
        this.mailerService
            .sendMail({
                to,
                subject: `New report '${report.title}' published`,
                template: 'report-new',
                context: {
                    organization,
                    team,
                    report,
                    frontendUrl,
                },
            })
            .then((messageInfo) => {
                Logger.log(`Report mail ${messageInfo.messageId} sent to ${Array.isArray(to) ? to.join(', ') : to}`, ReportsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurrend sending report mail to ${Array.isArray(to) ? to.join(', ') : to}`, err, ReportsController.name)
            })
    }

    @EventPattern(KysoEventEnum.REPORTS_UPDATE)
    async handleReportsUpdate(report: Report) {
        Logger.log(KysoEventEnum.REPORTS_UPDATE, ReportsController.name)
        Logger.debug(report, ReportsController.name)
    }

    @EventPattern(KysoEventEnum.REPORTS_NEW_VERSION)
    async handleReportsNewVersion(kysoReportsNewVersionEvent: KysoReportsNewVersionEvent) {
        Logger.log(KysoEventEnum.REPORTS_NEW_VERSION, ReportsController.name)
        Logger.debug(kysoReportsNewVersionEvent, ReportsController.name)

        const { organization, team, report, frontendUrl } = kysoReportsNewVersionEvent
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        let to: string[] = []
        if (centralizedMails && emails.length > 0) {
            to = emails
        } else {
            const cursor: FindCursor<User> = (await this.db.collection(Constants.DATABASE_COLLECTION_USER).find({
                id: {
                    $in: report.author_ids,
                },
            })) as any
            to = (await cursor.toArray()).map((user: User) => user.email)
        }
        if (to.length === 0) {
            Logger.error(`No authors found for report ${report.id} ${report.sluglified_name}`, ReportsController.name)
            return
        }
        this.mailerService
            .sendMail({
                to,
                subject: `Existing report '${report.title}' updated`,
                template: 'report-updated',
                context: {
                    organization,
                    team,
                    report,
                    frontendUrl,
                },
            })
            .then((messageInfo) => {
                Logger.log(`Report mail ${messageInfo.messageId} sent to ${Array.isArray(to) ? to.join(', ') : to}`, ReportsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurrend sending report mail to ${Array.isArray(to) ? to.join(', ') : to}`, err, ReportsController.name)
            })
    }

    @EventPattern(KysoEventEnum.REPORTS_DELETE)
    async handleReportsDelete(kysoReportsDeleteEvent: KysoReportsDeleteEvent) {
        Logger.log(KysoEventEnum.REPORTS_DELETE, ReportsController.name)
        Logger.debug(kysoReportsDeleteEvent, ReportsController.name)

        const { organization, team, report, frontendUrl } = kysoReportsDeleteEvent
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        let to: string[] = []
        if (centralizedMails && emails.length > 0) {
            to = emails
        } else {
            const cursor: FindCursor<User> = (await this.db.collection(Constants.DATABASE_COLLECTION_USER).find({
                id: {
                    $in: report.author_ids,
                },
            })) as any
            to = (await cursor.toArray()).map((user: User) => user.email)
        }
        if (to.length === 0) {
            Logger.error(`No authors found for report ${report.id} ${report.sluglified_name}`, ReportsController.name)
            return
        }
        this.mailerService
            .sendMail({
                to,
                subject: `Existing report '${report.title}' deleted`,
                template: 'report-delete',
                context: {
                    organization,
                    team,
                    report,
                    frontendUrl,
                },
            })
            .then((messageInfo) => {
                Logger.log(`Report mail ${messageInfo.messageId} sent to ${Array.isArray(to) ? to.join(', ') : to}`, ReportsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurrend sending report mail to ${Array.isArray(to) ? to.join(', ') : to}`, err, ReportsController.name)
            })
    }

    @EventPattern(KysoEventEnum.REPORTS_CREATE_NO_PERMISSIONS)
    async handleReportsCreateNoPermissions(kysoReportsCreateEvent: KysoReportsCreateEvent) {
        Logger.log(KysoEventEnum.REPORTS_CREATE_NO_PERMISSIONS, ReportsController.name)
        Logger.debug(kysoReportsCreateEvent, ReportsController.name)

        const { user } = kysoReportsCreateEvent
        this.mailerService
            .sendMail({
                to: user.email,
                subject: 'Error creating report',
                template: 'report-error-permissions',
            })
            .then(() => {
                Logger.log(`Mail 'Invalid permissions for creating report' sent to ${user.display_name}`, ReportsController.name)
            })
            .catch((err) => {
                Logger.error(`Error sending mail 'Invalid permissions for creating report' to ${user.display_name}`, err, ReportsController.name)
            })
    }

    @EventPattern(KysoEventEnum.REPORTS_NEW_MENTION)
    async handleDiscussionsNewMention(kysoReportsNewMentionEvent: KysoReportsNewMentionEvent) {
        Logger.log(KysoEventEnum.REPORTS_NEW_MENTION, ReportsController.name)
        Logger.debug(kysoReportsNewMentionEvent, ReportsController.name)

        const { user, creator, organization, team, report, frontendUrl } = kysoReportsNewMentionEvent
        this.mailerService
            .sendMail({
                to: user.email,
                subject: 'You have been mentioned in a report',
                template: 'report-mention',
                context: {
                    creator,
                    organization,
                    team,
                    report,
                    frontendUrl,
                },
            })
            .then((messageInfo) => {
                Logger.log(`Mention in report mail ${messageInfo.messageId} sent to ${user.email}`, ReportsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurrend sending mention in report mail to ${user.email}`, err, ReportsController.name)
            })
    }

    @EventPattern(KysoEventEnum.REPORTS_MENTIONS)
    async handleReportsMentions(kysoReportsMentionsEvent: KysoReportsMentionsEvent) {
        Logger.log(KysoEventEnum.REPORTS_MENTIONS, ReportsController.name)
        Logger.debug(kysoReportsMentionsEvent, ReportsController.name)

        const { to, creator, users, organization, team, report, frontendUrl } = kysoReportsMentionsEvent
        this.mailerService
            .sendMail({
                to,
                subject: 'Mentions in a report',
                template: 'report-mentions',
                context: {
                    creator,
                    users: users.map((u: User) => u.display_name).join(','),
                    organization,
                    team,
                    report,
                    frontendUrl,
                },
            })
            .then((messageInfo) => {
                Logger.log(`Mention in report mail ${messageInfo.messageId} sent to ${Array.isArray(to) ? to.join(', ') : to}`, ReportsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurrend sending mention in report mail to ${Array.isArray(to) ? to.join(', ') : to}`, err, ReportsController.name)
            })
    }
}
