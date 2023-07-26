import { KysoEventEnum, KysoFeedbackCreateEvent } from '@kyso-io/kyso-model'
import { Controller, Inject, Logger } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { Db } from 'mongodb'
import { Constants } from '../constants'
import { UtilsService } from 'src/shared/utils.service'

@Controller()
export class FeedbackController {
    constructor(
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
        private readonly utilsService: UtilsService,
    ) {}

    @EventPattern(KysoEventEnum.FEEDBACK_CREATE)
    async handleReportsCreate(kysoFeedbackCreateEvent: KysoFeedbackCreateEvent) {
        Logger.log(KysoEventEnum.FEEDBACK_CREATE, FeedbackController.name)
        Logger.debug(kysoFeedbackCreateEvent, FeedbackController.name)

        const { user, feedbackDto, serviceDeskEmail } = kysoFeedbackCreateEvent
        this.utilsService.sendHtmlEmail(
                serviceDeskEmail,
                feedbackDto.subject,
                feedbackDto.message,
            )
            .catch((err) => {
                Logger.error(`An error occurrend sending feedback e-mail from user '${user.id} - ${user.username}' to ${serviceDeskEmail}`, err, FeedbackController.name)
            })
    }
}
