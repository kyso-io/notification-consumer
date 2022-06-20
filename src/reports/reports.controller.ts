import { KysoEvent, KysoReportsCreateEvent, KysoReportsNewVersionEvent, Report } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Controller, Inject, Logger } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { Db } from 'mongodb'
import { Constants } from '../constants'

@Controller()
export class ReportsController {
    constructor(
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
        private readonly mailerService: MailerService,
    ) {}

    @EventPattern(KysoEvent.REPORTS_CREATE)
    async handleReportsCreate(kysoReportsCreateEvent: KysoReportsCreateEvent) {
        const { user, organization, team, report, frontendUrl } = kysoReportsCreateEvent
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        const to: string | string[] = centralizedMails && emails.length > 0 ? emails : user.email
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

    @EventPattern(KysoEvent.REPORTS_UPDATE)
    async handleReportsUpdate(report: Report) {
        console.log(KysoEvent.REPORTS_UPDATE, report)
    }

    @EventPattern(KysoEvent.REPORTS_NEW_VERSION)
    async handleReportsNewVersion(kysoReportsNewVersionEvent: KysoReportsNewVersionEvent) {
        const { user, organization, team, report, frontendUrl } = kysoReportsNewVersionEvent
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        const to: string | string[] = centralizedMails && emails.length > 0 ? emails : user.email
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

    @EventPattern(KysoEvent.REPORTS_DELETE)
    async handleReportsDelete(report: Report) {
        console.log(KysoEvent.REPORTS_DELETE, report)
    }

    @EventPattern(KysoEvent.REPORTS_CREATE_NO_PERMISSIONS)
    async handleReportsCreateNoPermissions(kysoReportsCreateEvent: KysoReportsCreateEvent) {
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
}
