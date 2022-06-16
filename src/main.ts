import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestApplication, NestFactory } from '@nestjs/core'
import { Transport } from '@nestjs/microservices'
import { NestExpressApplication } from '@nestjs/platform-express'
import { Db } from 'mongodb'
import { AppModule } from './app.module'
import { Constants } from './constants'

async function bootstrap() {
    const app: NestExpressApplication = await NestFactory.create(AppModule)
    const configService: ConfigService = app.get<ConfigService>(ConfigService)
    const db: Db = app.get(Constants.DATABASE_CONNECTION)
    const kysoSetting: KysoSetting | null = (await db.collection(Constants.DATABASE_COLLECTION_KYSO_SETTINGS).findOne({ key: KysoSettingsEnum.KYSO_NATS_URL })) as any
    if (!kysoSetting) {
        Logger.error('KYSO_NATS_URL not found in database')
        process.exit(1)
    }
    app.connectMicroservice(
        {
            transport: Transport.NATS,
            options: {
                servers: [kysoSetting.value],
            },
        },
        { inheritAppConfig: true },
    )
    await app.startAllMicroservices()
    const port: number = parseInt(configService.get<string>('PORT'), 10)
    await app.listen(port, () => {
        Logger.log(`App listening on port ${port}`, NestApplication.name)
    })
}

bootstrap()
