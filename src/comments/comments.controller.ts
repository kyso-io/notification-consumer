import { Comment, KysoCommentsCreateEvent, KysoCommentsDeleteEvent, KysoCommentsUpdateEvent, KysoEventEnum, User } from '@kyso-io/kyso-model'
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
        private readonly utilsService: UtilsService,
    ) {}

    private async sendMailReplyCommentInReport(kysoCommentsCreateEvent: KysoCommentsCreateEvent, email: string): Promise<void> {
        try {
            const messageInfo: SentMessageInfo = await this.utilsService.sendHandlebarsEmail(email, `New reply on report ${kysoCommentsCreateEvent.report.title}`, 'comment-reply', {
                frontendUrl: kysoCommentsCreateEvent.frontendUrl,
                organization: kysoCommentsCreateEvent.organization,
                team: kysoCommentsCreateEvent.team,
                report: kysoCommentsCreateEvent.report,
                comment: kysoCommentsCreateEvent.comment,
                user: kysoCommentsCreateEvent.user,
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
        const { organization, user, report, team, comment } = kysoCommentsCreateEvent
        if (!comment.comment_id) {
            Logger.error(`Comment ${comment.id} does not have a comment_id`, CommentsController.name)
            return
        }
        const parentComment: Comment = await this.db.collection<Comment>(Constants.DATABASE_COLLECTION_COMMENT).findOne({ id: comment.comment_id })
        if (!parentComment) {
            Logger.error(`Comment ${comment.id} does not have a parent comment`, CommentsController.name)
            return
        }
        const parentCommentUser: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ id: parentComment.user_id })
        if (!parentCommentUser) {
            Logger.error(`User of parent comment ${parentComment.id} not found`, CommentsController.name)
            return
        }
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        if (centralizedMails && Array.isArray(emails) && emails.length > 0) {
            for (const email of emails) {
                if (report) {
                    await this.sendMailReplyCommentInReport(kysoCommentsCreateEvent, email)
                }
            }
        } else {
            const users: User[] = [parentCommentUser]
            if (parentCommentUser.id !== user.id) {
                users.push(user)
            }
            if (Array.isArray(report.author_ids) && report.author_ids.length > 0) {
                const authors: User[] = await this.db
                    .collection<User>(Constants.DATABASE_COLLECTION_USER)
                    .find({ id: { $in: report.author_ids } })
                    .toArray()
                for (const author of authors) {
                    const index: number = users.findIndex((u: User) => u.id === author.id)
                    if (index === -1) {
                        users.push(author)
                    }
                }
            }
            for (const u of users) {
                const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(u.id, 'replay_comment_in_report', organization.id, team.id)
                if (sendNotification) {
                    if (report) {
                        await this.sendMailReplyCommentInReport(kysoCommentsCreateEvent, u.email)
                    }
                }
            }
        }
    }

    private async sendMailNewCommentInReport(kysoCommentsCreateEvent: KysoCommentsCreateEvent, email: string): Promise<void> {
        try {
            await this.utilsService.sendHandlebarsEmail(email, `New comment in report ${kysoCommentsCreateEvent.report.title}`, 'comment-new', {
                userCreatingAction: kysoCommentsCreateEvent.user,
                frontendUrl: kysoCommentsCreateEvent.frontendUrl,
                organization: kysoCommentsCreateEvent.organization,
                team: kysoCommentsCreateEvent.team,
                report: kysoCommentsCreateEvent.report,
                comment: kysoCommentsCreateEvent.comment,
            })
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
                    await this.utilsService.sleep(2000)
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
                    const index: number = users.findIndex((u: User) => u.id === author.id)
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
                        await this.utilsService.sleep(2000)
                    }
                }
            }
        }
    }

    private async sendMailCommentUpdatedInReport(kysoCommentsUpdateEvent: KysoCommentsUpdateEvent, email: string): Promise<void> {
        try {
            await this.utilsService.sendHandlebarsEmail(email, `Comment edited in report ${kysoCommentsUpdateEvent.report.title}`, 'comment-updated', {
                user: kysoCommentsUpdateEvent.user,
                frontendUrl: kysoCommentsUpdateEvent.frontendUrl,
                organization: kysoCommentsUpdateEvent.organization,
                team: kysoCommentsUpdateEvent.team,
                report: kysoCommentsUpdateEvent.report,
                comment: kysoCommentsUpdateEvent.comment,
            })
        } catch (e) {
            Logger.error(`An error occurred sending updated comment mail to ${email}`, e, CommentsController.name)
        }
    }

    @EventPattern(KysoEventEnum.COMMENTS_UPDATE)
    async handleCommentsUpdated(kysoCommentsUpdateEvent: KysoCommentsUpdateEvent) {
        Logger.log(KysoEventEnum.COMMENTS_UPDATE, CommentsController.name)
        Logger.debug(kysoCommentsUpdateEvent, CommentsController.name)
        const { organization, team, report, user } = kysoCommentsUpdateEvent
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        if (centralizedMails && Array.isArray(emails) && emails.length > 0) {
            for (const email of emails) {
                if (report) {
                    await this.sendMailCommentUpdatedInReport(kysoCommentsUpdateEvent, email)
                    await this.utilsService.sleep(2000)
                }
            }
        } else {
            const users: User[] = []
            if (Array.isArray(report.author_ids) && report.author_ids.length > 0) {
                const authors: User[] = await this.db
                    .collection<User>(Constants.DATABASE_COLLECTION_USER)
                    .find({ id: { $in: report.author_ids } })
                    .toArray()
                for (const author of authors) {
                    const index: number = users.findIndex((u: User) => u.id === author.id)
                    if (index === -1 && author.id !== user.id) {
                        users.push(author)
                    }
                }
            }
            for (const u of users) {
                const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(u.id, 'new_comment_in_report', organization.id, team.id)
                if (sendNotification) {
                    if (report) {
                        this.sendMailCommentUpdatedInReport(kysoCommentsUpdateEvent, u.email)
                        await this.utilsService.sleep(2000)
                    }
                }
            }
        }
    }

    private async sendMailDeleteCommentInReport(kysoCommentsDeleteEvent: KysoCommentsDeleteEvent, userReceiveEmail: User): Promise<void> {
        try {
            await this.utilsService.sendHandlebarsEmail(userReceiveEmail.email, `Deleted a comment in report ${kysoCommentsDeleteEvent.report.title}`, 'comment-deleted', {
                user: kysoCommentsDeleteEvent.user,
                frontendUrl: kysoCommentsDeleteEvent.frontendUrl,
                organization: kysoCommentsDeleteEvent.organization,
                team: kysoCommentsDeleteEvent.team,
                report: kysoCommentsDeleteEvent.report,
                comment: kysoCommentsDeleteEvent.comment,
            })
        } catch (e) {
            Logger.error(`An error occurred sending deleted comment mail to ${userReceiveEmail.email}`, e, CommentsController.name)
        }
    }

    @EventPattern(KysoEventEnum.COMMENTS_DELETE)
    async handleCommentsDeleted(kysoCommentsDeleteEvent: KysoCommentsDeleteEvent) {
        Logger.log(KysoEventEnum.COMMENTS_DELETE, CommentsController.name)
        Logger.debug(kysoCommentsDeleteEvent, CommentsController.name)
        const { organization, team, report, user, comment } = kysoCommentsDeleteEvent
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
            const users: User[] = [user]
            const parentComment: Comment = await this.db.collection<Comment>(Constants.DATABASE_COLLECTION_COMMENT).findOne({ id: comment.comment_id })
            if (parentComment) {
                const parentCommentUser: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ id: parentComment.user_id })
                if (parentCommentUser) {
                    const index: number = users.findIndex((u: User) => u.id === parentCommentUser.id)
                    if (index === -1) {
                        users.push(parentCommentUser)
                    }
                }
            }
            if (Array.isArray(report.author_ids) && report.author_ids.length > 0) {
                const authors: User[] = await this.db
                    .collection<User>(Constants.DATABASE_COLLECTION_USER)
                    .find({ id: { $in: report.author_ids } })
                    .toArray()
                for (const author of authors) {
                    const index: number = users.findIndex((u: User) => u.id === author.id)
                    if (index === -1) {
                        users.push(author)
                    }
                }
            }
            for (const u of users) {
                const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(u.id, 'report_comment_removed', organization.id, team.id)
                if (sendNotification) {
                    if (report) {
                        this.sendMailDeleteCommentInReport(kysoCommentsDeleteEvent, u)
                        await this.utilsService.sleep(2000)
                    }
                }
            }
        }
    }
}
