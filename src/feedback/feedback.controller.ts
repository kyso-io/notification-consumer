import { KysoEvent, KysoFeedbackCreateEvent } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Controller, Inject, Logger } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { Db } from 'mongodb'
import { Constants } from '../constants'

@Controller()
export class FeedbackController {
    constructor(
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
        private readonly mailerService: MailerService,
    ) {}

    @EventPattern(KysoEvent.FEEDBACK_CREATE)
    async handleReportsCreate(kysoFeedbackCreateEvent: KysoFeedbackCreateEvent) {
        const { user, feedbackDto, serviceDeskEmail } = kysoFeedbackCreateEvent
        this.mailerService
            .sendMail({
                from: `"${user.username}" <${user.email}>`,
                to: serviceDeskEmail,
                subject: feedbackDto.subject,
                html: feedbackDto.message,
            })
            .then((messageInfo) => {
                Logger.log(`Feedback e-mail ${messageInfo.messageId} from user '${user.id} - ${user.username}' send to ${serviceDeskEmail}`, FeedbackController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurrend sending feedback e-mail from user '${user.id} - ${user.username}' to ${serviceDeskEmail}`, err, FeedbackController.name)
            })
    }
}
