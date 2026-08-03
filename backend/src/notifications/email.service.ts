import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface TransactionReceiptDetails {
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER_OUT' | 'TRANSFER_IN';
  amount: string;
  currency: string;
  balanceAfter: string;
  accountNumber: string;
  description: string | null;
  counterpartyAccountNumber?: string;
}

const LABELS: Record<TransactionReceiptDetails['type'], string> = {
  CREDIT: 'Depósito',
  DEBIT: 'Retiro',
  TRANSFER_OUT: 'Transferencia enviada',
  TRANSFER_IN: 'Transferencia recibida',
};

/**
 * Envía el comprobante de una transacción por correo. Igual que
 * RedisService, está diseñado para degradar sin romper la app: si no hay
 * credenciales SMTP configuradas (o el envío falla), se loguea una
 * advertencia y la transacción se confirma igual — el correo es una
 * notificación, nunca debe poder tumbar una operación bancaria real.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress = 'QikBanco <no-reply@qikbanco.local>';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const from = this.configService.get<string>('SMTP_FROM');

    if (from) {
      this.fromAddress = from;
    }

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP_HOST/SMTP_USER/SMTP_PASS no configurados: los correos de confirmación ' +
          'se van a loguear en vez de enviarse. Ver .env.example para configurarlos.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: this.configService.get<number>('SMTP_PORT', 587),
      // true solo para el puerto 465 (SMTPS); 587/25 usan STARTTLS.
      secure: this.configService.get<number>('SMTP_PORT', 587) === 465,
      auth: { user, pass },
    });
  }

  async sendTransactionReceipt(
    to: string,
    details: TransactionReceiptDetails,
  ): Promise<void> {
    const subject = `${LABELS[details.type]} de ${details.currency} ${details.amount} en tu cuenta QikBanco`;
    const text = this.buildTextBody(details);
    const html = this.buildHtmlBody(details);

    if (!this.transporter) {
      this.logger.log(
        `[correo simulado, SMTP no configurado] Para: ${to} | Asunto: ${subject}\n${text}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        text,
        html,
      });
    } catch (error) {
      // No relanzamos: un correo fallido no debe hacer fallar la mutación
      // GraphQL que ya confirmó la transacción en la base de datos.
      this.logger.warn(
        `No se pudo enviar el correo de confirmación a ${to}: ${(error as Error).message}`,
      );
    }
  }

  private buildTextBody(details: TransactionReceiptDetails): string {
    const lines = [
      `${LABELS[details.type]}`,
      `Monto: ${details.currency} ${details.amount}`,
      `Cuenta: •••• ${details.accountNumber.slice(-4)}`,
      `Balance actual: ${details.currency} ${details.balanceAfter}`,
    ];
    if (details.counterpartyAccountNumber) {
      lines.push(
        `Cuenta relacionada: •••• ${details.counterpartyAccountNumber.slice(-4)}`,
      );
    }
    if (details.description) {
      lines.push(`Descripción: ${details.description}`);
    }
    lines.push(
      '',
      'Si no reconoces este movimiento, contacta soporte de inmediato.',
    );
    return lines.join('\n');
  }

  private buildHtmlBody(details: TransactionReceiptDetails): string {
    const rows = [
      ['Monto', `${details.currency} ${details.amount}`],
      ['Cuenta', `•••• ${details.accountNumber.slice(-4)}`],
      ['Balance actual', `${details.currency} ${details.balanceAfter}`],
    ];
    if (details.counterpartyAccountNumber) {
      rows.push([
        'Cuenta relacionada',
        `•••• ${details.counterpartyAccountNumber.slice(-4)}`,
      ]);
    }
    if (details.description) {
      rows.push(['Descripción', details.description]);
    }

    const rowsHtml = rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:6px 12px;color:#6B7280;">${label}</td><td style="padding:6px 12px;font-weight:600;">${value}</td></tr>`,
      )
      .join('');

    return `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#0F62FE;">${LABELS[details.type]}</h2>
        <table style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
        <p style="color:#6B7280;font-size:13px;margin-top:24px;">
          Si no reconoces este movimiento, contacta soporte de inmediato.
        </p>
      </div>
    `;
  }
}
