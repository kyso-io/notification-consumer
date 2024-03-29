import {
    InlineComment,
    InlineCommentStatusHistoryDto,
    KysoCommentsCreateEvent,
    KysoCommentsDeleteEvent,
    KysoCommentsUpdateEvent,
    KysoEventEnum,
    KysoSetting,
    KysoSettingsEnum,
    User,
} from '@kyso-io/kyso-model'
import { Controller, Inject, Logger } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { Db } from 'mongodb'
import { Constants } from '../constants'
import { UtilsService } from '../shared/utils.service'

@Controller()
export class InlineCommentsController {
    constructor(@Inject(Constants.DATABASE_CONNECTION) private db: Db, private readonly utilsService: UtilsService) {}

    private async sendMailReplyInlineCommentInReport(kysoCommentsCreateEvent: KysoCommentsCreateEvent, parentInlineComment: InlineComment, userReceiveEmail: User): Promise<void> {
        try {
            await this.utilsService.sendHandlebarsEmail(userReceiveEmail.email, `New task reply in report ${kysoCommentsCreateEvent.report.title}`, 'inline-comment-reply', {
                userCreatingAction: kysoCommentsCreateEvent.user,
                frontendUrl: kysoCommentsCreateEvent.frontendUrl,
                organization: kysoCommentsCreateEvent.organization,
                team: kysoCommentsCreateEvent.team,
                report: kysoCommentsCreateEvent.report,
                comment: kysoCommentsCreateEvent.comment,
                parentInlineComment,
            })
        } catch (e) {
            Logger.error(`An error occurred sending new reply inline comment mail to ${userReceiveEmail.email}`, e, InlineCommentsController.name)
        }
    }

    @EventPattern(KysoEventEnum.INLINE_COMMENTS_REPLY)
    async handleReplyToInlineComment(kysoCommentsCreateEvent: KysoCommentsCreateEvent) {
        Logger.log(KysoEventEnum.INLINE_COMMENTS_REPLY, InlineCommentsController.name)
        Logger.debug(kysoCommentsCreateEvent, InlineCommentsController.name)
        const { organization, report, team, user } = kysoCommentsCreateEvent
        if (!report) {
            Logger.error(`Inline comment ${kysoCommentsCreateEvent.comment.id} is a reply of a inline comment but the report does not exist`, InlineCommentsController.name)
            return
        }
        const inlineComment: InlineComment = kysoCommentsCreateEvent.comment as any
        if (!inlineComment.parent_comment_id) {
            Logger.error(`Inline comment ${inlineComment.id} is a reply of a inline comment but it has no parent_comment_id`, InlineCommentsController.name)
            return
        }
        const parentInlineComment: InlineComment = await this.db.collection<InlineComment>(Constants.DATABASE_COLLECTION_INLINE_COMMENT).findOne({ id: inlineComment.parent_comment_id })
        if (!parentInlineComment) {
            Logger.error(`Inline comment ${inlineComment.id} is a reply of a inline comment but the parent inline comment does not exist`, InlineCommentsController.name)
            return
        }
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        if (centralizedMails && Array.isArray(emails) && emails.length > 0) {
            for (const email of emails) {
                const u: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ email })
                if (u) {
                    await this.sendMailReplyInlineCommentInReport(kysoCommentsCreateEvent, parentInlineComment, u)
                }
            }
        } else {
            const users: User[] = [user]
            const userParentInlineComment: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ id: parentInlineComment.user_id })
            if (!userParentInlineComment) {
                Logger.error(`Inline comment ${inlineComment.id} is a reply of a inline comment but the parent inline comment user does not exist`, InlineCommentsController.name)
                return
            }
            // The user who created the main inline comment
            const index: number = users.findIndex((u: User) => u.id === userParentInlineComment.id)
            if (index === -1) {
                users.push(userParentInlineComment)
            }
            if (report.author_ids.length > 0) {
                // The authors of the report
                const reportAuthors: User[] = await this.db
                    .collection<User>(Constants.DATABASE_COLLECTION_USER)
                    .find({ id: { $in: report.author_ids } })
                    .toArray()
                for (const reportAuthor of reportAuthors) {
                    const index: number = users.findIndex((u: User) => u.id === reportAuthor.id)
                    if (index === -1) {
                        users.push(reportAuthor)
                    }
                }
            }
            for (const u of users) {
                const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(u.id, 'new_task_reply', organization.id, team.id)
                if (sendNotification) {
                    await this.sendMailReplyInlineCommentInReport(kysoCommentsCreateEvent, parentInlineComment, u)
                }
            }
        }
    }

    private async sendMailNewInlineCommentInReport(kysoCommentsCreateEvent: KysoCommentsCreateEvent, userReceiveEmail: User): Promise<void> {
        try {
            await this.utilsService.sendHandlebarsEmail(userReceiveEmail.email, `New task in report ${kysoCommentsCreateEvent.report.title}`, 'inline-comment-new', {
                userCreatingAction: kysoCommentsCreateEvent.user,
                frontendUrl: kysoCommentsCreateEvent.frontendUrl,
                organization: kysoCommentsCreateEvent.organization,
                team: kysoCommentsCreateEvent.team,
                report: kysoCommentsCreateEvent.report,
                comment: kysoCommentsCreateEvent.comment,
            })
        } catch (e) {
            Logger.error(`An error occurred sending new inline comment mail to ${userReceiveEmail.email}`, e, InlineCommentsController.name)
        }
    }

    @EventPattern(KysoEventEnum.INLINE_COMMENTS_CREATE)
    async handleInlineCommentCreated(kysoCommentsCreateEvent: KysoCommentsCreateEvent) {
        Logger.log(KysoEventEnum.INLINE_COMMENTS_CREATE, InlineCommentsController.name)
        Logger.debug(kysoCommentsCreateEvent, InlineCommentsController.name)
        const { organization, team, report, user } = kysoCommentsCreateEvent
        if (!report) {
            Logger.error(`Inline comment ${kysoCommentsCreateEvent.comment.id} of a report that does not exist`, InlineCommentsController.name)
            return
        }
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        if (centralizedMails && Array.isArray(emails) && emails.length > 0) {
            for (const email of emails) {
                const u: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ email })
                if (u) {
                    await this.sendMailNewInlineCommentInReport(kysoCommentsCreateEvent, u)
                }
            }
        } else {
            // The user who created the comment
            const users: User[] = [user]
            if (report.author_ids.length > 0) {
                // The authors of the report
                const reportAuthors: User[] = await this.db
                    .collection<User>(Constants.DATABASE_COLLECTION_USER)
                    .find({ id: { $in: report.author_ids } })
                    .toArray()
                for (const u of reportAuthors) {
                    const index: number = users.findIndex((us: User) => us.id === u.id)
                    if (index === -1) {
                        users.push(u)
                    }
                }
            }
            for (const u of users) {
                const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(u.id, 'new_task', organization.id, team.id)
                if (sendNotification) {
                    this.sendMailNewInlineCommentInReport(kysoCommentsCreateEvent, u)
                }
            }
        }
    }

    private async sendMailInlineCommentUpdated(kysoCommentsUpdateEvent: KysoCommentsUpdateEvent, userReceiveEmail: User): Promise<void> {
        try {
            await this.utilsService.sendHandlebarsEmail(userReceiveEmail.email, `Task edited in report ${kysoCommentsUpdateEvent.report.title}`, 'inline-comment-updated', {
                userCreatingAction: kysoCommentsUpdateEvent.user,
                frontendUrl: kysoCommentsUpdateEvent.frontendUrl,
                organization: kysoCommentsUpdateEvent.organization,
                team: kysoCommentsUpdateEvent.team,
                report: kysoCommentsUpdateEvent.report,
                comment: kysoCommentsUpdateEvent.comment,
            })
        } catch (e) {
            Logger.error(`An error occurred sending inline comment updated mail to ${userReceiveEmail.email}`, e, InlineCommentsController.name)
        }
    }

    private async sendMailInlineCommentStatusChanged(kysoCommentsUpdateEvent: KysoCommentsUpdateEvent, email: string): Promise<void> {
        try {
            const kysoSetting: KysoSetting = await this.db.collection<KysoSetting>(Constants.DATABASE_COLLECTION_KYSO_SETTINGS).findOne({ key: KysoSettingsEnum.KYSO_COMMENT_STATES_VALUES })
            const inlineComment: InlineComment = kysoCommentsUpdateEvent.comment as InlineComment
            const inlineCommentStatusHistoryDto: InlineCommentStatusHistoryDto = inlineComment.status_history[0]
            let statusFrom: string = inlineCommentStatusHistoryDto.from_status as string
            let statusTo: string = inlineCommentStatusHistoryDto.to_status as string
            if (kysoSetting) {
                const value: { labels: { [key: string]: string }; classes: { [key: string]: string } } = kysoSetting.value as any
                if (value.labels[inlineCommentStatusHistoryDto.from_status]) {
                    statusFrom = value.labels[inlineCommentStatusHistoryDto.from_status]
                }
                if (value.labels[inlineCommentStatusHistoryDto.to_status]) {
                    statusTo = value.labels[inlineCommentStatusHistoryDto.to_status]
                }
            }
            await this.utilsService.sendHandlebarsEmail(email, `Task status changed in report ${kysoCommentsUpdateEvent.report.title}`, 'inline-comment-status-changed', {
                frontendUrl: kysoCommentsUpdateEvent.frontendUrl,
                organization: kysoCommentsUpdateEvent.organization,
                team: kysoCommentsUpdateEvent.team,
                report: kysoCommentsUpdateEvent.report,
                comment: inlineComment,
                statusFrom,
                statusTo,
            })
        } catch (e) {
            Logger.error(`An error occurred sending inline comment status changed mail to ${email}`, e, InlineCommentsController.name)
        }
    }

    private async sendMailReplyInlineCommentUpdated(kysoCommentsUpdateEvent: KysoCommentsUpdateEvent, parentInlineComment: InlineComment, userReceiveEmail: User): Promise<void> {
        try {
            await this.utilsService.sendHandlebarsEmail(userReceiveEmail.email, `Task reply edited in report ${kysoCommentsUpdateEvent.report.title}`, 'inline-comment-reply-updated', {
                userCreatingAction: kysoCommentsUpdateEvent.user,
                frontendUrl: kysoCommentsUpdateEvent.frontendUrl,
                organization: kysoCommentsUpdateEvent.organization,
                team: kysoCommentsUpdateEvent.team,
                report: kysoCommentsUpdateEvent.report,
                comment: kysoCommentsUpdateEvent.comment,
                parentInlineComment,
            })
        } catch (e) {
            Logger.error(`An error occurred sending inline comment updated mail to ${userReceiveEmail.email}`, e, InlineCommentsController.name)
        }
    }

    @EventPattern(KysoEventEnum.INLINE_COMMENTS_UPDATE)
    async handleInlineCommentUpdated(kysoCommentsUpdateEvent: KysoCommentsUpdateEvent) {
        Logger.log(KysoEventEnum.INLINE_COMMENTS_UPDATE, InlineCommentsController.name)
        Logger.debug(kysoCommentsUpdateEvent, InlineCommentsController.name)
        const { organization, team, report, comment } = kysoCommentsUpdateEvent
        const inlineComment: InlineComment = comment as any
        if (!report) {
            Logger.error(`Inline comment ${inlineComment.id} of a report that does not exist`, InlineCommentsController.name)
            return
        }
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        if (centralizedMails && Array.isArray(emails) && emails.length > 0) {
            for (const email of emails) {
                const u: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ email })
                if (u) {
                    await this.sendMailInlineCommentUpdated(kysoCommentsUpdateEvent, u)
                }
            }
        } else {
            const users: User[] = []
            const userComment: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ id: inlineComment.user_id })
            if (!userComment) {
                Logger.error(`The user of inline comment ${inlineComment.id} does not exist`, InlineCommentsController.name)
                return
            }
            users.push(userComment)
            if (report.author_ids.length > 0) {
                // The authors of the report
                const reportAuthors: User[] = await this.db
                    .collection<User>(Constants.DATABASE_COLLECTION_USER)
                    .find({ id: { $in: report.author_ids } })
                    .toArray()
                for (const u of reportAuthors) {
                    const index: number = users.findIndex((us: User) => us.id === u.id)
                    if (index === -1) {
                        users.push(u)
                    }
                }
            }
            let parentInlineComment: InlineComment | null = null
            if (inlineComment.parent_comment_id) {
                parentInlineComment = await this.db.collection<InlineComment>(Constants.DATABASE_COLLECTION_INLINE_COMMENT).findOne({ id: inlineComment.parent_comment_id })
                if (!parentInlineComment) {
                    Logger.error(`Inline comment ${inlineComment.id} is a reply of a inline comment but the parent inline comment does not exist`, InlineCommentsController.name)
                    return
                }
                const userComment: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ id: parentInlineComment.user_id })
                if (userComment) {
                    const index: number = users.findIndex((us: User) => us.id === userComment.id)
                    if (index === -1) {
                        users.push(userComment)
                    }
                }
            }
            for (const u of users) {
                if (parentInlineComment) {
                    const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(u.id, 'task_reply_updated', organization.id, team.id)
                    if (sendNotification) {
                        await this.sendMailReplyInlineCommentUpdated(kysoCommentsUpdateEvent, parentInlineComment, u)
                    }
                } else {
                    const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(u.id, 'task_updated', organization.id, team.id)
                    if (sendNotification) {
                        await this.sendMailInlineCommentUpdated(kysoCommentsUpdateEvent, u)
                    }
                }
            }
        }
    }

    @EventPattern(KysoEventEnum.INLINE_COMMENTS_CHANGE_STATUS)
    async handleInlineCommentChangeStatus(kysoCommentsUpdateEvent: KysoCommentsUpdateEvent) {
        Logger.log(KysoEventEnum.INLINE_COMMENTS_CHANGE_STATUS, InlineCommentsController.name)
        Logger.debug(kysoCommentsUpdateEvent, InlineCommentsController.name)
        const { organization, team, report, comment } = kysoCommentsUpdateEvent
        const inlineComment: InlineComment = comment as any
        if (!report) {
            Logger.error(`Inline comment ${inlineComment.id} of a report that does not exist`, InlineCommentsController.name)
            return
        }
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        if (centralizedMails && Array.isArray(emails) && emails.length > 0) {
            for (const email of emails) {
                await this.sendMailInlineCommentStatusChanged(kysoCommentsUpdateEvent, email)
            }
        } else {
            const users: User[] = []
            const userComment: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ id: inlineComment.user_id })
            if (!userComment) {
                Logger.error(`The user of inline comment ${inlineComment.id} does not exist`, InlineCommentsController.name)
                return
            }
            users.push(userComment)
            if (report.author_ids.length > 0) {
                // The authors of the report
                const reportAuthors: User[] = await this.db
                    .collection<User>(Constants.DATABASE_COLLECTION_USER)
                    .find({ id: { $in: report.author_ids } })
                    .toArray()
                for (const u of reportAuthors) {
                    const index: number = users.findIndex((us: User) => us.id === u.id)
                    if (index === -1) {
                        users.push(u)
                    }
                }
            }
            for (const u of users) {
                const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(u.id, 'task_status_changed', organization.id, team.id)
                if (sendNotification) {
                    await this.sendMailInlineCommentStatusChanged(kysoCommentsUpdateEvent, u.email)
                }
            }
        }
    }

    private async sendMailDeleteInlineCommentInReport(kysoCommentsDeleteEvent: KysoCommentsDeleteEvent, email: string): Promise<void> {
        try {
            await this.utilsService.sendHandlebarsEmail(email, `Deleted task in report ${kysoCommentsDeleteEvent.report.title}`, 'inline-comment-deleted', {
                user: kysoCommentsDeleteEvent.user,
                frontendUrl: kysoCommentsDeleteEvent.frontendUrl,
                organization: kysoCommentsDeleteEvent.organization,
                team: kysoCommentsDeleteEvent.team,
                report: kysoCommentsDeleteEvent.report,
                comment: kysoCommentsDeleteEvent.comment,
            })
        } catch (e) {
            Logger.error(`An error occurred sending deleted inline comment mail to ${email}`, e, InlineCommentsController.name)
        }
    }

    private async sendMailDeleteReplyInlineCommentInReport(kysoCommentsDeleteEvent: KysoCommentsDeleteEvent, parentInlineComment: InlineComment, email: string): Promise<void> {
        try {
            await this.utilsService.sendHandlebarsEmail(email, `Deleted task reply in report ${kysoCommentsDeleteEvent.report.title}`, 'inline-comment-reply-deleted', {
                userCreatingAction: kysoCommentsDeleteEvent.user,
                frontendUrl: kysoCommentsDeleteEvent.frontendUrl,
                organization: kysoCommentsDeleteEvent.organization,
                team: kysoCommentsDeleteEvent.team,
                report: kysoCommentsDeleteEvent.report,
                comment: kysoCommentsDeleteEvent.comment,
                parentInlineComment,
            })
        } catch (e) {
            Logger.error(`An error occurred sending deleted inline comment reply mail to ${email}`, e, InlineCommentsController.name)
        }
    }

    @EventPattern(KysoEventEnum.INLINE_COMMENTS_DELETE)
    async handleInlineCommentDeleted(kysoCommentsDeleteEvent: KysoCommentsDeleteEvent) {
        Logger.log(KysoEventEnum.INLINE_COMMENTS_DELETE, InlineCommentsController.name)
        Logger.debug(kysoCommentsDeleteEvent, InlineCommentsController.name)
        const { organization, team, report, comment, user } = kysoCommentsDeleteEvent
        const inlineComment: InlineComment = comment as any
        if (!report) {
            Logger.error(`Inline comment ${inlineComment.id} is a reply of a inline comment but the report does not exist`, InlineCommentsController.name)
            return
        }
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        if (centralizedMails && Array.isArray(emails) && emails.length > 0) {
            for (const email of emails) {
                await this.sendMailDeleteInlineCommentInReport(kysoCommentsDeleteEvent, email)
            }
        } else {
            const users: User[] = []
            const userComment: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ id: inlineComment.user_id })
            if (!userComment) {
                Logger.error(`Inline comment ${inlineComment.id} is a reply of a inline comment but the parent inline comment user does not exist`, InlineCommentsController.name)
                return
            }
            if (report.author_ids.length > 0) {
                // The authors of the report
                const reportAuthors: User[] = await this.db
                    .collection<User>(Constants.DATABASE_COLLECTION_USER)
                    .find({ id: { $in: report.author_ids } })
                    .toArray()
                for (const reportAuthor of reportAuthors) {
                    const index: number = users.findIndex((u: User) => u.id === reportAuthor.id)
                    if (index === -1) {
                        users.push(reportAuthor)
                    }
                }
            }
            let parentInlineComment: InlineComment | null = null
            if (inlineComment.parent_comment_id) {
                parentInlineComment = await this.db.collection<InlineComment>(Constants.DATABASE_COLLECTION_INLINE_COMMENT).findOne({ id: inlineComment.parent_comment_id })
                if (!parentInlineComment) {
                    Logger.error(`Inline comment ${inlineComment.id} is a reply of a inline comment but the parent inline comment does not exist`, InlineCommentsController.name)
                    return
                }
                const parentUserComment: User = await this.db.collection<User>(Constants.DATABASE_COLLECTION_USER).findOne({ id: parentInlineComment.user_id })
                if (parentUserComment) {
                    const index: number = users.findIndex((u: User) => u.id === parentUserComment.id)
                    if (index === -1) {
                        users.push(parentUserComment)
                    }
                }
                if (userComment.id !== user.id) {
                    // The reply owner gets an email if he is not the person who deletes it.
                    const index: number = users.findIndex((u: User) => u.id === userComment.id)
                    if (index === -1) {
                        users.push(userComment)
                    }
                }
            } else {
                users.push(userComment)
            }
            for (const u of users) {
                if (parentInlineComment) {
                    const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(u.id, 'task_reply_removed', organization.id, team.id)
                    if (sendNotification) {
                        await this.sendMailDeleteReplyInlineCommentInReport(kysoCommentsDeleteEvent, parentInlineComment, u.email)
                        await this.utilsService.sleep(2000)
                    }
                } else {
                    const sendNotification: boolean = await this.utilsService.canUserReceiveNotification(u.id, 'task_removed', organization.id, team.id)
                    if (sendNotification) {
                        await this.sendMailDeleteInlineCommentInReport(kysoCommentsDeleteEvent, u.email)
                        await this.utilsService.sleep(2000)
                    }
                }
            }
        }
    }
}
