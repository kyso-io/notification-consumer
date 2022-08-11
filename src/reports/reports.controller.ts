import { KysoEventEnum, KysoReportsCreateEvent, KysoReportsNewVersionEvent, Report } from '@kyso-io/kyso-model'
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

    @EventPattern(KysoEventEnum.REPORTS_CREATE)
    async handleReportsCreate(kysoReportsCreateEvent: KysoReportsCreateEvent) {
        Logger.log(KysoEventEnum.REPORTS_CREATE, ReportsController.name)
        Logger.debug(kysoReportsCreateEvent, ReportsController.name)

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

    @EventPattern(KysoEventEnum.REPORTS_UPDATE)
    async handleReportsUpdate(report: Report) {
        console.log(KysoEventEnum.REPORTS_UPDATE, report)
    }

    @EventPattern(KysoEventEnum.REPORTS_NEW_VERSION)
    async handleReportsNewVersion(kysoReportsNewVersionEvent: KysoReportsNewVersionEvent) {
        Logger.log(KysoEventEnum.REPORTS_NEW_VERSION, ReportsController.name)
        Logger.debug(kysoReportsNewVersionEvent, ReportsController.name)

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

    @EventPattern(KysoEventEnum.REPORTS_DELETE)
    async handleReportsDelete(report: Report) {
        Logger.log(KysoEventEnum.REPORTS_DELETE, ReportsController.name)
        Logger.debug(report, ReportsController.name)
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
}
