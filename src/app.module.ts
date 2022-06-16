import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model'
import { MailerModule } from '@nestjs-modules/mailer'
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Db } from 'mongodb'
import { join } from 'path'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { Constants } from './constants'
import { DatabaseModule } from './database/database.module'
import { ReportsModule } from './reports/reports.module'

@Module({
    imports: [
        ConfigModule.forRoot({
            envFilePath: '.env',
            isGlobal: true,
        }),
        MailerModule.forRootAsync({
            imports: [DatabaseModule],
            inject: [Constants.DATABASE_CONNECTION],
            useFactory: async (db: Db) => {
                const mailTransport: KysoSetting | null = (await db.collection(Constants.DATABASE_COLLECTION_KYSO_SETTINGS).findOne({ key: KysoSettingsEnum.MAIL_TRANSPORT })) as any
                const mailFrom: KysoSetting | null = (await db.collection(Constants.DATABASE_COLLECTION_KYSO_SETTINGS).findOne({ key: KysoSettingsEnum.MAIL_FROM })) as any
                return {
                    transport: mailTransport.value,
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
        ReportsModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
