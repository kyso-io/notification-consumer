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
import { DiscussionsModule } from './discussions/discussions.module'
import { FeedbackModule } from './feedback/feedback.module'
import { InlineCommentsModule } from './inline-comments/inline-comments.module'
import { InvitationsModule } from './invitations/invitations.module'
import { OrganizationsModule } from './organizations/organizations.module'
import { ReportsModule } from './reports/reports.module'
import { TeamsModule } from './teams/teams.module'
import { UsersModule } from './users/users.module'
import * as AWS from 'aws-sdk';

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
        DiscussionsModule,
        FeedbackModule,
        InlineCommentsModule,
        InvitationsModule,
        MailerModule.forRootAsync({
            imports: [DatabaseModule],
            inject: [Constants.DATABASE_CONNECTION],
            useFactory: async (db: Db) => {
                const mailTransport: KysoSetting | null = (await db.collection(Constants.DATABASE_COLLECTION_KYSO_SETTINGS).findOne({ key: KysoSettingsEnum.MAIL_TRANSPORT })) as any
                const mailFrom: KysoSetting | null = (await db.collection(Constants.DATABASE_COLLECTION_KYSO_SETTINGS).findOne({ key: KysoSettingsEnum.MAIL_FROM })) as any              
                
                const mailConfig: any = mailTransport.value as any;
                
                const finalMailTransport = {
                    ...mailConfig.transport
                }

                if(mailConfig.vendor && mailConfig.vendor.type) {
                    Logger.log(`Received mail vendor ${mailConfig.vendor.type}`);
                    
                    console.log(mailConfig.vendor.payload);

                    switch(mailConfig.vendor.type.toLowerCase()) {
                        case "aws-ses":
                            finalMailTransport["SES"] = new AWS.SES(JSON.parse(mailConfig.vendor.payload))
                            break;
                        default:
                            break;
                    }
                }


                return {
                    transport: finalMailTransport,
                    defaults: {
                        from: mailFrom.value,
                    },
                    template: {
                        dir: join(__dirname, '../templates'),
                        adapter: new HandlebarsAdapter(),
                        options: {
                            strict: true,
                        },
                    },
                }
            },
        }),
        OrganizationsModule,
        ReportsModule,
        TeamsModule,
        UsersModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
