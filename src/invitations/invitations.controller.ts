import { KysoEventEnum, KysoInvitationsTeamCreateEvent } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Controller, Inject, Logger } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { Db } from 'mongodb'
import { Constants } from '../constants'
import { UtilsService } from 'src/shared/utils.service'

@Controller()
export class InvitationsController {
    constructor(
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
        private readonly mailerService: MailerService,
        private readonly utilsService: UtilsService
    ) {}

    @EventPattern(KysoEventEnum.INVITATIONS_TEAM_CREATE)
    async handleDiscussionsCreated(kysoInvitationsTeamCreateEvent: KysoInvitationsTeamCreateEvent) {
        Logger.log(KysoEventEnum.INVITATIONS_TEAM_CREATE, InvitationsController.name)
        Logger.debug(kysoInvitationsTeamCreateEvent, InvitationsController.name)

        const { user, roles, organization, team, invitation, frontendUrl } = kysoInvitationsTeamCreateEvent
        this.mailerService
            .sendMail({
                from: await this.utilsService.getMailFrom(),
                to: invitation.email,
                subject: `Kyso: New invitation to join into channel ${team.sluglified_name}`,
                template: 'invitation-team',
                context: {
                    user,
                    roles: roles.map((role: string) => UtilsService.getDisplayTextByChannelRoleName(role)).join(", "),
                    frontendUrl,
                    organization,
                    team,
                    invitation,
                },
            })
            .then((messageInfo) => {
                Logger.log(`Invitation mail ${messageInfo.messageId} sent to ${invitation.email}`, InvitationsController.name)
            })
            .catch((err) => {
                Logger.error(`An error occurrend sending invitation welcome mail to ${invitation.email}`, err, InvitationsController.name)
            })
    }
}
