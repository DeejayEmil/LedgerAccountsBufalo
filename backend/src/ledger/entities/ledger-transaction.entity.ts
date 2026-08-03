import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';

export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

/**
 * Entrada inmutable del libro mayor (ledger). Nunca se actualiza ni se
 * borra una vez creada: el balance de la cuenta se deriva de aplicar
 * secuencialmente estas entradas, y `balanceAfter` queda congelado como
 * snapshot para auditar el histórico sin tener que recalcular.
 */
@Entity('ledger_transactions')
export class LedgerTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Account, (account) => account.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Index()
  @Column({ name: 'account_id' })
  accountId: string;

  @Index()
  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount: string;

  @Column({ name: 'balance_after', type: 'numeric', precision: 18, scale: 2 })
  balanceAfter: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  // `timestamptz` explícito: el tipo por defecto de TypeORM en Postgres es
  // `timestamp` (sin zona horaria), que guarda solo la hora "de pared". Si
  // el proceso de Node corre en una zona horaria distinta a la sesión de
  // Postgres (típico: backend nativo en la laptop del dev vs. contenedor
  // Docker en UTC), el driver reconstruye el instante leyendo esos
  // números como si fueran locales, desfasando `createdAt` varias horas.
  // `timestamptz` guarda el instante real (UTC) y evita ese desfase.
  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
