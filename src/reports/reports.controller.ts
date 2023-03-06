import { KysoEventEnum, KysoReportsCreateEvent, KysoReportsDeleteEvent, KysoReportsMentionsEvent, KysoReportsNewMentionEvent, KysoReportsNewVersionEvent, Report, User } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Controller, Inject, Logger } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { Db } from 'mongodb'
import { SentMessageInfo } from 'nodemailer'
import { Constants } from '../constants'
import { UtilsService } from '../shared/utils.service'

@Controller()
export class ReportsController {
    constructor(
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
        private readonly mailerService: MailerService,
        private readonly utilsService: UtilsService,
    ) {}

    private async sendMailNewReport(kysoReportsCreateEvent: KysoReportsCreateEvent, email: string): Promise<void> {
        try {
            const messageInfo: SentMessageInfo = await this.mailerService.sendMail({
                to: email,
                subject: `New report '${kysoReportsCreateEvent.report.title}' published`,
                template: 'report-new',
                context: {
                    organization: kysoReportsCreateEvent.organization,
                    team: kysoReportsCreateEvent.team,
                    report: kysoReportsCreateEvent.report,
                    frontendUrl: kysoReportsCreateEvent.frontendUrl,
                },
            })
            Logger.log(`Report mail ${messageInfo.messageId} sent to ${email}`, ReportsController.name)
        } catch (e) {
            Logger.error(`An error occurrend sending report mail to ${email}`, e, ReportsController.name)
        }
    }

    @EventPattern(KysoEventEnum.REPORTS_CREATE)
    async handleReportsCreate(kysoReportsCreateEvent: KysoReportsCreateEvent) {
        Logger.log(KysoEventEnum.REPORTS_CREATE, ReportsController.name)
        Logger.debug(kysoReportsCreateEvent, ReportsController.name)
        const { organization, team, report } = kysoReportsCreateEvent
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        if (centralizedMails && Array.isArray(emails) && emails.length > 0) {
            for (const email of emails) {
                await this.sendMailNewReport(kysoReportsCreateEvent, email)
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
                const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(user.id, 'new_report', organization.id, team.id)
                if (sendNotification) {
                    await this.sendMailNewReport(kysoReportsCreateEvent, user.email)
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
            const messageInfo: SentMessageInfo = await this.mailerService.sendMail({
                to: email,
                subject: `Existing report '${kysoReportsNewVersionEvent.report.title}' updated`,
                template: 'report-updated',
                context: {
                    organization: kysoReportsNewVersionEvent.organization,
                    team: kysoReportsNewVersionEvent.team,
                    report: kysoReportsNewVersionEvent.report,
                    frontendUrl: kysoReportsNewVersionEvent.frontendUrl,
                },
            })
            Logger.log(`Report mail ${messageInfo.messageId} sent to ${email}`, ReportsController.name)
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

    private async sendMailReportDeleted(kysoReportsDeleteEvent: KysoReportsDeleteEvent, email: string): Promise<void> {
        try {
            const messageInfo: SentMessageInfo = await this.mailerService.sendMail({
                to: email,
                subject: `Report '${kysoReportsDeleteEvent.report.title}' deleted`,
                template: 'report-deleted',
                context: {
                    organization: kysoReportsDeleteEvent.organization,
                    team: kysoReportsDeleteEvent.team,
                    report: kysoReportsDeleteEvent.report,
                    frontendUrl: kysoReportsDeleteEvent.frontendUrl,
                },
            })
            Logger.log(`Report mail ${messageInfo.messageId} sent to ${email}`, ReportsController.name)
        } catch (e) {
            Logger.error(`An error occurrend sending report mail to ${email}`, e, ReportsController.name)
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
                await this.sendMailReportDeleted(kysoReportsDeleteEvent, email)
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
                const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(user.id, 'deleted_report', organization.id, team.id)
                if (sendNotification) {
                    await this.sendMailReportDeleted(kysoReportsDeleteEvent, user.email)
                }
            }
        }
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
        const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(user.id, 'new_mention_in_report', organization.id, team.id)
        if (!sendNotification) {
            return
        }
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

    private async sendMailMentionsInReport(kysoReportsMentionsEvent: KysoReportsMentionsEvent, email: string): Promise<void> {
        try {
            const messageInfo: SentMessageInfo = await this.mailerService.sendMail({
                to: email,
                subject: 'Mentions in a report',
                template: 'report-mentions',
                context: {
                    creator: kysoReportsMentionsEvent.creator,
                    users: kysoReportsMentionsEvent.users.map((u: User) => u.display_name).join(','),
                    organization: kysoReportsMentionsEvent.organization,
                    team: kysoReportsMentionsEvent.team,
                    report: kysoReportsMentionsEvent.report,
                    frontendUrl: kysoReportsMentionsEvent.frontendUrl,
                },
            })
            Logger.log(`Mention in report mail ${messageInfo.messageId} sent to ${email}`, ReportsController.name)
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
}
