import { Controller, Get, Logger } from '@nestjs/common'
import { AppService } from './app.service'
import { MailerService } from '@nestjs-modules/mailer'

@Controller()
export class AppController {
    constructor(private readonly appService: AppService, private readonly mailerService: MailerService) {}

    @Get()
    getHello(): string {
        return this.appService.getHello()
    }

    
    @Get("/test") 
    test() {
        this.mailerService
            .sendMail({
                from: "hello@kyso.io",
                to: "francisco@kyso.io",
                subject: 'Welcome to Kyso',
                text : "hola"
            })
            .then(() => {
                Logger.log(`Email sent`)
            })
            .catch((err) => {
                Logger.error(`Error sending mail`, err)
            })
    }
}
