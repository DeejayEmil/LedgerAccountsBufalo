import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  VersionColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { LedgerTransaction } from '../../ledger/entities/ledger-transaction.entity';

export enum AccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
}

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'account_number', length: 20 })
  accountNumber: string;

  @Column({ type: 'enum', enum: AccountType, default: AccountType.CHECKING })
  type: AccountType;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  // numeric en vez de float: precisión exacta para dinero.
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  balance: string;

  // Optimistic locking: evita que dos transferencias concurrentes sobre la
  // misma cuenta pisen el balance una de la otra. Se complementa (no
  // sustituye) con el lock pesimista que toma LedgerService dentro de la
  // transacción de base de datos al registrar un movimiento.
  @VersionColumn()
  version: number;

  @ManyToOne(() => User, (user) => user.accounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @OneToMany(() => LedgerTransaction, (tx) => tx.account)
  transactions: LedgerTransaction[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
