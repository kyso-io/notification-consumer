import { UserNotificationsSettings, KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { Db } from 'mongodb'
import { Constants } from '../constants'
import { MailerService } from '@nestjs-modules/mailer';
import { SentMessageInfo } from 'nodemailer';
import * as AWS from 'aws-sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as handlebars from 'handlebars';
@Injectable()
export class UtilsService {
    constructor(
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
        private readonly mailerService: MailerService
    ) {}

    public static configuredEmailProvider: string = "smtp";
    private static AWS_SES: any = null;
    private mailFrom: string = null;

    public static configureSES(mailConfig: any) {
        UtilsService.AWS_SES = new AWS.SES({
            region: mailConfig.vendor.payload.region,
            accessKeyId: mailConfig.vendor.payload.accessKeyId,
            secretAccessKey: mailConfig.vendor.payload.secretAccessKey
        });
    }

    public async getMailFrom(): Promise<string> {
        try {
            if(!this.mailFrom) {
                const dbValue: KysoSetting | null = (await this.db.collection(Constants.DATABASE_COLLECTION_KYSO_SETTINGS).findOne({ key: KysoSettingsEnum.MAIL_FROM })) as any;
                this.mailFrom = dbValue.value;

                return this.mailFrom;
            } else {
                return this.mailFrom;
            }
        } catch(ex) {
            Logger.error("Error getting mail from", ex);
            return "noreply@dev.kyso.io";
        }
    }


    public async sendRawEmail(to: string, subject: string, text: string) {
        switch(UtilsService.configuredEmailProvider.toLowerCase()) {
            case "smtp":
                const messageInfo: SentMessageInfo = await this.mailerService.sendMail({
                    from: await this.getMailFrom(),
                    to: to,
                    subject: subject,
                    text: text
                })
    
                Logger.log(`Message id ${messageInfo.messageId} sent to ${to}`);
                break;
            case "aws-ses": 
                const params = {
                    Destination: {
                        CcAddresses: [],
                        ToAddresses: [to]
                    },
                    Message: {
                        Body: {
                            Text: {
                                Charset: "UTF-8",
                                Data: text
                            }
                        },
                        Subject: {
                            Charset: "UTF-8",
                            Data: subject
                        }
                    },
                    Source: await this.getMailFrom(),
                    ReplyToAddresses: [await this.getMailFrom()]
                }
                
                UtilsService.AWS_SES.sendEmail(params).promise()
                    .then((messageInfo) => {Logger.log(`Message id ${messageInfo.MessageId} sent to ${to}`);})
                    .catch((err) => {Logger.error(`Error sending email to ${to}`, err);})
                break;
            default:
                Logger.error(`Configured email provider ${UtilsService.configuredEmailProvider} not supported`);
                break;

        }
    }

    public async sendHtmlEmail(to: string, subject: string, html: string) {
        switch(UtilsService.configuredEmailProvider.toLowerCase()) {
            case "smtp":
                const messageInfo: SentMessageInfo = await this.mailerService.sendMail({
                    from: await this.getMailFrom(),
                    to: to,
                    subject: subject,
                    html: html
                })
    
                Logger.log(`Message id ${messageInfo.messageId} sent to ${to}`);
                break;
            case "aws-ses": 
                const params = {
                    Destination: {
                        CcAddresses: [],
                        ToAddresses: [to]
                    },
                    Message: {
                        Body: {
                            Html: {
                                Charset: "UTF-8",
                                Data: html
                            }
                        },
                        Subject: {
                            Charset: "UTF-8",
                            Data: subject
                        }
                    },
                    Source: await this.getMailFrom(),
                    ReplyToAddresses: [await this.getMailFrom()]
                }
                
                console.log(params);

                UtilsService.AWS_SES.sendEmail(params).promise()
                    .then((messageInfo) => {Logger.log(`Message id ${messageInfo.MessageId} sent to ${to}`);})
                    .catch((err) => {Logger.error(`Error sending email to ${to}`, err);})
                break;
            default:
                Logger.error(`Configured email provider ${UtilsService.configuredEmailProvider} not supported`);
                break;
        }
    }

    public async sendHandlebarsEmail(to: string, subject: string, template: string, context: any) {
        const templateSource = readFileSync(join(__dirname, `../../templates/${template}.hbs`)).toString();

        const compiledTemplate = handlebars.compile(templateSource);
        const outputString = compiledTemplate(context);
        
        this.sendHtmlEmail( to, subject, outputString);
    }

    public static getDisplayTextByChannelRoleName(role: string): string {
        if (!role) {
            return ''
        }

        switch (role.toLowerCase()) {
            case 'team-admin':
                return `Full access all channels - Can administer this channel's settings`
            case 'team-contributor':
                return `Can edit all channels - Can create content within this channel`
            case 'team-reader':
                return 'Can comment all channels - Can read, create comments & tasks on reports in this channel'
            default:
                return ''
        }
    }

    public static getDisplayTextByOrganizationRoleName(role: string): string {
        if (!role) {
            return ''
        }

        switch (role.toLowerCase()) {
            case 'organization-admin':
                return 'Admin of this organization - Full control of everything in the organization'
            case 'team-admin':
                return `Full access all channels - Can administer all channels within this organization`
            case 'team-contributor':
                return `Can edit all channels - Can create content within this organization`
            case 'team-reader':
                return 'Can comment all channels - Can read, create comments & tasks on reports in this organization'
            default:
                return ''
        }
    }

    public async canUserReceiveNotification(user_id: string, key: string, organization_id?: string, channel_id?: string): Promise<boolean> {
        const uns: UserNotificationsSettings = await this.db.collection<UserNotificationsSettings>(Constants.DATABASE_COLLECTION_USER_NOTIFICATIONS_SETTINGS).findOne({ user_id })
        if (!uns) {
            return false
        }
        if (organization_id && channel_id) {
            return this.isEventEnabledInChannel(uns, organization_id, channel_id, key)
        } else if (organization_id) {
            return this.isEventEnabledInOrganization(uns, organization_id, key)
        } else {
            return this.isEventEnabledGlobally(uns, key)
        }
    }

    private isEventEnabledInChannel(uns: UserNotificationsSettings, organization_id: string, team_id: string, key: string): boolean {
        if (uns.channels_settings.hasOwnProperty(organization_id)) {
            if (uns.channels_settings[organization_id].hasOwnProperty(team_id)) {
                if (uns.channels_settings[organization_id][team_id].hasOwnProperty(key)) {
                    return uns.channels_settings[organization_id][team_id][key]
                } else {
                    return false
                }
            }
        }
        return this.isEventEnabledInOrganization(uns, organization_id, key)
    }

    private isEventEnabledInOrganization(uns: UserNotificationsSettings, organization_id: string, key: string): boolean {
        if (uns.organization_settings.hasOwnProperty(organization_id)) {
            if (uns.organization_settings[organization_id].hasOwnProperty(key)) {
                return uns.organization_settings[organization_id][key]
            } else {
                return false
            }
        }
        return this.isEventEnabledGlobally(uns, key)
    }

    private isEventEnabledGlobally(uns: UserNotificationsSettings, key: string): boolean {
        if (uns.global_settings.hasOwnProperty(key)) {
            return uns.global_settings[key]
        }
        return false
    }

    public sleep(milliseconds: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, milliseconds))
    }
}
