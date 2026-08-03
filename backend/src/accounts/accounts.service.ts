import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account, AccountType } from './entities/account.entity';

/** Genera un número de cuenta numérico de 10 dígitos, con reintento en caso de colisión. */
function generateAccountNumber(): string {
  let number = '';
  for (let i = 0; i < 10; i++) {
    number += Math.floor(Math.random() * 10).toString();
  }
  return number;
}

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
  ) {}

  async createAccount(
    ownerId: string,
    params: { type?: AccountType; currency?: string },
  ): Promise<Account> {
    let accountNumber = generateAccountNumber();
    let attempts = 0;

    // Colisión de 10 dígitos aleatorios es extremadamente improbable, pero
    // se maneja explícitamente en vez de asumir que "nunca pasa".
    while (await this.accountsRepository.exists({ where: { accountNumber } })) {
      attempts += 1;
      if (attempts > 5) {
        throw new Error('No se pudo generar un número de cuenta único');
      }
      accountNumber = generateAccountNumber();
    }

    const account = this.accountsRepository.create({
      accountNumber,
      ownerId,
      type: params.type ?? AccountType.CHECKING,
      currency: params.currency ?? 'USD',
      balance: '0.00',
    });

    return this.accountsRepository.save(account);
  }

  async listByOwner(ownerId: string): Promise<Account[]> {
    return this.accountsRepository.find({
      where: { ownerId },
      order: { createdAt: 'ASC' },
    });
  }

  /** Devuelve la cuenta si existe y pertenece al usuario; lanza si no. */
  async getOwnedAccount(ownerId: string, accountId: string): Promise<Account> {
    const account = await this.accountsRepository.findOne({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Cuenta no encontrada');
    }

    if (account.ownerId !== ownerId) {
      // 403, no 404: no queremos exponer si la cuenta existe pero es de
      // otro usuario mediante mensajes distintos por timing, así que en un
      // sistema real esto se evaluaría junto a un rate limit; para esta
      // prueba basta con no permitir el acceso.
      throw new ForbiddenException('No tienes acceso a esta cuenta');
    }

    return account;
  }

  /**
   * Busca una cuenta por número sin exigir que pertenezca al usuario que
   * llama — se usa para validar el destino de una transferencia antes de
   * intentarla (no expone a quién pertenece, solo si existe).
   */
  async findByAccountNumber(accountNumber: string): Promise<Account | null> {
    return this.accountsRepository.findOne({ where: { accountNumber } });
  }
}
