import { KysoCommentsCreateEvent, KysoCommentsDeleteEvent, KysoCommentsUpdateEvent, KysoEventEnum } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Controller, Inject, Logger } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { Db } from 'mongodb'
import { Constants } from '../constants'

@Controller()
export class CommentsController {
    constructor(
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
        private readonly mailerService: MailerService
    ) {}

    @EventPattern(KysoEventEnum.COMMENTS_REPLY)
    async handleReplyToComment(event: KysoCommentsCreateEvent) {
        Logger.log(KysoEventEnum.COMMENTS_REPLY, CommentsController.name)
        Logger.debug(event, CommentsController.name)

        const { frontendUrl, organization, team, report, user, comment} = event;

        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        const to = centralizedMails && emails.length > 0 ? emails : user.email

        this.mailerService
            .sendMail({
                to,
                subject: `New reply to your comment on report ${report.title}`,
                template: 'comment-reply',
                context: {
                    frontendUrl,
                    organization,
                    team,
                    report,
                    comment
                },
            })
            .then((messageInfo) => {
                Logger.log(`New reply comment mail ${messageInfo.messageId} sent to ${Array.isArray(to) ? to.join(', ') : to}`, CommentsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurred sending new reply comment mail to ${Array.isArray(to) ? to.join(', ') : to}`, err, CommentsController.name)
            })
    }

    @EventPattern(KysoEventEnum.COMMENTS_CREATE)
    async handleCommentsCreated(event: KysoCommentsCreateEvent) {
        Logger.log(KysoEventEnum.COMMENTS_CREATE, CommentsController.name)
        Logger.debug(event, CommentsController.name)

        const { frontendUrl, organization, team, report, user, comment} = event;

        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        const to = centralizedMails && emails.length > 0 ? emails : user.email

        this.mailerService
            .sendMail({
                to,
                subject: `New comment in report ${report.title}`,
                template: 'comment-new',
                context: {
                    frontendUrl,
                    organization,
                    team,
                    report,
                    comment
                },
            })
            .then((messageInfo) => {
                Logger.log(`New comment mail ${messageInfo.messageId} sent to ${Array.isArray(to) ? to.join(', ') : to}`, CommentsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurred sending new comment mail to ${Array.isArray(to) ? to.join(', ') : to}`, err, CommentsController.name)
            })
    }

    @EventPattern(KysoEventEnum.COMMENTS_UPDATE)
    async handleCommentsUpdated(event: KysoCommentsUpdateEvent) {
        Logger.log(KysoEventEnum.COMMENTS_UPDATE, CommentsController.name)
        Logger.debug(event, CommentsController.name)

        const { frontendUrl, organization, team, report, user, comment} = event;

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
                    comment
                },
            })
            .then((messageInfo) => {
                Logger.log(`Updated comment mail ${messageInfo.messageId} sent to ${Array.isArray(to) ? to.join(', ') : to}`, CommentsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurred sending updated comment mail to ${Array.isArray(to) ? to.join(', ') : to}`, err, CommentsController.name)
            })
    }

    @EventPattern(KysoEventEnum.COMMENTS_DELETE)
    async handleCommentsDeleted(event: KysoCommentsDeleteEvent) {
        Logger.log(KysoEventEnum.COMMENTS_DELETE, CommentsController.name)
        Logger.debug(event, CommentsController.name)

        const { frontendUrl, organization, team, report, user, comment} = event;

        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        const to = centralizedMails && emails.length > 0 ? emails : user.email

        this.mailerService
            .sendMail({
                to,
                subject: `Deleted a comment in report ${report.title}`,
                template: 'comment-deleted',
                context: {
                    frontendUrl,
                    organization,
                    team,
                    report,
                    comment
                },
            })
            .then((messageInfo) => {
                Logger.log(`Deleted comment mail ${messageInfo.messageId} sent to ${Array.isArray(to) ? to.join(', ') : to}`, CommentsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurred sending deleted comment mail to ${Array.isArray(to) ? to.join(', ') : to}`, err, CommentsController.name)
            })
    }
}
