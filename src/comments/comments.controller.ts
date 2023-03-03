import { KysoCommentsCreateEvent, KysoCommentsDeleteEvent, KysoCommentsUpdateEvent, KysoEventEnum } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Controller, Logger } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { SentMessageInfo } from 'nodemailer'
import { UtilsService } from '../shared/utils.service'

@Controller()
export class CommentsController {
    constructor(private readonly mailerService: MailerService, private readonly utilsService: UtilsService) {}

    private async sendMailReplyCommentInReport(kysoCommentsCreateEvent: KysoCommentsCreateEvent, email: string): Promise<void> {
        try {
            const messageInfo: SentMessageInfo = await this.mailerService.sendMail({
                to: email,
                subject: `New reply to your comment on report ${kysoCommentsCreateEvent.report.title}`,
                template: 'comment-reply',
                context: {
                    frontendUrl: kysoCommentsCreateEvent.frontendUrl,
                    organization: kysoCommentsCreateEvent.organization,
                    team: kysoCommentsCreateEvent.team,
                    report: kysoCommentsCreateEvent.report,
                    comment: kysoCommentsCreateEvent.comment,
                },
            })
            Logger.log(`New reply comment mail ${messageInfo.messageId} sent to ${email}`, CommentsController.name)
        } catch (e) {
            Logger.error(`An error occurred sending new reply comment mail to ${email}`, e, CommentsController.name)
        }
    }

    @EventPattern(KysoEventEnum.COMMENTS_REPLY)
    async handleReplyToComment(kysoCommentsCreateEvent: KysoCommentsCreateEvent) {
        Logger.log(KysoEventEnum.COMMENTS_REPLY, CommentsController.name)
        Logger.debug(kysoCommentsCreateEvent, CommentsController.name)
        const { organization, user, report, team } = kysoCommentsCreateEvent
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        if (centralizedMails && Array.isArray(emails) && emails.length > 0) {
            for (const email of emails) {
                if (report) {
                    await this.sendMailReplyCommentInReport(kysoCommentsCreateEvent, email)
                }
            }
        } else {
            const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(user.id, 'replay_comment_in_report', organization.id, team.id)
            if (sendNotification) {
                if (report) {
                    await this.sendMailReplyCommentInReport(kysoCommentsCreateEvent, user.email)
                }
            }
        }
    }

    private async sendMailNewCommentInReport(kysoCommentsCreateEvent: KysoCommentsCreateEvent, email: string): Promise<void> {
        try {
            const messageInfo: SentMessageInfo = await this.mailerService.sendMail({
                to: email,
                subject: `New comment in report ${kysoCommentsCreateEvent.report.title}`,
                template: 'comment-new',
                context: {
                    frontendUrl: kysoCommentsCreateEvent.frontendUrl,
                    organization: kysoCommentsCreateEvent.organization,
                    team: kysoCommentsCreateEvent.team,
                    report: kysoCommentsCreateEvent.report,
                    comment: kysoCommentsCreateEvent.comment,
                },
            })
            Logger.log(`New comment mail ${messageInfo.messageId} sent to ${email}`, CommentsController.name)
        } catch (e) {
            Logger.error(`An error occurred sending new comment mail to ${email}`, e, CommentsController.name)
        }
    }

    @EventPattern(KysoEventEnum.COMMENTS_CREATE)
    async handleCommentsCreated(kysoCommentsCreateEvent: KysoCommentsCreateEvent) {
        Logger.log(KysoEventEnum.COMMENTS_CREATE, CommentsController.name)
        Logger.debug(kysoCommentsCreateEvent, CommentsController.name)
        const { organization, team, report, user } = kysoCommentsCreateEvent
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        if (centralizedMails && Array.isArray(emails) && emails.length > 0) {
            for (const email of emails) {
                if (report) {
                    await this.sendMailNewCommentInReport(kysoCommentsCreateEvent, email)
                }
            }
        } else {
            const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(user.id, 'new_comment_in_report', organization.id, team.id)
            if (sendNotification) {
                if (report) {
                    this.sendMailNewCommentInReport(kysoCommentsCreateEvent, user.email)
                }
            }
        }
    }

    @EventPattern(KysoEventEnum.COMMENTS_UPDATE)
    async handleCommentsUpdated(event: KysoCommentsUpdateEvent) {
        Logger.log(KysoEventEnum.COMMENTS_UPDATE, CommentsController.name)
        Logger.debug(event, CommentsController.name)

        const { frontendUrl, organization, team, report, user, comment } = event

        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        const to = centralizedMails && emails.length > 0 ? emails : user.email

        this.mailerService
            .sendMail({
                to,
                subject: `Comment edited in report ${report.title}`,
                template: 'comment-updated',
                context: {
                    frontendUrl,
                    organization,
                    team,
                    report,
                    comment,
                },
            })
            .then((messageInfo) => {
                Logger.log(`Updated comment mail ${messageInfo.messageId} sent to ${Array.isArray(to) ? to.join(', ') : to}`, CommentsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurred sending updated comment mail to ${Array.isArray(to) ? to.join(', ') : to}`, err, CommentsController.name)
            })
    }

    private async sendMailDeleteCommentInReport(kysoCommentsDeleteEvent: KysoCommentsDeleteEvent, email: string): Promise<void> {
        try {
            const messageInfo: SentMessageInfo = await this.mailerService.sendMail({
                to: email,
                subject: `Deleted a comment in report ${kysoCommentsDeleteEvent.report.title}`,
                template: 'comment-deleted',
                context: {
                    frontendUrl: kysoCommentsDeleteEvent.frontendUrl,
                    organization: kysoCommentsDeleteEvent.organization,
                    team: kysoCommentsDeleteEvent.team,
                    report: kysoCommentsDeleteEvent.report,
                    comment: kysoCommentsDeleteEvent.comment,
                },
            })
            Logger.log(`Deleted comment mail ${messageInfo.messageId} sent to ${email}`, CommentsController.name)
        } catch (e) {
            Logger.error(`An error occurred sending deleted comment mail to ${email}`, e, CommentsController.name)
        }
    }

    @EventPattern(KysoEventEnum.COMMENTS_DELETE)
    async handleCommentsDeleted(kysoCommentsDeleteEvent: KysoCommentsDeleteEvent) {
        Logger.log(KysoEventEnum.COMMENTS_DELETE, CommentsController.name)
        Logger.debug(kysoCommentsDeleteEvent, CommentsController.name)
        const { organization, team, report, user } = kysoCommentsDeleteEvent
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        if (centralizedMails && Array.isArray(emails) && emails.length > 0) {
            for (const email of emails) {
                if (report) {
                    await this.sendMailDeleteCommentInReport(kysoCommentsDeleteEvent, email)
                }
            }
        } else {
            const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(user.id, 'report_comment_removed', organization.id, team.id)
            if (sendNotification) {
                if (report) {
                    this.sendMailDeleteCommentInReport(kysoCommentsDeleteEvent, user.email)
                }
            }
        }
    }
}
