import { KysoCommentsCreateEvent, KysoCommentsDeleteEvent, KysoCommentsUpdateEvent, KysoEventEnum, User } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Controller, Inject, Logger } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { Db } from 'mongodb'
import { SentMessageInfo } from 'nodemailer'
import { Constants } from '../constants'
import { UtilsService } from '../shared/utils.service'

@Controller()
export class CommentsController {
    constructor(
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
        private readonly mailerService: MailerService,
        private readonly utilsService: UtilsService,
    ) {}

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
                    userCreatingAction: kysoCommentsCreateEvent.user,
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
                    await this.utilsService.sleep(200)
                }
            }
        } else {
            const users: User[] = [user]
            if (Array.isArray(report.author_ids) && report.author_ids.length > 0) {
                const authors: User[] = await this.db
                .collection<User>(Constants.DATABASE_COLLECTION_USER)
                .find({ id: { $in: report.author_ids } })
                .toArray()
                for (const author of authors) {
                    const index: number = users.findIndex((u) => u.id === author.id)
                    if (index === -1) {
                        users.push(author)
                    }
                }
            }
            for (const u of users) {
                const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(u.id, 'new_comment_in_report', organization.id, team.id)
                if (sendNotification) {
                    if (report) {
                        this.sendMailNewCommentInReport(kysoCommentsCreateEvent, u.email)
                        await this.utilsService.sleep(200)
                    }
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
                    user,
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

    private async sendMailDeleteCommentInReport(kysoCommentsDeleteEvent: KysoCommentsDeleteEvent, userReceiveEmail: User): Promise<void> {
        try {
            const messageInfo: SentMessageInfo = await this.mailerService.sendMail({
                to: userReceiveEmail.email,
                subject: `Deleted a comment in report ${kysoCommentsDeleteEvent.report.title}`,
                template: 'comment-deleted',
                context: {
                    user: kysoCommentsDeleteEvent.user,
                    frontendUrl: kysoCommentsDeleteEvent.frontendUrl,
                    organization: kysoCommentsDeleteEvent.organization,
                    team: kysoCommentsDeleteEvent.team,
                    report: kysoCommentsDeleteEvent.report,
                    comment: kysoCommentsDeleteEvent.comment,
                },
            })
            Logger.log(`Deleted comment mail ${messageInfo.messageId} sent to ${userReceiveEmail.email}`, CommentsController.name)
        } catch (e) {
            Logger.error(`An error occurred sending deleted comment mail to ${userReceiveEmail.email}`, e, CommentsController.name)
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
                const userReceiveEmail: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ email })
                if (!userReceiveEmail) {
                    continue
                }
                if (report) {
                    await this.sendMailDeleteCommentInReport(kysoCommentsDeleteEvent, userReceiveEmail)
                }
            }
        } else {
            const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(user.id, 'report_comment_removed', organization.id, team.id)
            if (sendNotification) {
                if (report) {
                    this.sendMailDeleteCommentInReport(kysoCommentsDeleteEvent, user)
                }
            }
        }
    }
}
