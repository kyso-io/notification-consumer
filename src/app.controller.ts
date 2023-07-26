import { Controller, Get, Logger } from '@nestjs/common'
import { AppService } from './app.service'
import { MailerService } from '@nestjs-modules/mailer'
import { UtilsService } from './shared/utils.service'

@Controller()
export class AppController {
    constructor(private readonly appService: AppService, private readonly utilsService: UtilsService) {}

    @Get()
    getHello(): string {
        return this.appService.getHello()
    }

    
    @Get("/raw") 
    test() {
        this.utilsService
            .sendRawEmail(
                "francisco@kyso.io",
                'Welcome to Kyso',
                "hola"
            );
    }

    @Get("/html") 
    html() {
        this.utilsService
            .sendHtmlEmail(
                "francisco@kyso.io",
                'Welcome to Kyso',
                "<h1>HOLA GUAPO</h1>"
            );
    }

    @Get("/handlebars")
    handlebars() {
        const context = {
            frontendUrl: "https://dev.kyso.io",
            organization: "jamaica",
            team: "porros",
            report: "Reporte de mi madre",
            comment: "Comentario de mi madre",
        }

        this.utilsService.sendHandlebarsEmail(
            "francisco@kyso.io",
            `New reply to your comment on report`,
            'comment-reply',
            context
        )
    }

}
