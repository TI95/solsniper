import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import SMTPTransport from 'nodemailer/lib/smtp-transport';


dotenv.config();


class MailService {
    private transporter;
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            },
        } as SMTPTransport.Options);
    }

    async sendActivationMail(to: string, activationLink: string): Promise<void> {
        await this.transporter.sendMail({
            from: process.env.SMTP_USER,
            to,
            subject: 'Activation link ' + process.env.API_URL, // тут можно указать адрес сайта
            text: '',
            html:
                `
            <div>
                <h1>Для активации перейдите по ссылке</h1>
                <a href="${activationLink}">${activationLink}</a>
            <div>
                `




        })
    }
}


export default new MailService();