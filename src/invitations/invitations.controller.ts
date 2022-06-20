import { KysoEvent, KysoInvitationsTeamCreateEvent } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Controller, Inject, Logger } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { Db } from 'mongodb'
import { Constants } from '../constants'

@Controller()
export class InvitationsController {
    constructor(
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
        private readonly mailerService: MailerService,
    ) {}

    @EventPattern(KysoEvent.INVITATIONS_TEAM_CREATE)
    async handleDiscussionsCreated(kysoInvitationsTeamCreateEvent: KysoInvitationsTeamCreateEvent) {
        const { user, roles, organization, team, invitation, frontendUrl } = kysoInvitationsTeamCreateEvent
        this.mailerService
            .sendMail({
                to: invitation.email,
                subject: `Kyso: New invitation to join team ${team.sluglified_name}`,
                template: 'invitation-team',
                context: {
                    user,
                    roles: roles.map((role: string) => role.replace('-', ' ')),
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
