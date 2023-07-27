import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model'
import { MailerModule } from '@nestjs-modules/mailer'
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter'
import { Logger, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Db } from 'mongodb'
import { join } from 'path'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { CommentsModule } from './comments/comments.module'
import { Constants } from './constants'
import { DatabaseModule } from './database/database.module'
import { FeedbackModule } from './feedback/feedback.module'
import { InlineCommentsModule } from './inline-comments/inline-comments.module'
import { InvitationsModule } from './invitations/invitations.module'
import { OrganizationsModule } from './organizations/organizations.module'
import { ReportsModule } from './reports/reports.module'
import { TeamsModule } from './teams/teams.module'
import { UsersModule } from './users/users.module'
import * as AWS from 'aws-sdk';
import { UtilsService } from './shared/utils.service'
import { SharedModule } from './shared/shared.module'

let envFilePath = '.env'
if (process.env.DOTENV_FILE) {
    envFilePath = process.env.DOTENV_FILE
}

@Module({
    imports: [
        CommentsModule,
        ConfigModule.forRoot({
            envFilePath: envFilePath,
            isGlobal: true,
        }),
        FeedbackModule,
        InlineCommentsModule,
        InvitationsModule,
        MailerModule.forRootAsync({
            imports: [DatabaseModule],
            inject: [Constants.DATABASE_CONNECTION],
            useFactory: async (db: Db) => {
                const mailTransport: KysoSetting | null = (await db.collection(Constants.DATABASE_COLLECTION_KYSO_SETTINGS).findOne({ key: KysoSettingsEnum.MAIL_TRANSPORT })) as any;              
const mailConfig: any = mailTransport.value as any;
                
                let finalMailTransport = {
                    ...mailConfig.transport
                }

                try {
                    finalMailTransport = `smtps://${mailConfig.transport.auth.user}:${mailConfig.transport.auth.pass}@${mailConfig.transport.host}:${mailConfig.transport.port}`;
                } catch(e) {
                    Logger.warn(`Cant form smtps string`, e)
                }
                
                if(mailConfig.vendor && mailConfig.vendor.type) {
                    Logger.log(`Received mail vendor ${mailConfig.vendor.type}`);
                    UtilsService.configuredEmailProvider = mailConfig.vendor.type;

                    switch(mailConfig.vendor.type.toLowerCase()) {
                        case "aws-ses":
                            UtilsService.configureSES(mailConfig);

                            finalMailTransport = {
                                SES: new AWS.SES({
                                    region: mailConfig.vendor.payload.region,
                                    accessKeyId: mailConfig.vendor.payload.accessKeyId,
                                    secretAccessKey: mailConfig.vendor.payload.secretAccessKey
                                }),
                            }
                            break;
                        default:
                            break;
                    }
                } else {
                    UtilsService.configuredEmailProvider = "smtp";
                }

                const finalObject = {
                    transport: finalMailTransport
                }

                return finalObject;
            },
        }),
        OrganizationsModule,
        ReportsModule,
        TeamsModule,
        UsersModule,
        SharedModule
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
