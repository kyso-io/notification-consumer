import {
    KysoDiscussionsAssigneeEvent,
    KysoDiscussionsCreateEvent,
    KysoDiscussionsDeleteEvent,
    KysoDiscussionsMentionsEvent,
    KysoDiscussionsNewMentionEvent,
    KysoDiscussionsUpdateEvent,
    KysoEvent,
    User,
} from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Controller, Inject, Logger } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { Db } from 'mongodb'
import { Constants } from '../constants'

@Controller()
export class DiscussionsController {
    constructor(
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
        private readonly mailerService: MailerService,
    ) {}

    @EventPattern(KysoEvent.DISCUSSIONS_CREATE)
    async handleDiscussionsCreated(kysoDiscussionsCreateEvent: KysoDiscussionsCreateEvent) {
        const { frontendUrl, organization, team, discussion, user } = kysoDiscussionsCreateEvent

        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        const to = centralizedMails && emails.length > 0 ? emails : user.email

        this.mailerService
            .sendMail({
                to,
                subject: `New discussion ${discussion.title} created`,
                template: 'discussion-new',
                context: {
                    frontendUrl,
                    organization,
                    team,
                    discussion,
                },
            })
            .then((messageInfo) => {
                Logger.log(`Discussion mail ${messageInfo.messageId} sent to ${Array.isArray(to) ? to.join(', ') : to}`, DiscussionsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurred sending discussion mail to ${Array.isArray(to) ? to.join(', ') : to}`, err, DiscussionsController.name)
            })
    }

    @EventPattern(KysoEvent.DISCUSSIONS_UPDATE)
    async handleDiscussionsUpdated(kysoDiscussionsUpdateEvent: KysoDiscussionsUpdateEvent) {}

    @EventPattern(KysoEvent.DISCUSSIONS_DELETE)
    async handleDiscussionsDeleted(kysoDiscussionsDeleteEvent: KysoDiscussionsDeleteEvent) {}

    @EventPattern(KysoEvent.DISCUSSIONS_NEW_ASSIGNEE)
    async handleDiscussionsNewAssignee(kysoDiscussionsAssigneeEvent: KysoDiscussionsAssigneeEvent) {
        const { to, assigneeUser, organization, team, discussion, frontendUrl } = kysoDiscussionsAssigneeEvent
        this.mailerService
            .sendMail({
                to,
                subject: `You were assigned to the discussion ${discussion.title}`,
                template: 'discussion-you-were-added-as-assignee',
                context: {
                    organization,
                    team,
                    discussion,
                    frontendUrl,
                },
            })
            .then((messageInfo) => {
                Logger.log(`Report mail ${messageInfo.messageId} sent to ${assigneeUser.email}`, DiscussionsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurrend sending report mail to ${assigneeUser.email}`, err, DiscussionsController.name)
            })
    }

    @EventPattern(KysoEvent.DISCUSSIONS_REMOVE_ASSIGNEE)
    async handleDiscussionsRemoveAssignee(kysoDiscussionsAssigneeEvent: KysoDiscussionsAssigneeEvent) {
        const { to, assigneeUser, organization, team, discussion, frontendUrl } = kysoDiscussionsAssigneeEvent
        this.mailerService
            .sendMail({
                to,
                subject: `You were unassigned to the discussion ${discussion.title}`,
                template: 'discussion-you-were-removed-as-assignee',
                context: {
                    organization,
                    team,
                    discussion,
                    frontendUrl,
                },
            })
            .then((messageInfo) => {
                Logger.log(`Report mail ${messageInfo.messageId} sent to ${Array.isArray(to) ? to.join(', ') : to}`, DiscussionsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurrend sending report mail to ${Array.isArray(to) ? to.join(', ') : to}`, err, DiscussionsController.name)
            })
    }

    @EventPattern(KysoEvent.DISCUSSIONS_USER_ASSIGNED)
    async handleDiscussionsUserAssigned(kysoDiscussionsAssigneeEvent: KysoDiscussionsAssigneeEvent) {
        const { to, assigneeUser, organization, team, discussion, frontendUrl } = kysoDiscussionsAssigneeEvent
        this.mailerService
            .sendMail({
                to,
                subject: `${assigneeUser.display_name} was assigned to the discussion ${discussion.title}`,
                template: 'discussion-author-new-assignee',
                context: {
                    assignee: assigneeUser,
                    organization,
                    team,
                    discussion,
                    frontendUrl,
                },
            })
            .then((messageInfo) => {
                Logger.log(`Report mail ${messageInfo.messageId} sent to ${Array.isArray(to) ? to.join(', ') : to}`, DiscussionsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurrend sending report mail to ${Array.isArray(to) ? to.join(', ') : to}`, err, DiscussionsController.name)
            })
    }

    @EventPattern(KysoEvent.DISCUSSIONS_USER_UNASSIGNED)
    async handleDiscussionsUserUnassigned(kysoDiscussionsAssigneeEvent: KysoDiscussionsAssigneeEvent) {
        const { to, assigneeUser, organization, team, discussion, frontendUrl } = kysoDiscussionsAssigneeEvent
        this.mailerService
            .sendMail({
                to,
                subject: `${assigneeUser.display_name} was unassigned to the discussion ${discussion.title}`,
                template: 'discussion-author-removed-assignee',
                context: {
                    assignee: assigneeUser,
                    organization,
                    team,
                    discussion,
                    frontendUrl,
                },
            })
            .then((messageInfo) => {
                Logger.log(`Report mail ${messageInfo.messageId} sent to ${Array.isArray(to) ? to.join(', ') : to}`, DiscussionsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurrend sending report mail to ${Array.isArray(to) ? to.join(', ') : to}`, err, DiscussionsController.name)
            })
    }

    @EventPattern(KysoEvent.DISCUSSIONS_NEW_MENTION)
    async handleDiscussionsNewMention(kysoDiscussionsNewMentionEvent: KysoDiscussionsNewMentionEvent) {
        const { user, creator, organization, team, discussion, frontendUrl } = kysoDiscussionsNewMentionEvent
        this.mailerService
            .sendMail({
                to: user.email,
                subject: 'You have been mentioned in a discussion',
                template: 'discussion-mention',
                context: {
                    creator,
                    organization,
                    team,
                    discussion,
                    frontendUrl,
                },
            })
            .then((messageInfo) => {
                Logger.log(`Mention in discussion mail ${messageInfo.messageId} sent to ${user.email}`, DiscussionsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurrend sending mention in discussion mail to ${user.email}`, err, DiscussionsController.name)
            })
    }

    @EventPattern(KysoEvent.DISCUSSIONS_MENTIONS)
    async handleDiscussionsMentions(kysoDiscussionsMentionsEvent: KysoDiscussionsMentionsEvent) {
        const { to, creator, users, organization, team, discussion, frontendUrl } = kysoDiscussionsMentionsEvent
        this.mailerService
            .sendMail({
                to,
                subject: 'Mentions in a discussion',
                template: 'discussion-mentions',
                context: {
                    creator,
                    users: users.map((u: User) => u.display_name).join(','),
                    organization,
                    team,
                    discussion,
                    frontendUrl,
                },
            })
            .then((messageInfo) => {
                Logger.log(`Mention in discussion mail ${messageInfo.messageId} sent to ${Array.isArray(to) ? to.join(', ') : to}`, DiscussionsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurrend sending mention in discussion mail to ${Array.isArray(to) ? to.join(', ') : to}`, err, DiscussionsController.name)
            })
    }
}
