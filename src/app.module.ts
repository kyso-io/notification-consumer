import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model'
import { MailerModule } from '@nestjs-modules/mailer'
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Db, Logger } from 'mongodb'
import { join } from 'path'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { CommentsModule } from './comments/comments.module'
import { Constants } from './constants'
import { DatabaseModule } from './database/database.module'
import { DiscussionsModule } from './discussions/discussions.module'
import { FeedbackModule } from './feedback/feedback.module'
import { InvitationsModule } from './invitations/invitations.module'
import { OrganizationsModule } from './organizations/organizations.module'
import { ReportsModule } from './reports/reports.module'
import { TeamsModule } from './teams/teams.module'
import { UsersModule } from './users/users.module'
import { InlineCommentsModule } from './inline-comments/inline-comments.module'

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
                const mailUser: KysoSetting | null = (await db.collection(Constants.DATABASE_COLLECTION_KYSO_SETTINGS).findOne({ key: KysoSettingsEnum.MAIL_USER })) as any
                const mailPassword: KysoSetting | null = (await db.collection(Constants.DATABASE_COLLECTION_KYSO_SETTINGS).findOne({ key: KysoSettingsEnum.MAIL_PASSWORD })) as any
                const mailPort: KysoSetting | null = (await db.collection(Constants.DATABASE_COLLECTION_KYSO_SETTINGS).findOne({ key: KysoSettingsEnum.MAIL_PORT })) as any

                return {
                    transport: {
                        host: mailTransport.value,
                        port: +mailPort.value,
                        secure: false,
                        ignoreTLS: true, 
                        requireTLS: false,
                        auth: {
                            user: mailUser.value, 
                            pass: mailPassword.value                            
                        },
                        debug: true
                    },
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
